/**
 * The simulated backend's database and query engine. Holds the 100,000-document base archive
 * plus an overlay of everything a human or a retry has changed, and answers the same
 * paginated, filtered questions a real API would. The UI never sees anything but a page.
 */
import { IllegalTransition, transition } from '../domain/transitions';
import type {
  Batch,
  Document,
  DocumentStatus,
  DocumentType,
  NormalizedRecord,
  ReviewStatus,
} from '../domain/types';
import {
  EPOCH_MS,
  TOTAL_DOCUMENTS,
  generateBase,
  generateError,
  generateExtraction,
  type BaseDocument,
} from './generate';
import { loadOverlay, saveOverlay } from './overlay';

/**
 * The only things a mutation may record. Status, timestamps and errors are deliberately absent:
 * they are always derived from the clock, so a patch cannot freeze a document mid-pipeline.
 * A retry rewrites `base` instead, rewinding that one document's clock.
 */
export type Patch = {
  base?: BaseDocument;
  /** Set only when a human decided; otherwise review status stays derived from the extraction. */
  reviewStatus?: Extract<ReviewStatus, 'confirmed' | 'rejected'>;
  attempts?: number;
  extraction?: NormalizedRecord;
};

export type SimState = { speed: number; failureRate: number; outage: boolean };

type Persisted = { virtualSeconds: number; patches: [string, Patch][]; sim: SimState };

const DEFAULT_SIM: SimState = { speed: 1, failureRate: 0.05, outage: false };

let base: BaseDocument[] = [];
let extraBase: BaseDocument[] = [];
let patches = new Map<string, Patch>();
let batches: Batch[] = [];
let sim: SimState = { ...DEFAULT_SIM };
let virtualSeconds = 0;
let lastRealMs = Date.now();

/**
 * Advances and returns the virtual clock. Time is accumulated rather than computed from a
 * fixed origin so changing the speed dial does not retroactively rewrite the past.
 */
export function now(): number {
  const real = Date.now();
  virtualSeconds += ((real - lastRealMs) / 1000) * sim.speed;
  lastRealMs = real;
  return virtualSeconds;
}

/** Test seam: move the virtual clock without waiting for wall time. */
export function advance(seconds: number): void {
  now();
  virtualSeconds += seconds;
}

/**
 * A document's live state reduced to what filtering needs: two enums and the base record.
 * Deriving this costs a handful of numeric comparisons, so the whole archive can be scanned
 * per request without allocating 100,000 documents and 200,000 date strings.
 */
type Live = {
  base: BaseDocument;
  patch: Patch | undefined;
  status: DocumentStatus;
  reviewStatus: ReviewStatus;
};

function liveOf(b: BaseDocument, t: number): Live {
  const patch = patches.get(b.id);
  const source = patch?.base ?? b;
  const started = t >= source.startOffset;
  const finished = t >= source.startOffset + source.duration;
  const status: DocumentStatus = !started
    ? 'queued'
    : !finished
      ? 'processing'
      : source.failureIndex !== null
        ? 'failed'
        : 'completed';
  const derived: ReviewStatus =
    status === 'completed' && source.flagged ? 'needs_review' : 'not_required';
  return { base: source, patch, status, reviewStatus: patch?.reviewStatus ?? derived };
}

const iso = (offsetSeconds: number) => new Date(EPOCH_MS + offsetSeconds * 1000).toISOString();

/** Expands a live row into the full document. Called for a page of results, never the archive. */
function materialize(live: Live): Document {
  const { base: source, status } = live;
  const started = status !== 'queued';
  const finished = status === 'completed' || status === 'failed';
  return {
    id: source.id,
    batchId: source.batchId,
    fileName: source.fileName,
    mimeType: source.mimeType,
    size: source.size,
    status,
    reviewStatus: live.reviewStatus,
    attempts: live.patch?.attempts ?? 0,
    uploadedAt: source.uploadedAt,
    startedAt: started ? iso(source.startOffset) : undefined,
    finishedAt: finished ? iso(source.startOffset + source.duration) : undefined,
    error: status === 'failed' ? generateError(source) : undefined,
  };
}

/** Every base record in the archive, uploaded batches included. */
function everyBase(): BaseDocument[] {
  return extraBase.length ? [...base, ...extraBase] : base;
}

/** Extraction is generated on read, so the archive never holds 100,000 field records in memory. */
export function extractionFor(id: string, status: DocumentStatus): NormalizedRecord | undefined {
  if (status !== 'completed') return undefined;
  const patch = patches.get(id);
  if (patch?.extraction) return patch.extraction;
  const b = patch?.base ?? find(id);
  return b ? generateExtraction(b) : undefined;
}

function find(id: string): BaseDocument | undefined {
  const index = Number(id.replace('doc_', ''));
  if (Number.isInteger(index) && index >= 0 && index < base.length) return base[index];
  return extraBase.find((b) => b.id === id);
}

export type ListQuery = {
  q?: string;
  status?: DocumentStatus[];
  review?: ReviewStatus[];
  type?: DocumentType[];
  batch?: string;
  sort?: string;
  page?: number;
  pageSize?: number;
};

/** Rows matching a filter, still in cheap form. Shared by list, bulk retry and batch counts. */
function matching(query: ListQuery, t: number): Live[] {
  const needle = query.q?.toLowerCase();
  const out: Live[] = [];
  // ponytail: linear scan over 100k of numeric state. Add per-status indexes if it ever drags.
  for (const b of everyBase()) {
    if (query.batch && b.batchId !== query.batch) continue;
    if (query.type?.length && !query.type.includes(b.documentType)) continue;
    if (needle && !b.fileName.toLowerCase().includes(needle)) continue;
    const live = liveOf(b, t);
    if (query.status?.length && !query.status.includes(live.status)) continue;
    if (query.review?.length && !query.review.includes(live.reviewStatus)) continue;
    out.push(live);
  }
  return out;
}

/** Server-side filter, search, sort and pagination — the boundary the real API would own. */
export function list(query: ListQuery) {
  const t = now();
  const pageSize = Math.min(Math.max(query.pageSize ?? 50, 1), 200);
  const page = Math.max(query.page ?? 1, 1);
  const matched = matching(query, t);
  sortRows(matched, query.sort);
  const start = (page - 1) * pageSize;
  return {
    // Extraction is attached to the returned page only - the table needs the document type and
    // the weakest field's confidence, and generating it for 50 rows costs far less than the
    // scan that produced them. The archive is never materialized.
    items: matched.slice(start, start + pageSize).map((row) => {
      const doc = materialize(row);
      return { ...doc, extraction: extractionFor(doc.id, doc.status) };
    }),
    total: matched.length,
    page,
    pageSize,
  };
}

function sortRows(rows: Live[], key: string | undefined): void {
  if (!key) return;
  const desc = key.startsWith('-');
  const field = desc ? key.slice(1) : key;
  if (field === 'confidence') {
    // The one sort that costs extraction; scored once per row rather than inside the comparator.
    const score = new Map(rows.map((r) => [r.base.id, confidenceOf(r)]));
    rows.sort((a, b) => (score.get(a.base.id) ?? -1) - (score.get(b.base.id) ?? -1));
  } else if (field === 'fileName') {
    rows.sort((a, b) => a.base.fileName.localeCompare(b.base.fileName));
  } else {
    rows.sort((a, b) => a.base.uploadedAt.localeCompare(b.base.uploadedAt));
  }
  if (desc) rows.reverse();
}

function confidenceOf(row: Live): number {
  const record = extractionFor(row.base.id, row.status);
  if (!record) return -1;
  const scores = Object.values(record)
    .map((f) => f.confidence)
    .filter((c): c is number => typeof c === 'number');
  return scores.length ? Math.min(...scores) : -1;
}

/** One document with its extraction attached, as the detail drawer needs it. */
export function get(id: string): Document | undefined {
  const b = patches.get(id)?.base ?? find(id);
  if (!b) return undefined;
  const live = liveOf(b, now());
  return { ...materialize(live), extraction: extractionFor(id, live.status) };
}

/** Rolled-up counts for a batch, plus the throughput and ETA the operator actually watches. */
export function batchStats(batchId: string): Batch | undefined {
  const meta = batches.find((b) => b.id === batchId);
  if (!meta) return undefined;
  const t = now();
  const counts = {
    queued: 0,
    processing: 0,
    completed: 0,
    failed: 0,
    needsReview: 0,
    confirmed: 0,
    rejected: 0,
    total: 0,
  };
  let finishedInWindow = 0;
  for (const b of everyBase()) {
    if (b.batchId !== batchId) continue;
    const live = liveOf(b, t);
    counts[live.status]++;
    counts.total++;
    if (live.reviewStatus === 'needs_review') counts.needsReview++;
    else if (live.reviewStatus === 'confirmed') counts.confirmed++;
    else if (live.reviewStatus === 'rejected') counts.rejected++;
    const end = live.base.startOffset + live.base.duration;
    if (end <= t && end > t - 60) finishedInWindow++;
  }
  const throughputPerSec = finishedInWindow / 60;
  const remaining = counts.queued + counts.processing;
  return {
    ...meta,
    counts,
    throughputPerSec,
    etaSeconds:
      remaining > 0 && throughputPerSec > 0 ? Math.round(remaining / throughputPerSec) : null,
  };
}

export function listBatches(): Batch[] {
  return batches.map((b) => batchStats(b.id)!).reverse();
}

/** Applies a domain action and records the result in the overlay. Throws IllegalTransition. */
export function mutate(id: string, apply: (doc: Document) => Document): Document {
  const current = get(id);
  if (!current) throw new IllegalTransition('start', { status: 'queued' } as Document);
  const next = apply(current);
  const existing = patches.get(id);
  const decided =
    next.reviewStatus === 'confirmed' || next.reviewStatus === 'rejected'
      ? next.reviewStatus
      : undefined;

  const patch: Patch = {
    base: existing?.base,
    attempts: next.attempts,
    reviewStatus: decided,
    extraction: next.extraction ?? existing?.extraction,
  };

  // A retry rewinds this document's clock, so it queues and processes again on its own.
  if (next.status === 'queued' && current.status === 'failed') {
    const b = existing?.base ?? find(id)!;
    patch.base = {
      ...b,
      startOffset: now() + 2 + Math.random() * 8,
      duration: 3 + Math.random() * 20,
      failureIndex: Math.random() < sim.failureRate ? Math.floor(Math.random() * 5) : null,
      flagged: Math.random() < 0.22,
    };
    // Reprocessing produces a fresh extraction and clears any earlier review decision.
    patch.extraction = undefined;
    patch.reviewStatus = undefined;
  }
  patches.set(id, patch);
  persist();
  return get(id)!;
}

/**
 * Retries every document matching a filter. Scoped by filter rather than by a list of ids,
 * because "retry all 4,821 failures" must not put 4,821 identifiers in a request body.
 */
export function retryMatching(query: ListQuery): number {
  const at = new Date().toISOString();
  let affected = 0;
  for (const row of matching({ ...query, status: ['failed'] }, now())) {
    if (row.reviewStatus === 'rejected') continue;
    if (!generateError(row.base).retryable) continue;
    mutate(row.base.id, (doc) => transition(doc, { type: 'retry', at }));
    affected++;
  }
  return affected;
}

/** Creates an empty batch for an upload operation. */
export function createBatch(name: string): Batch {
  const id = `batch_${batches.length}_${Date.now().toString(36)}`;
  const batch: Batch = {
    id,
    name,
    createdAt: new Date().toISOString(),
    counts: {
      queued: 0,
      processing: 0,
      completed: 0,
      failed: 0,
      needsReview: 0,
      confirmed: 0,
      rejected: 0,
      total: 0,
    },
    throughputPerSec: 0,
    etaSeconds: null,
  };
  batches.push(batch);
  persist();
  return batch;
}

export type UploadedFile = { clientKey: string; name: string; size: number; mimeType: string };

/**
 * Adds uploaded files to a batch. Idempotent on `clientKey`, so a replayed upload request
 * never produces a second copy of the same file.
 */
export function addDocuments(batchId: string, files: UploadedFile[]): number {
  const seen = new Set(extraBase.map((b) => b.id));
  const t = now();
  let added = 0;
  for (const file of files) {
    const id = `doc_up_${batchId}_${file.clientKey}`;
    if (seen.has(id)) continue;
    const b = generateBase(TOTAL_DOCUMENTS + extraBase.length, batchId);
    extraBase.push({
      ...b,
      id,
      fileName: file.name,
      size: file.size,
      mimeType: file.mimeType,
      startOffset: t + 1 + Math.random() * 30,
      duration: 3 + Math.random() * 25,
      failureIndex: Math.random() < sim.failureRate ? Math.floor(Math.random() * 5) : null,
      uploadedAt: new Date().toISOString(),
    });
    seen.add(id);
    added++;
  }
  persist();
  return added;
}

export function getSim(): SimState {
  return { ...sim };
}

export function setSim(next: Partial<SimState>): SimState {
  now(); // bank elapsed time at the old speed before changing it
  sim = { ...sim, ...next };
  persist();
  return { ...sim };
}

/** Rebuilds the archive from the seed and drops every human change. */
export function reset(): void {
  patches = new Map();
  extraBase = [];
  sim = { ...DEFAULT_SIM };
  virtualSeconds = 0;
  lastRealMs = Date.now();
  batches = [
    {
      id: 'batch_archive',
      name: 'Field archive backlog',
      createdAt: new Date(EPOCH_MS).toISOString(),
      counts: {
        queued: 0,
        processing: 0,
        completed: 0,
        failed: 0,
        needsReview: 0,
        confirmed: 0,
        rejected: 0,
        total: 0,
      },
      throughputPerSec: 0,
      etaSeconds: null,
    },
  ];
  persist();
}

let persistTimer: ReturnType<typeof setTimeout> | undefined;

/** Debounced so a burst of confirmations is one write, not one per click. */
function persist(): void {
  clearTimeout(persistTimer);
  persistTimer = setTimeout(() => {
    void saveOverlay<Persisted>({ virtualSeconds, patches: [...patches], sim });
  }, 500);
}

/**
 * Builds the archive once and restores any previous session's changes. The 100,000 base
 * records are regenerated from the seed, never stored: only human changes are persisted.
 */
export async function initStore(total = TOTAL_DOCUMENTS): Promise<void> {
  base = new Array(total);
  for (let i = 0; i < total; i++) base[i] = generateBase(i);
  reset();
  const saved = await loadOverlay<Persisted>();
  if (saved) {
    patches = new Map(saved.patches);
    sim = { ...DEFAULT_SIM, ...saved.sim };
    virtualSeconds = saved.virtualSeconds ?? 0;
    lastRealMs = Date.now();
  }
}
