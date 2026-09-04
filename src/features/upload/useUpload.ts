/**
 * The React side of uploading: selection state, and the running queue's progress. The engine
 * in `queue.ts` does the work; this decides when the screen is allowed to hear about it.
 */
import { useCallback, useRef, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { api } from '../../api/client';
import { runQueue, simulatedSend, type QueueItem } from './queue';
import { filesFromDrop } from './traverse';
import { validate, type Skipped } from './validate';
import type { Batch } from '../../domain/types';

/** Four transfers in flight, and files registered five hundred at a time. */
const CONCURRENCY = 4;
const CHUNK_SIZE = 500;
const BACKOFF_MS = 400;

/** 20 frames a second is past the point a person can read a changing number anyway. */
const PUBLISH_MS = 50;

export type UploadPhase = 'idle' | 'uploading' | 'done' | 'cancelled' | 'error';

export type Aggregate = {
  total: number;
  settled: number;
  done: number;
  failed: number;
  ratePerSec: number;
  etaSeconds: number | null;
};

const NOTHING: Aggregate = {
  total: 0,
  settled: 0,
  done: 0,
  failed: 0,
  ratePerSec: 0,
  etaSeconds: null,
};

/** Selection: files in, validated queue items out, with the refusals kept for the summary. */
export function useFileSelection() {
  const [selection, setSelection] = useState<{ items: QueueItem[]; skipped: Skipped[] }>({
    items: [],
    skipped: [],
  });
  const [enumerating, setEnumerating] = useState<number | null>(null);

  const add = useCallback((files: File[]) => {
    setSelection((previous) => {
      const { accepted, skipped } = validate(files, previous.items);
      return {
        items: [...previous.items, ...accepted],
        skipped: [...previous.skipped, ...skipped],
      };
    });
  }, []);

  /** A dropped folder is enumerated before it is validated, and that can take a while. */
  const addFromDrop = useCallback(
    async (transfer: DataTransfer) => {
      setEnumerating(0);
      try {
        add(await filesFromDrop(transfer, setEnumerating));
      } finally {
        setEnumerating(null);
      }
    },
    [add],
  );

  const clear = useCallback(() => setSelection({ items: [], skipped: [] }), []);

  return { ...selection, enumerating, add, addFromDrop, clear };
}

export function useUploadQueue(items: QueueItem[]) {
  const client = useQueryClient();
  const [phase, setPhase] = useState<UploadPhase>('idle');
  const [batch, setBatch] = useState<Batch | undefined>();
  const [error, setError] = useState<string | undefined>();
  const [aggregate, setAggregate] = useState<Aggregate>(NOTHING);
  const control = useRef<AbortController | undefined>(undefined);
  const startedAt = useRef(0);

  /**
   * The engine mutates items in place, so progress is one throttled snapshot rather than a new
   * array per file - and the counting happens here, at most 20 times a second, instead of on
   * every render. The trailing timer matters: without it the last few files can land inside a
   * throttle window and the bar stops one short of full.
   */
  const lastPublish = useRef(0);
  const pending = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  const snapshot = useCallback((queue: QueueItem[]) => {
    let done = 0;
    let failed = 0;
    for (const item of queue) {
      if (item.state === 'done') done++;
      else if (item.state === 'failed') failed++;
    }
    const settled = done + failed;
    const seconds = Math.max(0.001, (Date.now() - startedAt.current) / 1000);
    const ratePerSec = settled / seconds;
    setAggregate({
      total: queue.length,
      settled,
      done,
      failed,
      ratePerSec,
      etaSeconds: ratePerSec > 0 ? (queue.length - settled) / ratePerSec : null,
    });
  }, []);

  const publish = useCallback(
    (queue: QueueItem[]) => {
      const elapsed = Date.now() - lastPublish.current;
      if (elapsed >= PUBLISH_MS) {
        lastPublish.current = Date.now();
        snapshot(queue);
      } else if (!pending.current) {
        pending.current = setTimeout(() => {
          pending.current = undefined;
          lastPublish.current = Date.now();
          snapshot(queue);
        }, PUBLISH_MS - elapsed);
      }
    },
    [snapshot],
  );

  const start = useCallback(
    async (name: string) => {
      const controller = new AbortController();
      control.current = controller;
      startedAt.current = Date.now();
      setPhase('uploading');
      setError(undefined);
      try {
        const created = await api.createBatch(name);
        setBatch(created);
        await runQueue(items, {
          concurrency: CONCURRENCY,
          chunkSize: CHUNK_SIZE,
          backoffMs: BACKOFF_MS,
          send: simulatedSend(),
          // Each chunk lands as real documents, so the dashboard fills while the upload runs
          // rather than jumping at the end.
          flush: async (chunk) => {
            await api.addDocuments(
              created.id,
              chunk.map((item) => ({
                clientKey: item.key,
                name: item.name,
                size: item.size,
                mimeType: item.mimeType,
              })),
            );
            void client.invalidateQueries({ queryKey: ['batches'] });
            void client.invalidateQueries({ queryKey: ['documents'] });
          },
          onProgress: () => publish(items),
          signal: controller.signal,
        });
        snapshot(items);
        setPhase(controller.signal.aborted ? 'cancelled' : 'done');
      } catch (cause) {
        setError(cause instanceof Error ? cause.message : String(cause));
        setPhase('error');
      }
    },
    [client, items, publish, snapshot],
  );

  const cancel = useCallback(() => control.current?.abort(), []);

  // Total is the selection's own, so the footer reads "0 of 3,412" before anything has started.
  return { phase, batch, error, aggregate: { ...aggregate, total: items.length }, start, cancel };
}
