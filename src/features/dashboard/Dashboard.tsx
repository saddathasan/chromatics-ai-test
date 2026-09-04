/**
 * The operations screen. Owns the wiring only - URL state in, query state out, selection and
 * the sparkline's sample history in local state. Everything visible belongs to a child, so the
 * pieces stay testable without a router.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useSearch } from '@tanstack/react-router';
import { useBulkRetry, useDocument, useDocumentMutations, useSim } from '../../api/mutations';
import { PAGE_SIZE, useBatches, useDocuments } from '../../api/queries';
import { DocumentDrawer } from '../document/DocumentDrawer';
import { DevPanel } from '../sim/DevPanel';
import { SelectionBar } from './SelectionBar';
import { can } from '../../domain/transitions';
import { count } from '../../lib/format';
import { DocumentsTable } from './DocumentsTable';
import { FilterBar } from './FilterBar';
import { StatsStrip } from './StatsStrip';
import type { DocumentSearch } from '../../app/search';

/** Enough trace to see a trend, short enough that one stall does not flatten the whole line. */
const MAX_SAMPLES = 24;

/** One shared empty set, so "nothing selected" is a stable reference across renders. */
const EMPTY: ReadonlySet<string> = new Set();

export function Dashboard() {
  const search = useSearch({ from: '/' });
  const navigate = useNavigate({ from: '/' });
  const batches = useBatches();
  const documents = useDocuments(search, batches.data);
  const opened = useDocument(search.doc);
  const actions = useDocumentMutations(search.doc);
  const bulk = useBulkRetry();
  const sim = useSim();
  const [selection, setSelection] = useState<{ view: string; ids: ReadonlySet<string> }>({
    view: '',
    ids: EMPTY,
  });
  const [bulkResult, setBulkResult] = useState<string | undefined>();

  const patch = useCallback(
    (next: Partial<DocumentSearch>) => {
      void navigate({ search: (prev) => ({ ...prev, ...next }) });
    },
    [navigate],
  );

  const completed = useMemo(
    () => (batches.data ?? []).reduce((sum, b) => sum + b.counts.completed, 0),
    [batches.data],
  );

  // The sparkline is this session's own observation: how many documents finished between polls.
  const previous = useRef<number | undefined>(undefined);
  const [samples, setSamples] = useState<number[]>([]);
  useEffect(() => {
    if (!batches.data) return;
    const last = previous.current;
    previous.current = completed;
    if (last !== undefined && completed >= last) {
      setSamples((s) => [...s, completed - last].slice(-MAX_SAMPLES));
    }
  }, [batches.dataUpdatedAt, batches.data, completed]);

  const rows = documents.data?.items ?? [];

  /**
   * Selection is page-scoped and drops the moment the view changes. Carrying ids across pages
   * would mean holding a set the operator can no longer see, and "retry every matching failure"
   * already covers the case that would need.
   *
   * Derived during render rather than reset from an effect: the stale set is simply never read,
   * so there is no second render to cascade from.
   */
  const view = JSON.stringify(search);
  const selected = selection.view === view ? selection.ids : EMPTY;
  const setSelected = (ids: ReadonlySet<string>) => setSelection({ view, ids });

  const toggle = (id: string, on: boolean) => {
    const next = new Set(selected);
    if (on) next.add(id);
    else next.delete(id);
    setSelected(next);
  };

  const toggleAll = (on: boolean) => setSelected(on ? new Set(rows.map((doc) => doc.id)) : EMPTY);

  // Only retryable rows will move, so the button counts those rather than the selection.
  const retryableIds = rows
    .filter((doc) => selected.has(doc.id) && can(doc, 'retry'))
    .map((d) => d.id);

  const runBulk = async (run: Promise<{ affected: number }>, scope: string) => {
    const { affected } = await run;
    setBulkResult(
      affected === 0
        ? `Nothing in ${scope} could be retried.`
        : `Retried ${count(affected)} ${affected === 1 ? 'document' : 'documents'} in ${scope}.`,
    );
    setSelected(EMPTY);
  };

  const clearFilters = useCallback(
    () =>
      patch({
        q: undefined,
        status: undefined,
        review: undefined,
        type: undefined,
        batch: undefined,
        page: 1,
      }),
    [patch],
  );

  const hasFilters = Boolean(
    search.q ||
    search.status?.length ||
    search.review?.length ||
    search.type?.length ||
    search.batch,
  );
  const total = documents.data?.total ?? 0;
  const pages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const first = total === 0 ? 0 : (search.page - 1) * PAGE_SIZE + 1;

  if (batches.error)
    return (
      <main className="mx-auto max-w-[1360px] px-6 py-12">
        <p role="alert" className="text-failed">
          Could not reach the archive. {String((batches.error as Error).message)}
        </p>
        <button
          type="button"
          className="mt-3 border border-field px-3 py-1.5"
          onClick={() => void batches.refetch()}
        >
          Try again
        </button>
      </main>
    );

  return (
    <main className="mx-auto max-w-[1360px] px-6">
      {batches.data ? (
        <StatsStrip
          batches={batches.data}
          updatedAt={batches.dataUpdatedAt}
          samples={samples}
          search={search}
          onFilter={patch}
        />
      ) : (
        <div className="border-b border-rule py-6" role="status" aria-busy="true">
          <span className="sr-only">Loading batch statistics</span>
          <div className="h-8 w-72 bg-paper-sunk" />
        </div>
      )}

      <FilterBar search={search} batches={batches.data ?? []} onChange={patch} />

      {selected.size > 0 ? (
        <SelectionBar
          selected={selected.size}
          retryable={retryableIds.length}
          hasFilters={hasFilters}
          pending={bulk.pending}
          onRetrySelected={() =>
            void runBulk(bulk.selected.mutateAsync(retryableIds), 'the selected rows')
          }
          onRetryMatching={() =>
            void runBulk(
              bulk.matching.mutateAsync({
                q: search.q,
                status: search.status,
                review: search.review,
                type: search.type,
                batch: search.batch,
              }),
              hasFilters ? 'this filter' : 'the archive',
            )
          }
          onClear={() => setSelected(EMPTY)}
        />
      ) : null}

      {bulkResult ? (
        <p role="status" className="border-b border-rule px-3 py-2 text-[13px]">
          {bulkResult}{' '}
          <button
            type="button"
            className="underline underline-offset-[3px]"
            onClick={() => setBulkResult(undefined)}
          >
            Dismiss
          </button>
        </p>
      ) : null}

      <DocumentsTable
        docs={rows}
        isPending={documents.isPending}
        error={documents.error}
        hasFilters={hasFilters}
        sort={search.sort}
        selected={selected}
        onToggle={toggle}
        onToggleAll={toggleAll}
        onSort={(sort) => patch({ sort, page: 1 })}
        onOpen={(doc) => patch({ doc })}
        onRetry={() => void documents.refetch()}
        onClearFilters={clearFilters}
      />

      {search.doc ? (
        <DocumentDrawer
          doc={opened.data}
          isPending={opened.isPending}
          error={opened.error}
          pending={actions.pending}
          returnFocusTo={search.doc}
          onClose={() => patch({ doc: undefined })}
          onConfirm={() => actions.confirm.mutate()}
          onReject={() => actions.reject.mutate()}
          onRetry={() => actions.retry.mutate()}
          onCorrect={(field, value) => actions.correct.mutate({ field, value })}
        />
      ) : null}

      <nav className="flex items-center gap-4 py-3 text-ink-muted" aria-label="Pagination">
        <span aria-live="polite">
          {total === 0
            ? 'No documents'
            : `Rows ${count(first)}–${count(Math.min(first + PAGE_SIZE - 1, total))} of ${count(total)}`}
        </span>
        <span className="flex-1" />
        <button
          type="button"
          className="border border-field px-3 py-1.5 disabled:opacity-50"
          disabled={search.page <= 1}
          onClick={() => patch({ page: search.page - 1 })}
        >
          Previous
        </button>
        <button
          type="button"
          className="border border-field px-3 py-1.5 disabled:opacity-50"
          disabled={search.page >= pages}
          onClick={() => patch({ page: search.page + 1 })}
        >
          Next
        </button>
      </nav>

      {sim.sim ? (
        <DevPanel
          sim={sim.sim}
          onChange={(next) => sim.set.mutate(next)}
          onReset={() => sim.reset.mutate()}
        />
      ) : null}
    </main>
  );
}
