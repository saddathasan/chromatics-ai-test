/**
 * Read-side React Query hooks and the one rule that governs them: poll only while the archive
 * is actually moving. A dashboard that polls a finished batch forever is the easiest way to
 * make a 100,000-document prototype feel broken.
 */
import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { api } from './client';
import type { DocumentSearch } from '../app/search';
import type { Batch } from '../domain/types';

export const PAGE_SIZE = 50;

/**
 * The refetch interval, as TanStack Query wants it: a number to keep polling, `false` to stop.
 * Undefined batches mean the first load has not answered yet - stopping there would strand the
 * dashboard on a blank screen, so we keep asking.
 */
export function pollInterval(batches: Batch[] | undefined, ms: number): number | false {
  if (!batches) return ms;
  return batches.some((b) => b.counts.queued + b.counts.processing > 0) ? ms : false;
}

/**
 * Every batch, which is also where the headline counts, the chips and the batch filter come
 * from. One query answers all four rather than four queries answering one each.
 */
export function useBatches() {
  return useQuery({
    queryKey: ['batches'],
    queryFn: api.listBatches,
    // refetchIntervalInBackground defaults to false, so a hidden tab pauses without our help.
    refetchInterval: ({ state }) => pollInterval(state.data, 2_000),
  });
}

/**
 * A page of documents for the current URL state. `keepPreviousData` holds the old page on
 * screen while the next one loads, so paging and filtering never flash an empty table.
 */
export function useDocuments(search: DocumentSearch, batches: Batch[] | undefined) {
  return useQuery({
    queryKey: ['documents', search],
    queryFn: () =>
      api.listDocuments({
        q: search.q,
        status: search.status,
        review: search.review,
        type: search.type,
        batch: search.batch,
        sort: search.sort,
        page: search.page,
        pageSize: PAGE_SIZE,
      }),
    placeholderData: keepPreviousData,
    refetchInterval: () => pollInterval(batches, 3_000),
  });
}
