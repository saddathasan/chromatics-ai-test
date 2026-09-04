/**
 * Persistence for the mock backend's mutable half. The 100,000-document base archive is
 * regenerated from its seed on every load, so only human decisions, retries and uploaded
 * batches are written here — a few hundred records rather than a database.
 */
import { del, get, set } from 'idb-keyval';

const KEY = 'chromatics.overlay.v1';

/** IndexedDB is absent under the test runner and in private-mode edge cases; both degrade to memory. */
const available = () => typeof indexedDB !== 'undefined';

export async function loadOverlay<T>(): Promise<T | undefined> {
  if (!available()) return undefined;
  try {
    return await get<T>(KEY);
  } catch {
    return undefined;
  }
}

export async function saveOverlay<T>(value: T): Promise<void> {
  if (!available()) return;
  try {
    await set(KEY, value);
  } catch {
    // A failed write costs the reviewer their session history, never correctness.
  }
}

export async function clearOverlay(): Promise<void> {
  if (!available()) return;
  try {
    await del(KEY);
  } catch {
    /* nothing to clear */
  }
}
