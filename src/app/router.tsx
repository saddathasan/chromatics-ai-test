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
import { parseDocumentSearch } from './search';

/** Retries are the mock backend's job to trigger; a failed read shows its error state instead. */
const queryClient = new QueryClient({
  defaultOptions: { queries: { retry: 1, staleTime: 2_000 } },
});

const rootRoute = createRootRoute({
  component: () => (
    <div className="min-h-dvh bg-neutral-50 text-neutral-900">
      <header className="border-b border-neutral-200 bg-white px-6 py-3">
        <h1 className="text-sm font-semibold">Document Processing</h1>
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
