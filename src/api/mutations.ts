/**
 * The write side. Every review action shares one invalidation rule, because they all move the
 * same three things: the document itself, the page it sits on, and the batch counts above it.
 */
import { useMutation, useQuery, useQueryClient, type QueryClient } from '@tanstack/react-query';
import { api, type ListParams, type SimState } from './client';
import { transition } from '../domain/transitions';
import type { Document, NormalizedRecord } from '../domain/types';

/**
 * Every write moves the same two things: the page of documents on screen, and the counts above
 * it. Exported so the rule is stated once and can be asserted, rather than being three
 * copy-pasted invalidate calls that drift apart.
 */
export function invalidateAfterWrite(client: QueryClient, documentId?: string): void {
  void client.invalidateQueries({ queryKey: ['documents'] });
  void client.invalidateQueries({ queryKey: ['batches'] });
  if (documentId) void client.invalidateQueries({ queryKey: ['document', documentId] });
}

/** One document, fresh. The drawer can be deep-linked, so it cannot rely on the list page. */
export function useDocument(id: string | undefined) {
  return useQuery({
    queryKey: ['document', id],
    queryFn: () => api.getDocument(id!),
    enabled: Boolean(id),
  });
}

export function useDocumentMutations(id: string | undefined) {
  const client = useQueryClient();

  const settle = () => invalidateAfterWrite(client, id);

  const confirm = useMutation({ mutationFn: () => api.confirm(id!), onSettled: settle });
  const reject = useMutation({ mutationFn: () => api.reject(id!), onSettled: settle });
  const correct = useMutation({
    mutationFn: ({ field, value }: { field: keyof NormalizedRecord; value: string }) =>
      api.correct(id!, field, value),
    onSettled: settle,
  });

  const retry = useMutation({
    mutationFn: () => api.retry(id!),
    /**
     * Optimistic: a retry is the one action with a visible queue behind it, and waiting for the
     * round trip makes the button feel broken. The predicted state comes from the same
     * transition function the server runs, so the optimistic row cannot disagree with the real
     * one - and if the guard would have thrown, nothing is written and the request still decides.
     */
    onMutate: async () => {
      await client.cancelQueries({ queryKey: ['document', id] });
      const previous = client.getQueryData<Document>(['document', id]);
      if (previous) {
        try {
          client.setQueryData(
            ['document', id],
            transition(previous, { type: 'retry', at: new Date().toISOString() }),
          );
        } catch {
          // Illegal here means illegal on the server too; let the request return the 409.
        }
      }
      return { previous };
    },
    onError: (_error, _vars, context) => {
      if (context?.previous) client.setQueryData(['document', id], context.previous);
    },
    onSettled: settle,
  });

  return {
    confirm,
    reject,
    retry,
    correct,
    pending: confirm.isPending || reject.isPending || retry.isPending || correct.isPending,
  };
}

/**
 * Bulk retry, in its two shapes. Neither is optimistic: a bulk write can touch thousands of
 * rows, and predicting all of them client-side to save one round trip is a lot of machinery
 * for a button pressed once. The server's `affected` count is the answer either way.
 */
export function useBulkRetry() {
  const client = useQueryClient();

  const selected = useMutation({
    mutationFn: async (ids: string[]) => {
      // One request per document: the API has no "retry these ids" route, and inventing one
      // in the mock would be a contract the real backend never agreed to.
      const settled = await Promise.allSettled(ids.map((id) => api.retry(id)));
      return { affected: settled.filter((r) => r.status === 'fulfilled').length };
    },
    onSettled: () => invalidateAfterWrite(client),
  });

  const matching = useMutation({
    mutationFn: (params: ListParams) => api.retryMatching(params),
    onSettled: () => invalidateAfterWrite(client),
  });

  return { selected, matching, pending: selected.isPending || matching.isPending };
}

/** The simulation dial. Reads once, writes through, and refreshes everything a change moves. */
export function useSim() {
  const client = useQueryClient();
  const query = useQuery({ queryKey: ['sim'], queryFn: api.getSim });

  const settle = (next: SimState) => {
    client.setQueryData(['sim'], next);
    invalidateAfterWrite(client);
  };

  const set = useMutation({ mutationFn: api.setSim, onSuccess: settle });
  const reset = useMutation({ mutationFn: api.resetSim, onSuccess: settle });

  return { sim: query.data, set, reset };
}
