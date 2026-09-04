/**
 * The upload engine: transfer-free, React-free, so concurrency and retry can be tested without
 * a DOM or a server. The caller supplies how a file is sent and how a transferred chunk is
 * posted; this decides how many run at once, what happens when one fails, and when to flush.
 */

export type QueueState = 'pending' | 'uploading' | 'done' | 'failed';

/** One file's place in the upload. Mutated in place - the UI reads it, the engine owns it. */
export type QueueItem = {
  key: string;
  name: string;
  size: number;
  mimeType: string;
  state: QueueState;
  attempts: number;
};

export type QueueOptions = {
  concurrency: number;
  /** Files are registered with the server in chunks; one request per file at 100k is absurd. */
  chunkSize: number;
  backoffMs: number;
  send: (item: QueueItem) => Promise<void>;
  flush: (batch: QueueItem[]) => Promise<void>;
  onProgress: () => void;
  signal: AbortSignal;
};

/** One retry. A transfer that fails twice is a bad file, and hammering it just hides that. */
const MAX_RETRIES = 1;

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * Runs the queue to completion, or to cancellation. Cancelling stops new files being pulled;
 * whatever already transferred is still posted, which is what the dialog's warning promises.
 */
export async function runQueue(items: QueueItem[], options: QueueOptions): Promise<void> {
  let cursor = 0;
  const transferred: QueueItem[] = [];

  const flush = async (force: boolean) => {
    while (transferred.length >= options.chunkSize || (force && transferred.length > 0)) {
      await options.flush(transferred.splice(0, options.chunkSize));
    }
  };

  const worker = async () => {
    while (cursor < items.length && !options.signal.aborted) {
      const item = items[cursor++];
      item.state = 'uploading';
      options.onProgress();

      for (;;) {
        try {
          await options.send(item);
          item.state = 'done';
          transferred.push(item);
          break;
        } catch {
          if (item.attempts >= MAX_RETRIES) {
            item.state = 'failed';
            break;
          }
          item.attempts++;
          await sleep(options.backoffMs * item.attempts);
        }
      }

      options.onProgress();
      await flush(false);
    }
  };

  await Promise.all(Array.from({ length: options.concurrency }, worker));
  await flush(true);
  options.onProgress();
}

/**
 * The simulated transfer. Latency and failure are derived from the file's own key so a given
 * selection behaves the same on every run - a demo that fails a different file each time is
 * impossible to talk about.
 */
export function simulatedSend(failureRate = 0.02) {
  return async (item: QueueItem) => {
    let hash = 0;
    for (let i = 0; i < item.key.length; i++) hash = (hash * 31 + item.key.charCodeAt(i)) >>> 0;
    await sleep(15 + (hash % 45));
    if ((hash % 1000) / 1000 < failureRate) throw new Error('Transfer failed');
  };
}
