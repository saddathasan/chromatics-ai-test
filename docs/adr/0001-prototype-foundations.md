# ADR 0001 — Prototype foundations

Status: accepted · Date: 2026-09-04 · Confidence: high

## Context

Take-home for Chromatics AI: a frontend prototype for digitising ~100k NGO documents (upload, progress, status,
normalized extraction, detail inspection, failure/uncertainty handling). No real backend or OCR required.
Full gap analysis in `docs/gap-analysis.md`. Six foundation decisions were grilled and settled; they shape every
later Milestone.

## Decisions

| # | Decision | Chosen | Alternatives considered |
|---|---|---|---|
| D1 | Mock transport | **MSW 2 service worker**; handlers pre-index the dataset so each request is O(page) | fetch-shaped fake module; interface with two adapters |
| D2 | Framework and stack | **Vite + React SPA, TanStack everywhere** (Router for URL state, Query for server state, Table, Virtual), Recharts for charts, Tailwind + shadcn/ui | Next.js App Router; plain `<table>` without TanStack Table |
| D3 | Data generation and persistence | **Seeded deterministic 100k base regenerated on load + mutation overlay persisted in IndexedDB via idb-keyval**; "Reset demo data" clears the overlay. `@mswjs/data` rejected: unsupported on npm | nothing persisted; everything in IndexedDB via Dexie |
| D4 | Document detail surface | **Route-backed drawer** `/documents/$id` over the table | full page; drawer + full page |
| D5 | Review verbs | **Confirm · Correct (single field, inline) · Reject (to recapture lane)**; Retry only on `retryable` failures | add Postpone; Confirm + Retry only |
| D6 | Time budget | **14–18 focused hours**, vertical slice first: domain + mock → dashboard → detail → upload → bulk/dev panel/README | 8–12h; 20h+ |

## Drivers

Product judgment and architecture clarity over feature count (the brief's own words). Reviewer reproducibility
(deterministic data, survives reload). Credible "swap mock for real API" story (visible HTTP contract).
Depth in the three under-served brief bullets: bulk upload at scale, per-field uncertainty, sensible failure actions.

## Consequences

- TanStack Table and Recharts are in by the candidate's choice; the README must justify them in one line each
  (Table: sort/selection state machinery for bulk actions; Recharts: batch progress over time), not leave them
  looking like dependency padding.
- URL is the home for filters, sort, page and the open document id (Router search params). No Zustand.
- The mock store is two layers (generator + overlay); every mutation handler writes the overlay, every read merges it.
- Non-retryable errors never render a Retry button; rejected documents are excluded from "Retry all failed".
- Cut list if time runs out, in order: dev panel → select-all-matching → folder traversal (keep multi-file input).
  Never cut: per-field status, transition table + test, retryable errors, URL state.
