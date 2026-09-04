/**
 * The operations screen. Owns the wiring only - URL state in, query state out, selection and
 * the sparkline's sample history in local state. Everything visible belongs to a child, so the
 * pieces stay testable without a router.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useSearch } from '@tanstack/react-router';
import { PAGE_SIZE, useBatches, useDocuments } from '../../api/queries';
import { count } from '../../lib/format';
import { DocumentsTable } from './DocumentsTable';
import { FilterBar } from './FilterBar';
import { StatsStrip } from './StatsStrip';
import type { DocumentSearch } from '../../app/search';

/** Enough trace to see a trend, short enough that one stall does not flatten the whole line. */
const MAX_SAMPLES = 24;

export function Dashboard() {
  const search = useSearch({ from: '/' });
  const navigate = useNavigate({ from: '/' });
  const batches = useBatches();
  const documents = useDocuments(search, batches.data);

  const patch = useCallback(
    (next: Partial<DocumentSearch>) => {
      void navigate({ search: (prev) => ({ ...prev, ...next }) });
    },
    [navigate]
  );

  const completed = useMemo(
    () => (batches.data ?? []).reduce((sum, b) => sum + b.counts.completed, 0),
    [batches.data]
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
    [patch]
  );

  const hasFilters = Boolean(
    search.q || search.status?.length || search.review?.length || search.type?.length || search.batch
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

      <DocumentsTable
        docs={documents.data?.items ?? []}
        isPending={documents.isPending}
        error={documents.error}
        hasFilters={hasFilters}
        sort={search.sort}
        onSort={(sort) => patch({ sort, page: 1 })}
        onOpen={(doc) => patch({ doc })}
        onRetry={() => void documents.refetch()}
        onClearFilters={clearFilters}
      />

      <nav className="flex items-center gap-4 py-3 pb-12 text-ink-muted" aria-label="Pagination">
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
    </main>
  );
}
