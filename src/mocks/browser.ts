/**
 * Starts the mock backend in the browser. Imported dynamically from `main.tsx` so the whole
 * mock layer is tree-shaken out of a production build.
 */
import { setupWorker } from 'msw/browser';
import { handlers } from './handlers';
import { initStore } from './store';

/** Resolves once the archive exists and the worker is intercepting; render waits on it. */
export async function startMockBackend(): Promise<void> {
  await initStore();
  await setupWorker(...handlers).start({
    onUnhandledRequest: 'bypass',
    quiet: true,
  });
}
