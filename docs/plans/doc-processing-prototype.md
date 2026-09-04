# Plan — Document Processing Prototype

Feature branch `feat/doc-processing-prototype` off `main`. Spec: [[2026-09-04-doc-processing-prototype-design]] ·
Decisions: [[0001-prototype-foundations]] · Gaps: [[gap-analysis]]. Budget 14–18 h across seven sessions.
One Milestone per session; branch `ms/<n>-<slug>`; per-task commits; self-merge on green; single `feat → main` PR
at the end (400-line target waived by decision).

Always-on skills: `karpathy-guidelines` (simplicity), `superpowers:test-driven-development` at Milestone start,
`superpowers:verification-before-completion` before every PR, `context7` for any library API question.

---

## Milestone 1 — Scaffold + domain (`ms/1-scaffold-domain`, ~2 h)

**Acceptance criteria**
- `pnpm install && pnpm dev` serves a shell layout with TanStack Router and a Query provider; `pnpm test` and
  `pnpm typecheck` pass; `pnpm lint` clean.
- `domain/` exports the types in spec §2; `transition()` enforces the table; `derive.ts` implements confidence,
  reviewOutcome, lane, phone masking.
- Every source file opens with a role header comment; exported symbols carry one-line doc comments.

**Tests (write first)**: `transitions.test.ts` covers every row of the table plus three illegal cases;
`derive.test.ts` covers min-confidence, thresholds, reviewOutcome, lane for all four lanes, masking.

**Tasks**
- [ ] Scaffold Vite + React + TS with pnpm; add Tailwind 4, shadcn init, TanStack Router + Query, Vitest + Testing
      Library, ESLint/Prettier. Ask before each install per Hard Rules. — `context7` ("Tailwind v4 CSS-first setup
      with Vite", "shadcn init with Tailwind v4 and React 19", "TanStack Router file-based routes with Vite").
- [ ] Root layout, router with `/` route and typed search-param schema (`status`, `review`, `type`, `batch`,
      `q`, `sort`, `page`, `doc`); Query provider. — `context7` ("TanStack Router validateSearch zod-free schema").
- [ ] `domain/types.ts` per spec §2.
- [ ] `domain/transitions.ts` + tests. — `tdd`.
- [ ] `domain/derive.ts` + tests. — `tdd`.
- [ ] PR `ms/1 → feat`, self-merge on green; hub log.

## Milestone 2 — Mock backend (`ms/2-mock-backend`, ~3 h)

**Acceptance criteria**
- 100k base records generate deterministically in < 200 ms; `GET /api/documents` returns in < 30 ms for any filter
  combination (measured in a test with `performance.now()`).
- Status is derived from the virtual clock; speed ×100 visibly advances processing; reload resumes the same state.
- Overlay persists human actions and uploaded batches via idb-keyval; `/sim/reset` clears it.
- All routes in spec §3 exist; illegal transitions return 409; outage returns 503 on reads.

**Tests (write first)** (`msw/node`): pagination edges (page 0, last page, past end), each filter alone and combined
with search, deterministic page for fixed seed and clock, retry moves failed→queued and bumps attempts, retry on
non-retryable → 409, bulk retry by filter skips rejected and non-retryable and reports `affected`, overlay merge
wins over base, `/batches/:id` counts sum to total.

**Tasks**
- [ ] `mocks/generate.ts`: mulberry32, word tables, `generateBase(i)`, lazy `generateExtraction(id)` with the
      initial distribution from spec §4.
- [ ] `mocks/clock.ts`: virtual clock (origin, speed), `statusAt(doc, t)`, throughput/ETA math.
- [ ] `mocks/overlay.ts`: Map + idb-keyval persistence, debounced write, reset. Ask before installing idb-keyval.
- [ ] `mocks/store.ts`: merge base + overlay, linear filter/search/sort/paginate, batch counts.
- [ ] `mocks/handlers.ts`: all routes, seeded `delay`, outage 503, transition mapping to 409. — `context7`
      ("MSW 2 http handlers, delay, HttpResponse.json status").
- [ ] `mocks/browser.ts` (worker start gated on DEV, awaited before render) and `mocks/node.ts` for tests.
- [ ] `api/client.ts`, `api/keys.ts`, `api/queries.ts`, `api/mutations.ts` typed against spec §3.
- [ ] PR, self-merge, hub log.

## Milestone 3 — Design direction (`ms/3-design-direction`, ~1.5 h, approval gate inside)

**Acceptance criteria**
- A cited direction brief (palette, type, density, status-colour system paired with icons/text, layout of the
  three screens) approved by Saddat, and one HTML prototype of the dashboard + drawer proving it.
- Brief lands in `docs/design/direction.md`; prototype in `docs/design/prototype.html`.

**Tasks**
- [ ] Run `davinci` — "Design direction for a dense document-processing operations dashboard (NGO archive
      digitisation): stats strip, filterable table with status/review badges, side drawer with per-field
      confidence, upload dialog with virtualized queue. Constraints: shadcn/Tailwind 4 primitives, WCAG AA,
      status never colour-only." Stop for approval at the brief.
- [ ] Commit brief + prototype; PR, self-merge, hub log.

## Milestone 4 — Dashboard (`ms/4-dashboard`, ~3 h)

**Acceptance criteria**
- `/` shows stats strip with per-status counts, needs-review count, throughput, ETA, "Live · updated Ns ago";
  Recharts completed-over-time chart.
- Table via TanStack Table: server-side sort, 50 rows/page, URL-driven filters and search (debounced 300 ms),
  status and review badges as icon + text, masked phone, confidence with threshold label.
- Loading skeleton, first-run empty, no-match empty with "Clear filters", error state with Retry; polling stops
  when nothing is in flight and pauses on hidden tab.
- Keyboard: filter bar and table fully operable; `<th scope>`; visible focus. Screenshot self-check against the
  direction brief before PR.

**Tests (write first)**: FilterBar writes URL params; DocumentsTable renders badges with text for every status
and review value; empty and error states render with actions; polling predicate returns false when counts have
zero queued/processing.

**Tasks**
- [ ] `StatsStrip` + `ProgressChart` (Recharts). — `frontend-design`; `context7` ("Recharts AreaChart responsive").
- [ ] `FilterBar` bound to Router search params.
- [ ] `DocumentsTable` (TanStack Table, manual pagination/sort) + badges + confidence cell. — `frontend-design`;
      `context7` ("TanStack Table v9 manualPagination manualSorting").
- [ ] Loading / empty / error states; polling rules in `api/queries.ts`.
- [ ] Throttled live region in `lib/a11y.ts`; keyboard pass.
- [ ] Screenshot check; PR, self-merge, hub log.

## Milestone 5 — Document detail drawer (`ms/5-detail-drawer`, ~3 h)

**Acceptance criteria**
- `?doc=:id` opens a drawer over the table; back button closes it; focus returns to the originating row.
- Fields sorted worst-first with "flagged only" toggle; each row shows normalized value, raw when different,
  confidence + status text; every `FieldStatus` renders distinctly (no bare dash).
- Confirm / Reject available per transition table; Correct edits one field inline and preserves raw; Retry shown
  only when `error.retryable`; non-retryable failures show "Replace file" guidance and reason.
- Processing timeline and error card. Screenshot self-check.

**Tests (write first)**: FieldRow renders six statuses distinctly; ReviewActions shows Retry only for retryable
errors and hides Confirm after confirmed; correct mutation sends PATCH and updates the row optimistically;
drawer focus returns on close.

**Tasks**
- [ ] Drawer shell bound to `doc` search param, focus trap and return. — `frontend-design`; `context7`
      ("shadcn Sheet focus management").
- [ ] `FieldList` + `FieldRow` with worst-first sort and flagged-only toggle.
- [ ] `ReviewActions` with Confirm / Correct / Reject / Retry and mutations (optimistic retry).
- [ ] `ProcessingTimeline` + error card.
- [ ] Screenshot check; PR, self-merge, hub log.

## Milestone 6 — Upload (`ms/6-upload`, ~3 h)

**Acceptance criteria**
- Dialog accepts files, a folder (`webkitdirectory`) and drag-drop of folders; traversal loops `readEntries` until
  empty; 10k synthetic entries enumerate without freezing the UI (chunked with `scheduler.yield`/setTimeout).
- Validation summary (unsupported type, empty, over-size, duplicate clientKey) before start.
- Queue is virtualized; aggregate progress (count, rate, ETA) updates ≤ 20×/s; per-file rows show state only
  in the visible window; 2% seeded failures retry once then mark failed.
- Files POST in chunks of 500; on completion a banner links to the new batch, which is already processing on the
  dashboard. Cancel remaining works. `aria-live` announces aggregate progress, throttled.

**Tests (write first)**: `useFileSelection` traversal handles a fake directory reader that returns 100 per call;
validator rejects each case; `useUploadQueue` respects concurrency 4 and retries failed once; chunker splits
1,001 files into 3 POSTs.

**Tasks**
- [ ] `useFileSelection` (input + drop traversal, chunked enumeration). — `tdd`.
- [ ] `validate.ts` + validation summary UI.
- [ ] `useUploadQueue` (concurrency, backoff, throttled aggregate, chunked POST). — `tdd`.
- [ ] `UploadDialog` + virtualized `QueueList`. — `frontend-design`; `context7` ("TanStack Virtual list with
      dynamic rows").
- [ ] Transition banner + dashboard invalidation; screenshot check; PR, self-merge, hub log.

## Milestone 7 — Bulk, dev panel, README (`ms/7-bulk-readme`, ~2 h)

**Acceptance criteria**
- Selection bar offers "Retry N selected" and "Retry all M matching current filter"; the latter calls the
  filter-scoped endpoint and reports `affected`.
- Dev panel controls speed, failure rate, outage, reset; every state in the app is reachable within 30 s.
- README complete per spec §8 with assumptions list, run instructions (pnpm), trade-offs, limitations, next steps,
  three screenshots.
- Final `feat → main` PR opened with a precise summary and left for human review.

**Tests (write first)**: SelectionBar switches label between selected and matching modes; bulk mutation
invalidates list and batch; DevPanel PATCHes `/sim`.

**Tasks**
- [ ] `SelectionBar` + bulk retry mutation.
- [ ] `DevPanel`.
- [ ] README + screenshots (`docs/screenshots/`).
- [ ] Final `superpowers:verification-before-completion` pass; `feat → main` PR; hub README + log.

---

## Cut list (in order, if the budget runs out)
Dev panel → "Retry all matching" → folder traversal (keep multi-file input) → Recharts chart.
Never cut: per-field status, transition table + tests, retryable errors, URL state, README assumptions.
