/**
 * Deterministic fixture generation for the simulated archive. Everything here is a pure
 * function of a document's index, so the same seed always yields the same 100,000 documents:
 * a reviewer sees what the screenshots show, and tests can assert on exact pages.
 */
import type { DocumentType, ExtractedField, NormalizedRecord } from '../domain/types';
import { CONFIDENCE } from '../domain/types';

/** Seeded 32-bit PRNG. Nine lines beats a dependency for numbers we only need to be repeatable. */
export function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export const SEED = 20260904;
export const TOTAL_DOCUMENTS = 100_000;

const GIVEN = [
  'Amina', 'Karim', 'Nadia', 'Rafiq', 'Shirin', 'Jamal', 'Fatima', 'Hasan', 'Rumana', 'Tariq',
  'Sadia', 'Imran', 'Nusrat', 'Bilal', 'Farida', 'Anwar', 'Laila', 'Mizan', 'Rehana', 'Sohel',
];
const FAMILY = [
  'Rahman', 'Islam', 'Uddin', 'Khatun', 'Chowdhury', 'Ahmed', 'Hossain', 'Begum', 'Ali', 'Siddique',
];
const DISTRICTS = [
  'Dhaka', 'Chattogram', 'Khulna', 'Sylhet', 'Rajshahi', 'Barishal', 'Rangpur', 'Mymensingh',
  'Cox’s Bazar', 'Kurigram',
];
const PROGRAMS = [
  'Primary Education Support', 'Maternal Health Outreach', 'Flood Relief 2026',
  'Nutrition Supplement', 'Cyclone Shelter Registration', 'Adult Literacy',
];

const TYPES: DocumentType[] = ['enrollment', 'medical_intake', 'id_scan', 'handwritten_note'];
const EXTENSION: Record<DocumentType, string> = {
  enrollment: 'pdf',
  medical_intake: 'pdf',
  id_scan: 'jpg',
  handwritten_note: 'png',
  unknown: 'pdf',
};
const MIME: Record<string, string> = {
  pdf: 'application/pdf',
  jpg: 'image/jpeg',
  png: 'image/png',
};

/** Failure codes weighted so most failures are worth retrying, as a real pipeline's would be. */
const FAILURES = [
  { code: 'PROCESSING_TIMEOUT', message: 'Processing exceeded the time limit.', retryable: true },
  {
    code: 'OCR_SERVICE_UNAVAILABLE',
    message: 'The text-recognition service was unavailable.',
    retryable: true,
  },
  { code: 'EXTRACTION_FAILED', message: 'Text was read but no fields could be identified.', retryable: true },
  {
    code: 'UNREADABLE_DOCUMENT',
    message: 'The scan is too low-contrast to read. A new scan is required.',
    retryable: false,
  },
  {
    code: 'UNSUPPORTED_FORMAT',
    message: 'This file type cannot be processed.',
    retryable: false,
  },
] as const;

/**
 * The compact record the store holds for all 100,000 documents. Processing status is *not*
 * stored: it is derived from these offsets and the virtual clock, so time advancing needs no
 * write. Extraction is generated on demand from `seed`, never held in memory for the archive.
 */
export type BaseDocument = {
  id: string;
  batchId: string;
  fileName: string;
  mimeType: string;
  size: number;
  documentType: DocumentType;
  seed: number;
  /** Seconds from the virtual epoch when processing starts. Negative means before the demo began. */
  startOffset: number;
  /** Seconds spent processing. */
  duration: number;
  /** Whether this document ends in failure, and with which error. */
  failureIndex: number | null;
  /** Whether a successful extraction is uncertain enough to need review. */
  flagged: boolean;
  uploadedAt: string;
};

/** Virtual epoch: the instant the archive's clock starts. Fixed so timestamps are reproducible. */
export const EPOCH_MS = Date.parse('2026-09-01T09:00:00.000Z');

const pick = <T>(list: readonly T[], r: number): T => list[Math.floor(r * list.length) % list.length];

/**
 * Builds one document from its index. Outcome mix at t=0: 65% completed, 5% failed,
 * 10% processing, 20% queued; roughly a fifth of completed documents are flagged for review.
 */
export function generateBase(index: number, batchId = 'batch_archive'): BaseDocument {
  const seed = SEED + index;
  const rand = mulberry32(seed);
  const u = rand();
  const documentType = pick(TYPES, rand());
  const ext = EXTENSION[documentType];

  let startOffset: number;
  let duration: number;
  let failureIndex: number | null = null;

  if (u < 0.7) {
    // Terminal before the demo starts: spread across the last 24 virtual hours.
    duration = 2 + rand() * 28;
    startOffset = -(60 + rand() * 86_400);
    // 5 of these 70 points are failures.
    if (rand() < 5 / 70) failureIndex = Math.floor(rand() * FAILURES.length);
  } else if (u < 0.8) {
    // Mid-flight right now.
    duration = 25 + rand() * 60;
    startOffset = -rand() * 20;
  } else {
    // Still queued; the backlog drains over the next 30 virtual minutes.
    duration = 2 + rand() * 28;
    startOffset = 1 + rand() * 1_800;
    if (rand() < 0.05) failureIndex = Math.floor(rand() * FAILURES.length);
  }

  return {
    id: `doc_${index}`,
    batchId,
    fileName: `${documentType.replace('_', '-')}-${String(index).padStart(6, '0')}.${ext}`,
    mimeType: MIME[ext],
    size: Math.round(40_000 + rand() * 4_000_000),
    documentType,
    seed,
    startOffset,
    duration,
    failureIndex,
    flagged: failureIndex === null && rand() < 0.22,
    uploadedAt: new Date(EPOCH_MS + Math.min(startOffset, 0) * 1000 - 30_000).toISOString(),
  };
}

/** The error a failed document carries. */
export function generateError(base: BaseDocument) {
  const f = FAILURES[base.failureIndex ?? 0];
  return { code: f.code, message: f.message, retryable: f.retryable };
}

/** Every field except the document type itself, which is never degraded or corrected. */
type ValueField = Exclude<keyof NormalizedRecord, 'documentType'>;

/** Fields that a given document type simply does not contain; they render as not applicable. */
const NOT_APPLICABLE: Partial<Record<DocumentType, ValueField[]>> = {
  id_scan: ['programName'],
  handwritten_note: ['phone'],
};

function confident(rand: () => number, value: string, floor = CONFIDENCE.high): ExtractedField {
  return { status: 'extracted', value, confidence: Number((floor + rand() * (1 - floor)).toFixed(2)) };
}

/**
 * Builds the normalized record for a completed document, consistent with its `flagged` bit:
 * an unflagged document is confidently extracted throughout, a flagged one carries a mix of
 * uncertain, missing and unreadable fields with the raw OCR text that produced them.
 */
export function generateExtraction(base: BaseDocument): NormalizedRecord {
  const rand = mulberry32(base.seed ^ 0x9e3779b9);
  const name = `${pick(GIVEN, rand())} ${pick(FAMILY, rand())}`;
  const digits = `1${Math.floor(3 + rand() * 6)}${String(Math.floor(rand() * 100_000_000)).padStart(8, '0')}`;
  const district = pick(DISTRICTS, rand());
  const program = pick(PROGRAMS, rand());
  const day = new Date(EPOCH_MS - Math.floor(rand() * 200) * 86_400_000);

  const record: NormalizedRecord = {
    documentType: { status: 'extracted', value: base.documentType, confidence: 0.99 },
    personName: confident(rand, name),
    phone: confident(rand, `+880${digits}`),
    location: confident(rand, district),
    programName: confident(rand, program),
    date: confident(rand, day.toISOString().slice(0, 10)),
  };

  for (const field of NOT_APPLICABLE[base.documentType] ?? []) {
    record[field] = { status: 'not_applicable' };
  }

  if (base.flagged) {
    // Degrade one to three applicable fields so the reviewer has something real to act on.
    const candidates = (
      ['personName', 'phone', 'location', 'programName', 'date'] as ValueField[]
    ).filter((f) => record[f].status === 'extracted');
    const count = 1 + Math.floor(rand() * Math.min(3, candidates.length));
    for (let i = 0; i < count; i++) {
      const field = candidates[Math.floor(rand() * candidates.length)];
      const roll = rand();
      if (roll < 0.55) {
        const confidence = Number((0.35 + rand() * 0.34).toFixed(2));
        record[field] = {
          status: 'uncertain',
          value: record[field].value,
          raw: garble(String(record[field].value ?? ''), rand),
          confidence,
        };
      } else if (roll < 0.85) {
        record[field] = { status: 'missing' };
      } else {
        record[field] = { status: 'unreadable', raw: garble(String(record[field].value ?? ''), rand) };
      }
    }
  }

  return record;
}

/** Mimics OCR confusion (l/1, O/0) so the raw value visibly differs from the normalized one. */
function garble(value: string, rand: () => number): string {
  const swaps: Record<string, string> = { '1': 'l', '0': 'O', '5': 'S', 'a': '@', 'o': '0' };
  return value
    .split('')
    .map((ch) => (swaps[ch] && rand() < 0.5 ? swaps[ch] : ch))
    .join('');
}
