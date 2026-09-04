/**
 * The write side. Every review action shares one invalidation rule, because they all move the
 * same three things: the document itself, the page it sits on, and the batch counts above it.
 */
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from './client';
import { transition } from '../domain/transitions';
import type { Document, NormalizedRecord } from '../domain/types';

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

  const settle = () => {
    void client.invalidateQueries({ queryKey: ['documents'] });
    void client.invalidateQueries({ queryKey: ['batches'] });
    void client.invalidateQueries({ queryKey: ['document', id] });
  };

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
