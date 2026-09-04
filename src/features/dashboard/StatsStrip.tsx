/**
 * The two answers the dashboard exists to give, above everything else: how much is left, and
 * what needs attention now. Every count here is a filter button rather than a read-only tile -
 * a number an operator cannot act on has been deleted (docs/design/direction.md §6).
 */
import { ago, count, duration } from '../../lib/format';
import type { DocumentSearch } from '../../app/search';
import type { Batch, DocumentStatus, ReviewStatus } from '../../domain/types';

type Chip = {
  key: string;
  glyph?: string;
  label: string;
  of: (c: Batch['counts']) => number;
  status?: DocumentStatus[];
  review?: ReviewStatus[];
  className?: string;
};

/**
 * Chips filter on the axes the API actually has (status and review), not on the derived lane.
 * A chip that promised a lane filter would be writing a query the server cannot answer; the
 * lane stays a per-row reading in the table instead.
 */
const CHIPS: Chip[] = [
  { key: 'all', label: 'All', of: (c) => c.total },
  {
    key: 'in_flight',
    glyph: '▸',
    label: 'In flight',
    of: (c) => c.queued + c.processing,
    status: ['queued', 'processing'],
    className: 'text-processing',
  },
  {
    key: 'needs_review',
    glyph: '!',
    label: 'Needs review',
    of: (c) => c.needsReview,
    review: ['needs_review'],
    className: 'text-attention',
  },
  {
    key: 'failed',
    glyph: '✕',
    label: 'Failed',
    of: (c) => c.failed,
    status: ['failed'],
    className: 'text-failed',
  },
  {
    key: 'completed',
    glyph: '✓',
    label: 'Completed',
    of: (c) => c.completed,
    status: ['completed'],
    className: 'text-completed',
  },
];

const same = (a: string[] | undefined, b: string[] | undefined) =>
  (a ?? []).join() === (b ?? []).join();

type Props = {
  batches: Batch[];
  /** When the batch query last answered, so the strip can say how fresh these numbers are. */
  updatedAt: number;
  /** Completed-count deltas observed across polls; the sparkline is this session's own trace. */
  samples: number[];
  search: DocumentSearch;
  onFilter: (next: Partial<DocumentSearch>) => void;
};

/**
 * A stroke, no fill and no axes - it answers "is throughput holding?" and nothing else, so a
 * charting library would be ~100kB for one polyline.
 * ponytail: sampled client-side, so it resets on reload. Add a history endpoint if it must persist.
 */
function Sparkline({ samples }: { samples: number[] }) {
  if (samples.length < 2) return null;
  const peak = Math.max(...samples, 1);
  const step = 132 / (samples.length - 1);
  const points = samples.map((v, i) => `${(i * step).toFixed(1)},${(24 - (v / peak) * 22).toFixed(1)}`);
  return (
    <svg
      width="132"
      height="26"
      viewBox="0 0 132 26"
      role="img"
      aria-label={`Completed per poll over the last ${samples.length} updates, peaking at ${count(peak)}`}
    >
      <polyline points={points.join(' ')} fill="none" stroke="currentColor" strokeWidth="1.5" />
    </svg>
  );
}

export function StatsStrip({ batches, updatedAt, samples, search, onFilter }: Props) {
  const totals = batches.reduce(
    (acc, b) => {
      for (const key of Object.keys(acc) as (keyof Batch['counts'])[]) acc[key] += b.counts[key];
      return acc;
    },
    {
      queued: 0,
      processing: 0,
      completed: 0,
      failed: 0,
      needsReview: 0,
      confirmed: 0,
      rejected: 0,
      total: 0,
    }
  );

  const inFlight = totals.queued + totals.processing;
  const throughput = batches.reduce((sum, b) => sum + b.throughputPerSec, 0);
  const eta = inFlight > 0 && throughput > 0 ? Math.round(inFlight / throughput) : null;
  // "Live" means the numbers are still moving; a drained archive is idle, not stale.
  const live = inFlight > 0;

  return (
    <>
      <div className="flex flex-wrap items-end gap-6 border-b border-rule py-6">
        <div>
          <h2 className="text-[clamp(24px,2.2vw,32px)]/[1.2] font-semibold">
            {count(totals.completed)}{' '}
            <span className="font-normal text-ink-muted">of {count(totals.total)} processed</span>
          </h2>
          <div className="text-[11px] text-ink-muted">
            {batches.length === 1 ? batches[0].name : `${batches.length} batches`}
          </div>
        </div>

        <dl className="ml-auto flex flex-wrap items-end gap-6">
          <div>
            <dt className="text-xs uppercase tracking-[0.06em] text-ink-muted">Throughput</dt>
            <dd className="font-semibold">{Math.round(throughput)}/s</dd>
          </div>
          <div>
            <dt className="text-xs uppercase tracking-[0.06em] text-ink-muted">Remaining</dt>
            <dd className="font-semibold">
              {eta === null ? 'Nothing in flight' : `about ${duration(eta)}`}
            </dd>
          </div>
          <div className="text-rule-strong">
            <dt className="text-xs uppercase tracking-[0.06em] text-ink-muted">Last updates</dt>
            <dd>
              <Sparkline samples={samples} />
            </dd>
          </div>
          <div>
            <dt className="text-xs uppercase tracking-[0.06em] text-ink-muted">Feed</dt>
            {/* Polite, not assertive: freshness is reassurance, never an interruption. */}
            <dd aria-live="polite" className="font-semibold text-processing">
              {live ? 'Live' : 'Idle'} · updated {ago(new Date(updatedAt).toISOString())}
            </dd>
          </div>
        </dl>
      </div>

      <div className="flex flex-wrap border-b border-rule" role="group" aria-label="Filter by state">
        {CHIPS.map((chip) => {
          const active = same(chip.status, search.status) && same(chip.review, search.review);
          return (
            <button
              key={chip.key}
              type="button"
              aria-pressed={active}
              className={`flex items-baseline gap-2 whitespace-nowrap border-b-2 px-4 pt-3 pb-2.5 first:pl-0 hover:bg-paper-hover ${
                active ? 'border-ink font-semibold' : 'border-transparent'
              } ${chip.className ?? ''}`}
              onClick={() =>
                onFilter({ status: chip.status, review: chip.review, page: 1 })
              }
            >
              {chip.glyph ? (
                <span aria-hidden="true" className="font-mono">
                  {chip.glyph}
                </span>
              ) : null}
              <span>{chip.label}</span>
              <span>{count(chip.of(totals))}</span>
            </button>
          );
        })}
      </div>
    </>
  );
}
