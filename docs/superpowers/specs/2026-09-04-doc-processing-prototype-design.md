# Design Spec (TRD) — Document Processing Prototype

Status: draft for approval · Date: 2026-09-04 · Decisions: [[0001-prototype-foundations]] · Gaps: [[gap-analysis]] · Brief: [[assessment-1]]

## 1. Problem and scope

Frontend prototype for Alo Relief Trust's archive digitisation: upload up to ~100k documents, watch upload and
processing progress, tell which files are queued / processing / completed / failed, browse normalized extraction,
inspect one result, and act sensibly on failures and uncertain data. Fully mocked backend (D1), no deploy.

Out of scope: auth, real OCR/AI, real storage, document preview beyond a placeholder, multi-language, Postpone verb.

## 2. Domain model

Two orthogonal axes on every document, plus a derived lane. Never one flat status enum.

```ts
// domain/types.ts
export type DocumentStatus = "queued" | "processing" | "completed" | "failed";
export type ReviewStatus = "not_required" | "needs_review" | "confirmed" | "rejected";
export type Lane = "auto_accepted" | "needs_review" | "recapture" | "in_flight"; // derived, never stored

export type ErrorCode =
  | "UNREADABLE_DOCUMENT"     // retryable: false
  | "UNSUPPORTED_FORMAT"      // retryable: false
  | "PROCESSING_TIMEOUT"      // retryable: true
  | "EXTRACTION_FAILED"       // retryable: true
  | "OCR_SERVICE_UNAVAILABLE";// retryable: true
export type ProcessingError = { code: ErrorCode; message: string; retryable: boolean };

export type FieldStatus = "extracted" | "uncertain" | "missing" | "unreadable" | "not_applicable" | "corrected";
export type ExtractedField<T = string> = {
  status: FieldStatus;
  value?: T;            // normalized: E.164 phone, ISO date, canonical program/location
  raw?: string;         // what OCR read; rendered when it differs from value
  confidence?: number;  // 0..1; absent for missing / not_applicable
};

export type DocumentType = "enrollment" | "medical_intake" | "id_scan" | "handwritten_note" | "unknown";
export type NormalizedRecord = {
  documentType: ExtractedField<DocumentType>;
  personName: ExtractedField;
  phone: ExtractedField;
  location: ExtractedField;
  programName: ExtractedField;
  date: ExtractedField;
};

export type Document = {
  id: string; batchId: string;
  fileName: string; mimeType: string; size: number;
  status: DocumentStatus; reviewStatus: ReviewStatus;
  attempts: number;
  error?: ProcessingError;
  extraction?: NormalizedRecord;            // present when status === "completed"
  uploadedAt: string; startedAt?: string; finishedAt?: string;
};

export type Batch = {
  id: string; name: string; createdAt: string;
  counts: Record<DocumentStatus, number> & { needsReview: number; confirmed: number; rejected: number; total: number };
  throughputPerSec: number; etaSeconds: number | null;
};
```

Derivations (`domain/derive.ts`, pure, tested):

- `documentConfidence(rec) = min(confidence of required fields present)`; required = all except `documentType` when
  type is `unknown`. Thresholds: ≥ 0.90 high · 0.70–0.89 uncertain (review recommended) · < 0.70 review required.
- `reviewOutcome(rec)`: `needs_review` if any required field is `uncertain | missing | unreadable`, else `not_required`.
- `lane(doc)`: `in_flight` if queued/processing · `recapture` if (failed and !retryable) or rejected ·
  `needs_review` if completed and reviewStatus === needs_review · else `auto_accepted`.
- Phone masking for list views: `+880 17•• ••• 678`.

Transition table (`domain/transitions.ts`, pure, tested; every mutation handler calls it):

| Action | From | Guard | To |
|---|---|---|---|
| start | queued | — | processing |
| complete | processing | — | completed, reviewStatus = reviewOutcome |
| fail | processing | — | failed, error set |
| retry | failed | error.retryable && reviewStatus !== rejected | queued, attempts+1 |
| confirm | completed | reviewStatus === needs_review | reviewStatus = confirmed |
| correct(field, value) | completed | reviewStatus === needs_review | field.status = corrected, raw preserved |
| reject | completed \| failed | reviewStatus !== confirmed | reviewStatus = rejected |

Anything else throws `IllegalTransition`, which handlers map to HTTP 409.

## 3. API contract (MSW handlers, `/api/*`)

| Method | Path | Notes |
|---|---|---|
| GET | `/batches` | list, newest first |
| GET | `/batches/:id` | counts + throughput + ETA (cheap; polled) |
| POST | `/batches` | `{ name }` → Batch |
| POST | `/batches/:id/documents` | `{ files: {clientKey,name,size,mimeType}[] }`, ≤500 per call; idempotent on `clientKey` (= name+size+lastModified) |
| GET | `/documents` | `batchId, status[], reviewStatus[], documentType[], search, sort, page, pageSize` → `{ items, total, page, pageSize }`; items carry masked phone and no `extraction` beyond `documentType` |
| GET | `/documents/:id` | full document incl. extraction |
| POST | `/documents/:id/retry` \| `/confirm` \| `/reject` | 409 on illegal transition |
| PATCH | `/documents/:id/fields/:field` | `{ value }` |
| POST | `/documents/retry` | `{ filter }` (same filter params as list) → `{ affected }`; skips non-retryable and rejected |
| GET/PATCH | `/sim` | `{ speed: 1\|10\|100, failureRate, outage: boolean }` |
| POST | `/sim/reset` | clears overlay and virtual clock |

Every request: `await delay(80–250ms)` seeded; while `outage` is true, GET `/documents` and `/batches/:id`
return 503 so query error states are exercised. All list/filter/search is server-side by contract.

## 4. Mock backend design

**Base dataset**: 100k lightweight records generated at boot by a pure `generateBase(i)` using mulberry32 and
small name/location/program tables (no faker; ~100 ms for 100k). Extraction detail for a document is generated
lazily and deterministically from its id on `GET /documents/:id`.

**Time-derived processing state, not a mutating scheduler.** Each base document has deterministic
`startOffset` / `finishOffset` (seconds from the virtual clock's origin) and a seeded outcome. Status is a function
of virtual time: queued before start, processing between, outcome after. Initial distribution at t=0:
65% already completed, 10% processing, 15% queued, 5% failed, 5% of completed flagged needs_review.
The virtual clock = persisted origin + elapsed × speed. Consequences: no per-tick mutation of 25k records,
reload resumes exactly where it was, "processing" still visibly advances under polling, and speed ×100 fast-forwards.

**Overlay**: `Map<id, Partial<Document>>` holding only human actions, retries (new offsets) and uploaded batches'
documents. Persisted as one blob via idb-keyval, debounced 500 ms. Reads merge base + overlay. Reset clears it.

**Per-request cost**: linear predicate scan over 100k (~5 ms) and sort only when a sort param is set.
`ponytail: linear scan; add per-status index if profiler shows jank`. Handlers run on the main thread (MSW
forwards to the page), so this budget matters.

**Tests** share the handlers through `msw/node` `setupServer`: pagination boundaries, filter combinations,
determinism (same seed → same page), overlay merge, illegal transition → 409, filter-scoped bulk retry counts.

## 5. Frontend architecture

```
src/
  app/          router.tsx (TanStack Router, search-param schemas), providers.tsx, RootLayout
  domain/       types.ts · transitions.ts · derive.ts · *.test.ts
  api/          client.ts (typed fetch) · keys.ts · queries.ts (useDocuments, useDocument, useBatch) · mutations.ts
  mocks/        generate.ts · clock.ts · overlay.ts · store.ts · handlers.ts · browser.ts · node.ts
  features/
    dashboard/  StatsStrip · ProgressChart · DocumentsTable · FilterBar · SelectionBar
    document/   DocumentDrawer · FieldList · FieldRow · ReviewActions · ProcessingTimeline
    upload/     UploadDialog · useFileSelection (readEntries loop) · useUploadQueue · QueueList (virtualized)
    sim/        DevPanel
  components/ui shadcn primitives
  lib/          format.ts · a11y.ts (throttled live region)
```

Server state: TanStack Query. List query key = `['documents', searchParams]`, `placeholderData: keepPreviousData`,
`refetchInterval` = function returning 3000 only while the batch has queued/processing documents, else `false`.
Batch stats polled at 2000 ms on the same rule. Mutations invalidate `['documents']` and `['batch', id]`;
retry is optimistic (status → queued, rollback on error).

UI state: URL search params (filters, sort, page, `doc` id for the drawer) via Router schemas. Component state for
dialogs and selection. No global store.

Upload flow: select (input `multiple` + `webkitdirectory`, and drop with a correct 100-per-call `readEntries`
loop) → validate (type, size > 0, size cap, duplicate clientKey) → queue in memory → fake transfer with
concurrency 4, per-file seeded latency, 2% seeded failure with one backoff retry → POST in chunks of 500 →
aggregate progress throttled to rAF → batch appears on dashboard already processing. Queue list is virtualized
(TanStack Virtual); only the visible window re-renders. Reload during upload loses the queue; README states it.

Accessibility: `<table>` with `<th scope>`, badges = icon + text + color, drawer traps focus and returns it to the
row, one throttled `aria-live="polite"` region for aggregate progress, `aria-rowcount` on the virtual queue,
all actions keyboard-reachable, visible focus rings.

## 6. Screens

1. **Dashboard** `/` — stats strip (total, per-status, needs review, throughput, ETA, "Live · updated Ns ago"),
   Recharts small area chart of completed-over-time, filter bar (search, status, review, type, batch), table
   (file, type, status badge, review badge, confidence, updated), row selection + selection bar
   ("Retry 12 selected" / "Retry all 4,821 matching"), loading skeleton, empty (first-run, no-match), error with retry.
2. **Detail drawer** `/?doc=:id` — header (file, batch, status + review badges), fields sorted worst-first with a
   "flagged only" toggle, each row: label, normalized value, raw beneath when different, confidence + status text,
   Correct inline; actions Confirm / Reject / Retry (only if retryable); processing timeline; error card with
   reason and retryable explanation.
3. **Upload dialog** — drop zone + buttons (files / folder), validation summary, virtualized queue, aggregate
   progress with rate and ETA, "Start", "Cancel remaining", transition banner "Batch X is processing → View".
4. **Dev panel** (collapsible) — speed, failure rate, outage toggle, reset demo data.

## 7. Testing strategy

Vitest + Testing Library + jsdom; `msw/node` for API tests. Per Milestone, tests first (TDD at Milestone level).
No Playwright. Screenshot self-check for every UI Milestone before the PR.

## 8. README skeleton

Overview · Running locally (Node 22, pnpm) · Product assumptions (the 17 in [[gap-analysis]] §7 plus §27 of the
original analysis) · Domain model · Architecture and state management · Large dataset strategy · Async simulation ·
API contract · UX decisions · Accessibility · Trade-offs · Known limitations · Next steps · Screenshots.
