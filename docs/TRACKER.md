# Work Tracker — Document Processing Prototype

> **Open this first in every session.** Update it before every Milestone PR and before ending a session.
> Canonical checklist lives here; the plan file holds the reasoning behind each task.

## Resume here

| | |
|---|---|
| **Current state** | Milestone 3 merged. Direction brief approved and the HTML prototype built and audited. 77 tests still green. |
| **Branch** | `feat/doc-processing-prototype` (merge `ms/2`), cut off `main` |
| **Next action** | Start **Milestone 4** on `ms/4-dashboard`. Build to `docs/design/prototype.html` — it is the reference, not a suggestion. Installs approved and expected: `@fontsource/ibm-plex-sans`, `@fontsource/ibm-plex-mono`, plus the M1-deferred `@testing-library/react`, `@testing-library/jest-dom`, `jsdom` and the Vitest switch to the jsdom environment. |
| **Blocking decisions** | None. Task-level choices proceed on the plan's recommendation and are logged. |
| **Scheduled gates** | Milestone 3 gate cleared 2026-09-04 (all four questions approved). Milestone 7: `feat → main` PR is human-reviewed. |
| **Budget** | 14–18 h total · ~5 h spent (M1, M2, M3) |

## Document map

| Document | Purpose | Read when |
|---|---|---|
| [[assessment-1]] `docs/assessment-1.md` | The brief from Chromatics AI. Source of truth for requirements. | Checking scope; writing the README. |
| `docs/Technical Assignment-1_260831_141539.pdf` | Original PDF of the brief. | Only if the markdown transcription is doubted. |
| [[chromatics-ai-senior-architecture-assessment]] `docs/chromatics-ai-senior-architecture-assessment.md` | Saddat's first analysis of the brief. | Background only; superseded where the gap analysis disagrees. |
| [[gap-analysis]] `docs/gap-analysis.md` | What the first analysis missed, what to do differently, README assumptions list (§7). | Milestones 4–7 (product decisions); writing the README. |
| [[0001-prototype-foundations]] `docs/adr/0001-prototype-foundations.md` | Decisions D1–D6: MSW, Vite + TanStack + Recharts + shadcn, seeded base + overlay, drawer, review verbs, budget. | Any time a stack or architecture question comes up. Do not re-litigate. |
| [[2026-09-04-doc-processing-prototype-design]] `docs/superpowers/specs/2026-09-04-doc-processing-prototype-design.md` | The TRD: domain types (§2), transition table (§2), API contract (§3), mock backend (§4), frontend architecture (§5), screens (§6), testing (§7), README skeleton (§8). | Every Milestone. Code must conform to it. |
| [[doc-processing-prototype]] `docs/plans/doc-processing-prototype.md` | Milestones 1–7: acceptance criteria, tests-first lists, tasks with skill routing, cut list. | Start of every Milestone session. |
| `docs/TRACKER.md` (this file) | Status board and checklists. | Start and end of every session. |
| Hub `~/claude-glacier/Projects/chromatics-ai-test/` | `README.md` status line · `log/` prose session records · `decisions/` mirror of ADRs | End of every session (write log, update README). |

Global rules that govern execution: `~/.claude/CLAUDE.md` (ask before installs, no AI attribution, comment headers
mandatory), `~/.claude/docs/git-workflow.md` (per-task commits, self-merge on green, no squash),
`~/.claude/docs/planning-methodology.md` (one Milestone per session).

## Milestone board

| # | Milestone | Branch | Spec refs | Plan section | Status | PR | Session log |
|---|---|---|---|---|---|---|---|
| 0 | Planning | `feat/doc-processing-prototype` | all | — | ✅ Done (`288eaa2`) | — | `log/2026-09-04-gap-analysis.md`, `log/2026-09-04-planning.md` |
| 1 | Scaffold + domain | `ms/1-scaffold-domain` | §2, §5 | Milestone 1 | ✅ Merged (`e3d0654`) | merged locally, no remote | `log/2026-09-04-ms1-scaffold-domain.md` |
| 2 | Mock backend | `ms/2-mock-backend` | §3, §4 | Milestone 2 | ✅ Merged | merged locally, no remote | `log/2026-09-04-ms2-mock-backend.md` |
| 3 | Design direction (davinci) | `ms/3-design-direction` | §6 | Milestone 3 | ✅ Merged · gate cleared | merged locally, no remote | `log/2026-09-04-ms3-design-direction.md` |
| 4 | Dashboard | `ms/4-dashboard` | §5, §6.1 | Milestone 4 | ⬜ Not started | — | — |
| 5 | Detail drawer | `ms/5-detail-drawer` | §2 (transitions), §6.2 | Milestone 5 | ⬜ Not started | — | — |
| 6 | Upload | `ms/6-upload` | §5 (upload flow), §6.3 | Milestone 6 | ⬜ Not started | — | — |
| 7 | Bulk, dev panel, README | `ms/7-bulk-readme` | §3 (bulk, sim), §6.4, §8 | Milestone 7 | ⬜ Not started · **human gate** (`feat → main`) | — | — |

Status legend: ⬜ Not started · 🔶 In progress · 🔴 Blocked · ✅ Merged to `feat`.

## Requirement coverage (brief → Milestone)

| Brief requirement | Delivered by |
|---|---|
| Upload one at a time or in bulk | M6 |
| Understand a batch could be ~100k files | M6 (queue, rate, ETA, reload note), M2 (100k dataset) |
| See upload and processing progress | M6 (upload), M4 (processing stats, chart, live indicator) |
| Tell pending / processing / completed / failed | M1 (types), M4 (badges, filters) |
| View normalized extracted information | M4 (table), M5 (raw vs normalized) |
| Inspect an individual result | M5 |
| Do something sensible on failure / incomplete / uncertain | M1 (transitions, retryable), M5 (Confirm/Correct/Reject/Retry), M7 (bulk retry) |
| Source + run instructions + README + screenshots | M7 |

## Checklists

Tick a task when its commit lands. Tick the Milestone when its PR is merged to `feat`.

### Milestone 1 — Scaffold + domain (~2 h) · plan: Milestone 1 · spec: §2, §5
- [x] Tests written first: `transitions.test.ts`, `derive.test.ts` (red)
- [x] Scaffold Vite + React + TS (pnpm), Tailwind 4, shadcn init, TanStack Router + Query, Vitest + Testing Library, ESLint/Prettier — each install approved
- [x] Root layout, `/` route with typed search-param schema, Query provider
- [x] `domain/types.ts`
- [x] `domain/transitions.ts` (green)
- [x] `domain/derive.ts` (green)
- [x] File header + export comments on every file
- [x] `pnpm test` · `pnpm typecheck` · `pnpm lint` green → PR `ms/1 → feat` → self-merge → hub log
- [x] **Milestone 1 merged**

### Milestone 2 — Mock backend (~3 h) · plan: Milestone 2 · spec: §3, §4
- [x] Tests written first (msw/node): pagination edges, filters, determinism, retry, 409, bulk retry, overlay merge, counts
- [x] `mocks/generate.ts` (mulberry32, tables, `generateBase`, lazy `generateExtraction`)
- [x] `mocks/clock.ts` (virtual clock, `statusAt`, throughput/ETA)
- [x] `mocks/overlay.ts` (idb-keyval, debounced, reset) — install approved
- [x] `mocks/store.ts` (merge, filter/search/sort/paginate, counts)
- [x] `mocks/handlers.ts` (all routes, delay, outage 503, 409 mapping)
- [x] `mocks/browser.ts` + `mocks/node.ts`
- [x] `api/client.ts`, `keys.ts`, `queries.ts`, `mutations.ts`
- [x] Perf assertions pass (generate < 200 ms, list < 30 ms) → PR → self-merge → hub log
- [x] **Milestone 2 merged**

### Milestone 3 — Design direction (~1.5 h) · plan: Milestone 3 · spec: §6
- [x] Run `davinci` with the prompt in the plan — 21 real screens (Mobbin) + WCAG 2.2, Primer and archival accessioning practice read directly
- [x] **Saddat approves the direction brief** (gate) — all four questions approved 2026-09-04
- [x] HTML prototype of dashboard + drawer, audited against `anti-slop.md` (0/12 marks)
- [x] Commit `docs/design/direction.md` + `docs/design/prototype.html` (+ `palette.mjs`) → PR → self-merge → hub log
- [x] **Milestone 3 merged**

### Milestone 4 — Dashboard (~3 h) · plan: Milestone 4 · spec: §5, §6.1 · **design: `docs/design/prototype.html`**
- [ ] Install and wire the M3/M1 deferrals: `@fontsource/ibm-plex-{sans,mono}`, `@testing-library/react`, `@testing-library/jest-dom`, `jsdom`; Vitest → `jsdom` environment; palette tokens from `docs/design/direction.md` §4 into `src/index.css`; shadcn theme
- [ ] Tests written first: FilterBar → URL, **lane rendered as glyph + word for all four lanes plus the raw status pair**, empty/error states, polling predicate
- [ ] `StatsStrip` + `ProgressChart`
- [ ] `FilterBar` bound to search params
- [ ] `DocumentsTable` (TanStack Table, manual pagination/sort, badges, confidence)
- [ ] Loading / empty / error states; polling rules
- [ ] Throttled live region; keyboard pass
- [ ] Screenshot self-check against direction brief → PR → self-merge → hub log
- [ ] **Milestone 4 merged**

### Milestone 5 — Detail drawer (~3 h) · plan: Milestone 5 · spec: §2, §6.2
- [ ] Tests written first: six field statuses, Retry only if retryable, correct PATCH optimistic, focus return
- [ ] Drawer shell on `doc` param, focus trap + return
- [ ] `FieldList` + `FieldRow` (worst-first, flagged-only)
- [ ] `ReviewActions` (Confirm / Correct / Reject / Retry) + mutations
- [ ] `ProcessingTimeline` + error card
- [ ] Screenshot self-check → PR → self-merge → hub log
- [ ] **Milestone 5 merged**

### Milestone 6 — Upload (~3 h) · plan: Milestone 6 · spec: §5 upload flow, §6.3
- [ ] Tests written first: traversal 100-per-call, validator cases, queue concurrency + retry, chunker
- [ ] `useFileSelection` (input, folder, drop traversal, chunked enumeration)
- [ ] `validate.ts` + summary UI
- [ ] `useUploadQueue` (concurrency 4, backoff, throttled aggregate, chunked POST)
- [ ] `UploadDialog` + virtualized `QueueList`
- [ ] Transition banner + dashboard invalidation
- [ ] Screenshot self-check → PR → self-merge → hub log
- [ ] **Milestone 6 merged**

### Milestone 7 — Bulk, dev panel, README (~2 h) · plan: Milestone 7 · spec: §3, §6.4, §8
- [ ] Tests written first: SelectionBar modes, bulk invalidation, DevPanel PATCH
- [ ] `SelectionBar` + filter-scoped bulk retry
- [ ] `DevPanel`
- [ ] README per spec §8 (assumptions from gap-analysis §7 + original §27), `docs/screenshots/`
- [ ] `verification-before-completion` pass
- [ ] PR `feat → main` opened with precise summary, left for human review → hub README + log
- [ ] **Milestone 7 merged to feat; Feature PR open**

## Cut list (apply in order only if budget runs out)
1. Dev panel (M7) · 2. "Retry all matching" (M7) · 3. Folder traversal, keep multi-file input (M6) · 4. Recharts chart (M4).
Never cut: per-field status, transition table + tests, retryable errors, URL state, README assumptions.

## Session protocol
1. Open this file. Check "Resume here" and the board.
2. Read the Milestone's section in the plan and the spec sections it references.
3. Branch `ms/<n>-<slug>` off the current `feat/doc-processing-prototype`. Write the Milestone's tests first.
4. One task = one commit (Conventional Commits, no attribution). Tick tasks here as commits land.
5. Green tests → PR `ms → feat` → self-merge. Tick the Milestone. Fill PR and log columns on the board.
6. Update "Resume here" (state, next action, hours spent). Write the hub log and README line. `/clear`.

## Hours log

| Date | Milestone | Hours | Notes |
|---|---|---|---|
| 2026-09-04 | 0 Planning | — | Gap analysis, decisions, spec, plan (not counted against build budget) |
| 2026-09-04 | 1 Scaffold + domain | ~1.5 | 46 tests, typecheck/lint/build green. Deviations logged below. |
| 2026-09-04 | 2 Mock backend | ~2 | 77 tests. Measured at 100k: generate 71ms, filtered page 6ms, batch stats 5ms. |
| 2026-09-04 | 3 Design direction | ~1.5 | Brief + prototype + verified palette. No source touched; 77 tests still green. |

## Deviations from the plan (running log)

- **M1**: Vite 8 template ships **oxlint**, not ESLint — kept it, no ESLint installed.
- **M1**: shadcn and Testing Library + jsdom **deferred to M4** (shadcn theme depends on the M3
  design direction; nothing to render-test yet). `pnpm test` currently runs in the `node` environment;
  M4 must switch Vitest to `jsdom` and install `@testing-library/react`, `@testing-library/jest-dom`, `jsdom`.
- **M1**: TanStack Router routes are **code-based**, not file-based — one screen plus a drawer does not
  justify a codegen step. Search params validated by a hand-written parser (`src/app/search.ts`), no zod.
- **M1**: `lane()` routes a **retryable failure to `needs_review`**, not `auto_accepted` as spec §2 implied.
  A retryable failure needs a human click, so it belongs in the attention bucket; only dead-end failures
  and human rejections go to `recapture`. Spec §2 wording is superseded by `src/domain/derive.ts`.
- **M1**: `documentConfidence` is the min over fields that **carry** a confidence (missing/unreadable
  fields have none and are excluded); they still force `needs_review` through `reviewOutcome`.

- **M2**: The mock's processing state is **derived from a virtual clock**, not advanced by a scheduler.
  Each document carries `startOffset` and `duration`; status is a function of time, so 100,000 documents
  progress with zero writes and a reload resumes exactly where it left off. The clock accumulates elapsed
  time rather than reading from a fixed origin, so changing the speed dial cannot rewrite the past.
- **M2**: `Patch` (the overlay record) is **structurally unable to hold `status`, timestamps or `error`**.
  An earlier version stored the whole mutated document, which froze a retried document at `queued` forever.
  The type now permits only `base`, `reviewStatus` (when a human decided), `attempts` and `extraction`.
- **M2**: `list()` filters on cheap derived state and materializes **only the returned page**. Filtering on
  full documents cost 65ms per request on the main thread; this is 6ms. Same fix applied to `batchStats`.
- **M2**: MSW handler paths are origin-agnostic (`*/api/...`) so one set of handlers serves the browser
  (relative fetch) and the Node test runner (absolute fetch). `src/api/client.ts` prefixes an origin under Node.
- **M2**: `api/queries.ts` and `api/mutations.ts` (React Query hooks) **deferred to M4/M5**, where their
  consumers live. M2 ships `api/client.ts` only. The M4 checklist item "polling rules in api/queries.ts" stands.
- **M2**: The dashboard placeholder now reads real batch counts and a document page. It is a browser smoke
  test for the service worker, which the Node suite cannot cover. M4 replaces it.
- **M2 open risk**: the MSW **browser** path (service-worker registration) is not covered by an automated
  test — only the Node path is. First `pnpm dev` of M4 confirms it visually.

- **M3**: The status column is **lane-first**, superseding spec §6.1's two badges. One column shows the
  derived `lane` as glyph + word, with the raw `status`/`reviewStatus` pair in 11px text beneath it.
  Two pills per row across thirty rows is unreadable, and `lane()` in `src/domain/derive.ts` already
  encodes the question an operator actually asks. Approved at the M3 gate.
- **M3**: **Colour is reserved for state.** There is no brand accent hue; actions are ink on paper, so
  the only saturated colour anywhere is a status. The five status colours sit within 20% relative
  luminance of each other on purpose, which is why the glyph-and-word rule (WCAG 2.2 SC 1.4.1, Level A)
  is load-bearing and can never be dropped for a narrow column.
- **M3**: Palette is **computed and verified**, not chosen by eye — `docs/design/palette.mjs` does
  OKLCH → sRGB plus WCAG 2.2 ratios with no dependencies. Two candidates were desaturated because they
  clipped outside sRGB. Every pair clears its target in both schemes. Re-run it if a token changes.
- **M3**: The table row hairlines deliberately do **not** meet 3:1. SC 1.4.11 covers UI components and
  graphical objects; a row separator is a reading aid and the data is carried entirely by text. Input
  borders (`field`) and focus rings (`focus`) are in scope and both clear 3:1 in both schemes.
- **M3**: Fields state the **defect in words**, with the confidence number secondary — taken from
  archival condition-survey practice, where "good / fair / poor" grades are treated as useless and the
  specific defect is recorded instead. This is why the six `FieldStatus` values must never collapse
  into an em-dash in the UI.
- **M3 open risk**: `davinci`'s source registry needs re-vetting on three entries — IBM Carbon and
  Atlassian returned truncated or navigation-only content, and `polaris-react.shopify.com` now
  301-redirects to `shopify.dev`. None is cited in the brief, so no decision rests on them.
- **M3 unverified**: the prototype renders in a fallback face (a self-contained file cannot load
  webfonts, and the Google CDN is ruled out on GDPR grounds) — resolved at M4 by the approved
  self-hosted install. No APCA pass and no colour-blindness simulator pass; the argument for the
  status system is structural rather than measured.
