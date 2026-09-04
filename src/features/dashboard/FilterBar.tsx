/**
 * Search, type and batch filters, bound to the URL rather than to component state so a view is
 * shareable and the back button undoes a filter. Presentational on purpose: it reports the change
 * it wants and the Dashboard does the navigating, which keeps it testable without a router.
 */
import { useEffect, useState } from 'react';
import type { DocumentSearch } from '../../app/search';
import type { DocumentType } from '../../domain/types';

/** Long enough that a typed word is one request, short enough to feel immediate. */
const DEBOUNCE_MS = 300;

const TYPES: { value: DocumentType; label: string }[] = [
  { value: 'enrollment', label: 'Enrollment' },
  { value: 'medical_intake', label: 'Medical intake' },
  { value: 'id_scan', label: 'ID scan' },
  { value: 'handwritten_note', label: 'Handwritten note' },
  { value: 'unknown', label: 'Unknown' },
];

type Props = {
  search: DocumentSearch;
  batches: { id: string; name: string }[];
  onChange: (next: Partial<DocumentSearch>) => void;
};

const CONTROL = 'border border-field bg-paper px-2 py-1.5 min-h-8';

export function FilterBar({ search, batches, onChange }: Props) {
  const [q, setQ] = useState(search.q ?? '');

  // Debounced, and silent when the value already matches the URL - otherwise mounting the
  // component would immediately navigate, and every filter change would fire a second request.
  useEffect(() => {
    const next = q.trim() || undefined;
    if (next === search.q) return;
    const timer = setTimeout(() => onChange({ q: next, page: 1 }), DEBOUNCE_MS);
    return () => clearTimeout(timer);
  }, [q, search.q, onChange]);

  const filtered = Boolean(
    search.q ||
    search.status?.length ||
    search.review?.length ||
    search.type?.length ||
    search.batch,
  );

  return (
    <div className="flex min-h-14 flex-wrap items-center gap-2 border-b border-rule py-3">
      <label className="sr-only" htmlFor="filter-q">
        Search file name
      </label>
      <input
        id="filter-q"
        type="search"
        className={`${CONTROL} min-w-[min(280px,100%)]`}
        placeholder="File name…"
        value={q}
        onChange={(e) => setQ(e.target.value)}
      />

      <label className="sr-only" htmlFor="filter-type">
        Document type
      </label>
      <select
        id="filter-type"
        className={CONTROL}
        value={search.type?.[0] ?? ''}
        onChange={(e) =>
          onChange({ type: e.target.value ? [e.target.value as DocumentType] : undefined, page: 1 })
        }
      >
        <option value="">All types</option>
        {TYPES.map((t) => (
          <option key={t.value} value={t.value}>
            {t.label}
          </option>
        ))}
      </select>

      <label className="sr-only" htmlFor="filter-batch">
        Batch
      </label>
      <select
        id="filter-batch"
        className={CONTROL}
        value={search.batch ?? ''}
        onChange={(e) => onChange({ batch: e.target.value || undefined, page: 1 })}
      >
        <option value="">All batches</option>
        {batches.map((b) => (
          <option key={b.id} value={b.id}>
            {b.name}
          </option>
        ))}
      </select>

      {filtered ? (
        <button
          type="button"
          className="text-ink-muted underline underline-offset-[3px] hover:text-ink"
          onClick={() =>
            onChange({
              q: undefined,
              status: undefined,
              review: undefined,
              type: undefined,
              batch: undefined,
              page: 1,
            })
          }
        >
          Clear
        </button>
      ) : null}
    </div>
  );
}
