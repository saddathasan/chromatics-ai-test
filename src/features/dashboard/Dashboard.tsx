/**
 * The operations screen: batch statistics, filters and the document table.
 * A placeholder until Milestone 4 fills it; it exists now so the route tree is real.
 */
import { useSearch } from '@tanstack/react-router';

export function Dashboard() {
  const search = useSearch({ from: '/' });
  return (
    <main className="p-6">
      <p className="text-sm text-neutral-600">
        Showing page {search.page}
        {search.status ? ` filtered to ${search.status.join(', ')}` : ''}.
      </p>
    </main>
  );
}
