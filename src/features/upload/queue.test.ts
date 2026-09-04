import { describe, expect, it, vi } from 'vitest';
import { runQueue, type QueueItem } from './queue';

const items = (n: number): QueueItem[] =>
  Array.from({ length: n }, (_, i) => ({
    key: `k${i}`,
    name: `file-${i}.pdf`,
    size: 100,
    mimeType: 'application/pdf',
    state: 'pending',
    attempts: 0,
  }));

const options = (over: Partial<Parameters<typeof runQueue>[1]> = {}) => ({
  concurrency: 4,
  chunkSize: 500,
  backoffMs: 0,
  send: async () => {},
  flush: async () => {},
  onProgress: () => {},
  signal: new AbortController().signal,
  ...over,
});

describe('runQueue', () => {
  it('keeps exactly `concurrency` transfers in flight', async () => {
    let live = 0;
    let peak = 0;
    await runQueue(
      items(40),
      options({
        send: async () => {
          peak = Math.max(peak, ++live);
          await new Promise((r) => setTimeout(r, 1));
          live--;
        },
      })
    );
    expect(peak).toBe(4);
  });

  it('retries a failed transfer once, then gives up and marks it failed', async () => {
    const attemptsSeen: number[] = [];
    const queue = items(1);
    await runQueue(
      queue,
      options({
        send: async (item: QueueItem) => {
          attemptsSeen.push(item.attempts);
          throw new Error('network');
        },
      })
    );
    expect(attemptsSeen).toEqual([0, 1]);
    expect(queue[0]).toMatchObject({ state: 'failed', attempts: 1 });
  });

  it('succeeds on the retry when the second attempt goes through', async () => {
    const queue = items(1);
    let first = true;
    await runQueue(
      queue,
      options({
        send: async () => {
          if (first) {
            first = false;
            throw new Error('network');
          }
        },
      })
    );
    expect(queue[0].state).toBe('done');
  });

  it('posts transferred files in chunks, so 1,001 files are three requests', async () => {
    const flush = vi.fn(async () => {});
    await runQueue(items(1001), options({ flush }));
    expect(flush).toHaveBeenCalledTimes(3);
    expect(flush.mock.calls.map((c) => (c[0] as QueueItem[]).length)).toEqual([500, 500, 1]);
  });

  it('never posts a file that failed to transfer', async () => {
    const flush = vi.fn(async () => {});
    await runQueue(
      items(4),
      options({
        flush,
        send: async (item: QueueItem) => {
          if (item.key === 'k2') throw new Error('network');
        },
      })
    );
    expect(flush.mock.calls[0][0].map((i: QueueItem) => i.key)).not.toContain('k2');
    expect(flush.mock.calls[0][0]).toHaveLength(3);
  });

  it('stops pulling work once cancelled, and still posts what already transferred', async () => {
    const control = new AbortController();
    const flush = vi.fn(async () => {});
    const queue = items(100);
    await runQueue(
      queue,
      options({
        signal: control.signal,
        flush,
        send: async () => {
          if (queue.filter((i) => i.state === 'done').length >= 8) control.abort();
          await new Promise((r) => setTimeout(r, 0));
        },
      })
    );
    const done = queue.filter((i) => i.state === 'done').length;
    expect(done).toBeGreaterThan(0);
    expect(done).toBeLessThan(100);
    expect(flush).toHaveBeenCalledTimes(1);
    expect(flush.mock.calls[0][0]).toHaveLength(done);
  });
});
