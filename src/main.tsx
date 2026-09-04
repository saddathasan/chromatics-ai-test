/**
 * Browser entry point. The mock backend is imported dynamically and only in development, so
 * the whole simulation layer is tree-shaken out of a production build.
 */
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './app/router';
import './index.css';

async function main() {
  if (import.meta.env.DEV) {
    const { startMockBackend } = await import('./mocks/browser');
    // Rendering waits for the archive and the interceptor: otherwise the first fetch escapes.
    await startMockBackend();
  }
  createRoot(document.getElementById('root')!).render(
    <StrictMode>
      <App />
    </StrictMode>
  );
}

void main();
