/**
 * Persistence for the mock backend's mutable half. The 100,000-document base archive is
 * regenerated from its seed on every load, so only human decisions, retries and uploaded
 * batches are written here — a few hundred records rather than a database.
 */
import { del, get, set } from 'idb-keyval';

const KEY = 'chromatics.overlay.v1';

/** IndexedDB is absent under the test runner and in private-mode edge cases; both degrade to memory. */
const available = () => typeof indexedDB !== 'undefined';

/** Long enough for a cold database, short enough that nobody waits on a blank screen. */
const TIMEOUT_MS = 2_000;

/**
 * Every IndexedDB call goes through here, because a present database is not a working one:
 * a blocked or upgrading connection leaves the open request pending forever, and `await`ing
 * that from startup renders nothing at all. A promise that never settles cannot be caught, so
 * it has to be raced. Storage is a convenience for this mock backend - losing it costs the
 * session's overlay, while hanging on it costs the whole app.
 */
async function guard<T>(op: () => Promise<T>, fallback: T): Promise<T> {
  if (!available()) return fallback;
  try {
    return await Promise.race([
      op(),
      new Promise<T>((resolve) => setTimeout(() => resolve(fallback), TIMEOUT_MS)),
    ]);
  } catch {
    return fallback;
  }
}

export const loadOverlay = <T>(): Promise<T | undefined> =>
  guard<T | undefined>(() => get<T>(KEY), undefined);

// A failed write costs the reviewer their session history, never correctness.
export const saveOverlay = <T>(value: T): Promise<void> => guard(() => set(KEY, value), undefined);

export const clearOverlay = (): Promise<void> => guard(() => del(KEY), undefined);
