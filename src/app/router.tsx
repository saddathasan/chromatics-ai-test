/**
 * Route tree and app-wide providers. Routes are defined in code rather than generated from
 * files: this prototype has one screen plus a drawer, so a codegen step would be pure overhead.
 */
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import {
  createRootRoute,
  createRoute,
  createRouter,
  Outlet,
  RouterProvider,
} from '@tanstack/react-router';
import { Dashboard } from '../features/dashboard/Dashboard';
import { UploadButton } from '../features/upload/UploadButton';
import { parseDocumentSearch } from './search';

/** Retries are the mock backend's job to trigger; a failed read shows its error state instead. */
const queryClient = new QueryClient({
  defaultOptions: { queries: { retry: 1, staleTime: 2_000 } },
});

const rootRoute = createRootRoute({
  component: () => (
    <div className="min-h-dvh">
      <header className="mx-auto flex max-w-[1360px] flex-wrap items-baseline gap-4 border-b border-rule px-6 pt-6 pb-4">
        <h1 className="text-lg font-semibold">Archive digitisation</h1>
        <span className="text-[11px] text-ink-muted">Alo Relief Trust</span>
        <span className="flex-1" />
        <UploadButton />
      </header>
      <Outlet />
    </div>
  ),
});

const dashboardRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/',
  validateSearch: parseDocumentSearch,
  component: Dashboard,
});

const router = createRouter({ routeTree: rootRoute.addChildren([dashboardRoute]) });

declare module '@tanstack/react-router' {
  interface Register {
    router: typeof router;
  }
}

/** Mounts the router inside the query cache; the single entry point `main.tsx` renders. */
export function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <RouterProvider router={router} />
    </QueryClientProvider>
  );
}
