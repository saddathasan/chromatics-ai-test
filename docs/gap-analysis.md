# Gap Analysis — Your Assessment vs. the Chromatics Assignment

Reviewed: `assessment-1.md` (the brief) against `chromatics-ai-senior-architecture-assessment.md` (your analysis).
Backed by four research passes: browser bulk-upload at scale, human-in-the-loop (HITL) review UX in shipping
IDP products, current stack facts (TanStack Query v5, MSW 2, React 19, Vite 8, Tailwind 4), and Chromatics AI itself.

## 1. Verdict

Your analysis gets the central thesis right: this is an **operations dashboard over an asynchronous, unreliable
pipeline**, not an upload UI. Server-owned dataset, paginated fetching, split of lifecycle vs. review status,
scoped retry, documented assumptions, scope discipline. All correct and all well argued.

It has **three structural blind spots** that a reviewer would notice:

1. **Upload is where the 100k number actually bites the frontend, and you explicitly downplay it.** The table is
   the easy half of scale (the backend paginates). The upload queue is the half the browser owns.
2. **The extraction/uncertainty model is one level too coarse.** `missingFields: string[]` + a document-level
   confidence cannot render the "make missing/inconsistent/uncertain visible" requirement per field.
3. **"Do something sensible when a file fails or is uncertain" is answered with "Retry / Mark reviewed".**
   That is two verbs. Shipping products use five, and they separate system failure from human judgment.

Plus a handful of smaller omissions: no testing story, no simulation-engine design, no URL state, no bulk-action
semantics at scale, no persona/PII thinking, and the deliverables section ignores the demo and time-box.

Nothing in your analysis contradicts the brief. It under-serves three of the seven bullets.

## 2. Requirement coverage check

| Brief requirement | Your analysis | Gap |
|---|---|---|
| Upload one at a time or in bulk | §6, §23 (upload modal, drag/drop) | Thin. No folder selection, no queue model, no concurrency, no reload survival. |
| Understand a batch could be ~100k files | §4, §16 (backend owns data, paginate) | Misread. This bullet is about the **uploader's** understanding at upload time: ETA, throughput, "don't close tab", what a reload does. Not about the table. |
| See upload and processing progress | §6 flow diagram | Progress is drawn, not designed. No throttling, no aggregate vs per-file, no ETA. |
| Tell pending / processing / completed / failed | §3 status split | Good. Missing: transition table and `retryable` flag on errors. |
| View normalized extracted info | §8 nested record | Missing raw-vs-normalized, type-specific fields, per-field status. |
| Inspect an individual result | §11 drawer | Good. Missing: worst-first field ordering, filter-to-flagged, deep link. |
| Do something sensible on failure / incomplete / uncertain | §12 retry, §24 "mark reviewed" | Under-designed. See §3.3 below. |
| Source + run instructions + README + screenshots | §26–27 README | No run-instructions detail (pnpm, Node version), no live demo, no screenshots plan, no time-box. |

## 3. The big misses

### 3.1 Upload at scale is a frontend problem you dismissed

Your §6 says "upload should be polished but relatively simple" and §17 says virtualization "may not even be
necessary". Both are true for the table and false for the upload queue. Facts from the upload research:

- Folder drag-and-drop through `webkitGetAsEntry` returns **100 entries per `readEntries()` call** in Chromium.
  Code that does not loop silently drops every file past the 100th. This is the single most common bug in DIY
  folder upload and a reviewer who knows it will look for it.
- `<input webkitdirectory>` has no cap. Selecting ~500k files took ~30s and ~2 GB in Chrome. 100k is inside the safe
  zone but enumeration blocks the main thread for seconds. iOS Safari does not support folder selection at all.
- Holding 100k `File` handles is cheap (metadata only). Enumeration, hashing and rendering are the costs.
- Consensus concurrency is **3–6 parallel uploads**, exponential backoff per file, then mark failed without
  blocking the batch.
- A 100k-row upload queue in the DOM hangs the page. **This is the one place virtualization is mandatory.**
- Progress at network speed must be throttled to ~10–20 UI updates/sec and shown as an aggregate
  (`42,310 / 100,000 · 14 files/s · ~1h 8m left`), with per-file rows only for the visible virtualized window.
- Reload survival means persisting the queue to IndexedDB. Not needed for the prototype, but the README must say
  what happens on reload and why (this is exactly bullet 2 of the brief).
- Idempotency key on the client: `name + size + lastModified` is a fine cheap key. Full content hashing of 100k
  files via `crypto.subtle` is minutes of wall-clock and needs a worker pool. Say so, do not do it.

What to build: real folder selection with a correct `readEntries` loop, a real virtualized queue, real throttled
aggregate progress, a **fake transfer**. That single screen demonstrates async workflow design, performance and
scale more credibly than the table does.

### 3.2 The extraction model needs per-field status

Your §8 record has optional strings and a top-level `extraction.missingFields`. Your §10 then asks the UI to
distinguish Missing / Unknown / Uncertain / Failed / Not applicable, but the model cannot carry that. Also, real
documents are heterogeneous: an ID scan and a medical intake sheet do not share a schema.

Every HITL product surveyed (Rossum, MuleSoft IDP, Google Document AI, Nanonets, Instabase) converges on the same
shape:

```ts
type FieldStatus =
  | "extracted"        // value present, confidence >= threshold
  | "uncertain"        // value present, confidence < threshold
  | "missing"          // field expected for this doc type, not found
  | "unreadable"       // region found, OCR could not read it
  | "not_applicable"   // field not expected for this doc type
  | "corrected";       // human replaced the value

type ExtractedField<T = string> = {
  status: FieldStatus;
  value?: T;           // normalized (E.164 phone, ISO date, canonical program name)
  raw?: string;        // what OCR actually read; shown when it differs from value
  confidence?: number; // 0..1, absent when status is missing/not_applicable
};

type NormalizedRecord = {
  documentType: ExtractedField<DocumentType>;
  personName: ExtractedField;
  phone: ExtractedField;
  location: ExtractedField;
  programName: ExtractedField;
  date: ExtractedField;
};
```

Two consequences you should make explicit:

- **Document-level confidence is derived, not stored.** Recommend `min(confidence of required fields)`, not mean.
  A mean hides one unreadable phone number behind five perfect fields.
- **Raw vs normalized is the "normalized information" requirement made visible.** `01712-345678` → `+8801712345678`
  shown together is the strongest single signal that you understood the word "normalized".

### 3.3 "Sensible" failure and review handling is more than Retry + Mark reviewed

The research on shipping products gives a concrete vocabulary. Adopt it.

**Three lanes, not one review bucket.**

| Lane | Trigger | Human action |
|---|---|---|
| Auto-accepted | every required field `extracted` | none |
| Needs review | any field `uncertain` or `missing` | field-level review |
| Reject to recapture | document unreadable / wrong type / unsupported | re-upload, not field editing |

Putting an unreadable scan into field-by-field review wastes the reviewer's time. Your §12 error codes already
imply this split; make it a lane.

**Errors carry `retryable`.** `PROCESSING_TIMEOUT` is retryable. `UNSUPPORTED_FORMAT` is not, and showing a Retry
button on it is a product bug. Non-retryable failures get "Replace file" instead.

**Review verbs.** Confirm · Correct inline · Reject to recapture · Postpone. Your §25 lists "complicated document
editing" as out of scope, which is right, but **inline correction of a single field value is not complicated and
is the sensible action for uncertain data.** Cutting it removes the answer to bullet 7 of the brief.

**System failure vs human judgment are different states.** `failed` (retry may fix it) vs `rejected` (a person
decided). Merging them makes "Retry all failed" re-process documents a human already rejected.

**Explicit transition table.** Not just the state list. `retry` allowed only from `failed`; `confirm` only from
`needs_review`; `reject` from `needs_review` or `failed`. One pure function, one test file. This is the cheapest
"senior signal" in the whole project.

Optional, mention only: a `reviewing` lock state while a document is open, so two operators do not double-review.

### 3.4 No testing section anywhere

Your analysis has 35 sections and none is testing. A senior submission needs three small things:

- unit tests for the transition function and the confidence/lane derivation
- a test for the mock API contract (pagination, filter, sort, deterministic seed)
- one component test for the detail drawer rendering each `FieldStatus` distinctly

Not a suite. Three files. Vitest + Testing Library.

### 3.5 The simulation engine is not designed

Everything the reviewer sees flows from the fake backend, and your analysis only says "deterministic fixtures".
Decide and document:

- **Seeded generation** (faker with a fixed seed) so reviewer and README screenshots match.
- **Tick-based scheduler**: every N ms move K documents `queued → processing → (completed | failed)` with
  seeded outcomes. Runs in a module, not in components.
- **Transport failures are separate from processing failures.** Occasionally make `GET /documents` return 503 so
  the query error state and retry button are real, not decorative.
- **A small dev panel** (speed ×1/×10/×100, failure rate, "inject outage", "reset dataset"). This lets the reviewer
  reproduce every state in 30 seconds and is worth more than any additional screen.
- **Persistence across reload**: in-memory is fine, but say so. If you upload a batch and refresh, it vanishes.
  Either persist the mock store to IndexedDB or state the limitation.
- **Main-thread cost.** MSW executes handler code on the page's main thread, not in the service worker. Filtering
  100k records per request will jank the UI. Pre-index once (sorted arrays + `Map` by id) so each request is
  O(page), not O(100k).

### 3.6 Smaller omissions

- **URL as state.** Filters, search, page, sort and the open document id belong in the query string. Back button
  works, links are shareable, refresh preserves context. Your §14 puts these in `useState`/Zustand. Wrong home.
- **Bulk actions across 100k.** "Select all" on a 50-row page must offer "select all 4,821 matching this filter",
  and the mutation must be filter-scoped (`POST /documents/retry { filter }`), not an array of 4,821 ids.
- **Polling design.** Poll the cheap batch-stats endpoint, and only refetch the list page when stats changed.
  Stop polling when nothing is active (`refetchInterval` as a function returning `false`). Pause when the tab is
  hidden (the default). Show "Live · updated 3s ago".
- **Throughput and ETA** on the batch card. The most useful number for an operator staring at 100k documents.
- **Empty states**: first run, zero results for a filter (with "clear filters"), batch with only failures.
- **Persona and context.** Alo is an NGO with field teams. The documents are medical intake sheets and ID scans:
  PII. Mask phone numbers in the list view, show full in detail. Note low-bandwidth regions as the reason resumable
  upload matters in production. Chromatics has operations in Dhaka, so the Bangladeshi phone example lands.
- **Accessibility specifics beyond the checklist.** A virtualized list needs `aria-rowcount`/`aria-rowindex`.
  Live-region announcements must be throttled (announce "1,200 completed" every few seconds, never per file).
  Focus returns to the row when the drawer closes. Real `<th scope>` headers.
- **Deliverables.** Node version + `pnpm install && pnpm dev` + a deployed demo link (Vercel/Cloudflare Pages,
  minutes of work, huge reviewer convenience) + 3 screenshots or a 60s recording. Optional in the brief, cheap to do.

## 4. Things in your analysis that are wrong or inconsistent

- **§3 lifecycle diagram** chains `Completed → Normalized → Needs Review` as one linear flow, then §3 itself argues
  these are separate axes. Fix the diagram: lifecycle is `queued → processing → completed | failed`; review is an
  orthogonal `not_required | needs_review | reviewed | rejected`.
- **§16 fixture distribution** (65% completed, 10% processing, 15% pending, 5% failed, 5% needs review) sums to
  100% by mixing the two axes you just separated. Needs-review is a subset of completed.
- **§17** "virtualization may not even be necessary" is correct for the table and misses that the upload queue is
  the client-owned 100k list.
- **§6** "upload relatively simple" undersells bullet 2 of the brief.
- **§25** cutting "document editing" must not cut single-field correction.
- **§14/§30** "Redux unnecessary" is right, but Chromatics' own job posts list React, Next.js and Redux. Do not
  disparage Redux in the README. Say "TanStack Query owns server state, which removes the need for a global store;
  Redux would be reasonable if the app grew client-side workflows." Same for Next.js vs Vite: say why Vite (no SSR,
  no data-fetching-on-server, fastest to run locally) rather than implying Next is wrong.
- **§31 rubric and §1 difficulty score** are your own invention. Useful as a lens, but do not let a self-made
  weighting drive scope. The brief's own words are the rubric.

## 5. What I would do differently (stack)

| Your pick | Recommendation | Why |
|---|---|---|
| TanStack Table | **Drop it** | 50 server-paginated rows with server-side sort need a `<table>` and two `useState`s. Headless table adds API surface, not value. |
| TanStack Virtual "optional" | **Required, for the upload queue only** | Not the document table. |
| Zustand optional | **Drop it** | UI state is URL params + component state. A store would be a third home with no tenant. |
| MSW | **Keep, with eyes open** | Gives Network-tab realism and a visible HTTP contract, which supports your "swap for real API" claim. Costs: SW setup, HMR gotchas, handlers run on the main thread. Alternative: a fetch-shaped fake module behind the same `api/` interface, zero setup. Decision below. |
| Zod | **Optional** | Only valuable at the API boundary if you want runtime proof the contract holds. Fine to include, do not let it spread into components. |
| Recharts | **Drop** | Five numbers and a progress bar are not a chart problem. |
| Folder structure §21 | **Flatten** | Four features × five subfolders is 20 directories for ~30 files. Start with `features/{upload,documents,review}` each holding a handful of files; split when a folder exceeds ~8 files. |

Current facts from the research, so the README does not cite stale versions: TanStack Query v5 (`placeholderData:
keepPreviousData`, `refetchInterval` as a function), MSW 2.x, React 19 with React Compiler 1.0, Vite 8 (Rolldown),
Tailwind 4 with CSS-first config, shadcn init targets Tailwind 4 and React 19 by default. Package manager: pnpm.

## 6. Recommended scope and build order

Build as one vertical slice first, then widen. Rough budget 14–18 focused hours.

1. **Domain + mock backend (3h).** Types above, transition function, seeded 100k generator with pre-built indexes,
   `documentApi`/`batchApi` module, scheduler. Tests for transition + pagination.
2. **Dashboard (4h).** Stats strip with throughput/ETA, table with URL-driven filters, status + review badges as
   text-plus-icon, loading/empty/error states, polling.
3. **Document detail (3h).** Route-backed drawer, fields worst-first, per-status rendering, raw vs normalized,
   Confirm / Correct / Reject / Postpone, retry with `retryable` respected, timeline.
4. **Upload (3h).** Folder + multi-file selection with correct traversal, client validation, virtualized queue,
   throttled aggregate progress, batch creation, transition into processing.
5. **Bulk + dev panel + README (2h).** Select-all-matching, retry-all-failed, simulation controls, README with the
   assumptions list, deploy, screenshots.

Cut list if time runs out, in order: dev panel → postpone verb → bulk select-all-matching → upload folder traversal
(keep multi-file input). Never cut: per-field status, transition table, retryable errors, URL state, tests.

## 7. README assumptions to add to your §27 list

9. Upload and processing are separate stages with separate failure modes; upload failures never create a document.
10. Documents are heterogeneous; the normalized record is a fixed core schema and fields not expected for a
    document type are `not_applicable`, not missing.
11. Normalized values are shown alongside raw OCR text when they differ; raw is the audit trail.
12. Document-level confidence is the minimum of required-field confidences.
13. Errors are classified retryable or not; the UI never offers retry for non-retryable failures.
14. Human rejection is distinct from system failure and is excluded from "retry all failed".
15. Filters, sort, page and the open document live in the URL.
16. The prototype's dataset is in memory and resets on reload; production would persist queue state client-side
    (IndexedDB) and use resumable uploads given field-team connectivity.
17. Phone numbers are masked in list views because the archive contains medical and identity documents.
