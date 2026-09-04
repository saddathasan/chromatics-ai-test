/**
 * The per-file queue. A folder drop can be tens of thousands of rows, so only the visible
 * window is rendered - and the queue carries its own filter, because a wall of file names you
 * cannot search is not a status display.
 */
import { useMemo, useState } from 'react';
import { count } from '../../lib/format';
import type { QueueItem, QueueState } from './queue';

/**
 * Fixed row height, which is what makes the window a subtraction rather than a measurement.
 * ponytail: uniform rows only; a list with variable heights needs a real virtualizer.
 */
const ROW = 26;
const VIEWPORT = 260;
const OVERSCAN = 4;

const STATE_LABEL: Record<QueueState, string> = {
  pending: 'waiting',
  uploading: 'uploading',
  done: 'uploaded',
  failed: 'failed',
};

const STATE_COLOUR: Record<QueueState, string> = {
  pending: 'text-queued',
  uploading: 'text-processing',
  done: 'text-completed',
  failed: 'text-failed',
};

export function QueueList({ items }: { items: QueueItem[] }) {
  const [filter, setFilter] = useState('');
  const [failedOnly, setFailedOnly] = useState(false);
  const [scrollTop, setScrollTop] = useState(0);

  const failed = items.reduce((n, item) => n + (item.state === 'failed' ? 1 : 0), 0);

  // Seven failures scattered through six hundred rows are unfindable by scrolling, and the
  // name filter cannot help - the operator does not know which names failed.
  const shown = useMemo(() => {
    const needle = filter.trim().toLowerCase();
    if (!needle && !failedOnly) return items;
    return items.filter(
      (item) =>
        (!failedOnly || item.state === 'failed') &&
        (!needle || item.name.toLowerCase().includes(needle)),
    );
  }, [items, filter, failedOnly]);

  const first = Math.max(0, Math.floor(scrollTop / ROW) - OVERSCAN);
  const last = Math.min(shown.length, first + Math.ceil(VIEWPORT / ROW) + OVERSCAN * 2);
  const window = shown.slice(first, last);

  return (
    <section className="border-t border-rule pt-3">
      <div className="flex items-baseline gap-3 pb-2">
        <h4 className="text-[13px] font-semibold">Queue</h4>
        <span className="text-[11px] text-ink-muted">
          {count(shown.length)}
          {shown.length === items.length ? ' files' : ` of ${count(items.length)} files`}
        </span>
        <span className="flex-1" />
        {failed > 0 ? (
          <label className="flex items-center gap-1.5 text-[12px]">
            <input
              type="checkbox"
              checked={failedOnly}
              onChange={(event) => {
                setFailedOnly(event.target.checked);
                setScrollTop(0);
              }}
            />
            Failed only ({count(failed)})
          </label>
        ) : null}
        <input
          type="search"
          aria-label="Filter the queue by file name"
          placeholder="Filter by name"
          value={filter}
          onChange={(event) => {
            setFilter(event.target.value);
            setScrollTop(0);
          }}
          className="border border-field px-2 py-1 text-[13px]"
        />
      </div>

      <div
        role="grid"
        aria-label="Upload queue"
        aria-rowcount={shown.length}
        onScroll={(event) => setScrollTop(event.currentTarget.scrollTop)}
        style={{ height: VIEWPORT }}
        className="overflow-y-auto border border-rule bg-paper-sunk"
      >
        <div style={{ height: shown.length * ROW, position: 'relative' }}>
          {window.map((item, index) => (
            <div
              key={item.key}
              role="row"
              aria-rowindex={first + index + 1}
              style={{ position: 'absolute', top: (first + index) * ROW, height: ROW }}
              className="flex w-full items-center gap-3 px-2 text-[12px]"
            >
              <span role="gridcell" className="flex-1 truncate font-mono">
                {item.name}
              </span>
              <span role="gridcell" className={`shrink-0 ${STATE_COLOUR[item.state]}`}>
                {STATE_LABEL[item.state]}
                {item.state === 'failed' && item.attempts > 0 ? ' after retry' : ''}
              </span>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
