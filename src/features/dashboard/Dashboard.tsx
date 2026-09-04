/**
 * The operations screen: batch statistics, filters and the document table.
 * Milestone 4 builds the real thing; for now it proves the mock backend answers in the browser.
 */
import { useQuery } from '@tanstack/react-query';
import { useSearch } from '@tanstack/react-router';
import { api } from '../../api/client';

export function Dashboard() {
  const search = useSearch({ from: '/' });
  const batch = useQuery({ queryKey: ['batch', 'batch_archive'], queryFn: () => api.getBatch('batch_archive') });
  const documents = useQuery({
    queryKey: ['documents', search],
    queryFn: () => api.listDocuments({ ...search, pageSize: 10 }),
  });

  if (batch.isPending || documents.isPending) return <main className="p-6 text-sm">Loading…</main>;
  if (batch.error || documents.error)
    return <main className="p-6 text-sm text-red-700">{String(batch.error ?? documents.error)}</main>;

  return (
    <main className="space-y-4 p-6 text-sm">
      <p className="text-neutral-600">
        {batch.data!.counts.total.toLocaleString()} documents ·{' '}
        {batch.data!.counts.completed.toLocaleString()} completed ·{' '}
        {batch.data!.counts.processing.toLocaleString()} processing ·{' '}
        {batch.data!.counts.queued.toLocaleString()} queued ·{' '}
        {batch.data!.counts.failed.toLocaleString()} failed ·{' '}
        {batch.data!.counts.needsReview.toLocaleString()} need review
      </p>
      <ul className="space-y-1">
        {documents.data!.items.map((doc) => (
          <li key={doc.id} className="flex gap-3">
            <span className="w-64 truncate">{doc.fileName}</span>
            <span className="text-neutral-500">{doc.status}</span>
            <span className="text-neutral-400">{doc.reviewStatus}</span>
          </li>
        ))}
      </ul>
      <p className="text-neutral-400">
        Page {documents.data!.page} of {Math.ceil(documents.data!.total / documents.data!.pageSize)}
      </p>
    </main>
  );
}
