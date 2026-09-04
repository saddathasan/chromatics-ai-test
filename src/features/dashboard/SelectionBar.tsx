/**
 * What can be done to more than one document at once. It appears only when rows are selected,
 * and it is deliberately blunt about the difference between the two acts it offers: retrying
 * the rows you picked, and retrying every failure the current filter reaches.
 */
import { count } from '../../lib/format';

type Props = {
  selected: number;
  /** Of those selected, how many the transition table would actually accept a retry for. */
  retryable: number;
  hasFilters: boolean;
  pending: boolean;
  onRetrySelected: () => void;
  onRetryMatching: () => void;
  onClear: () => void;
};

const BTN = 'border border-field px-3 py-1.5 disabled:opacity-50';

export function SelectionBar({
  selected,
  retryable,
  hasFilters,
  pending,
  onRetrySelected,
  onRetryMatching,
  onClear,
}: Props) {
  return (
    <div
      // Assertive would interrupt; the bar appearing is already the signal.
      aria-live="polite"
      className="flex flex-wrap items-center gap-3 border-b border-rule bg-tint-selected px-3 py-2"
    >
      <strong>{count(selected)} selected</strong>

      {retryable > 0 ? (
        <button type="button" className={BTN} disabled={pending} onClick={onRetrySelected}>
          Retry {count(retryable)} selected
        </button>
      ) : (
        /* Naming the reason rather than showing a dead button: a completed document and a
           dead-end failure are both un-retryable, and neither is a bug the operator caused. */
        <span className="text-[13px] text-ink-muted">
          None of these can be retried — they are either finished or need a fresh capture.
        </span>
      )}

      {/*
       * No count is promised here on purpose. The endpoint retries retryable failures only, and
       * the number of documents matching the filter is not that number - the archive has no
       * count of "retryable failures within an arbitrary filter" to ask for. The result says
       * how many actually moved, which is the honest version.
       */}
      <button type="button" className={BTN} disabled={pending} onClick={onRetryMatching}>
        Retry every failure {hasFilters ? 'matching these filters' : 'in the whole archive'}
      </button>

      <span className="flex-1" />
      <button
        type="button"
        className="underline underline-offset-[3px] disabled:opacity-50"
        disabled={pending}
        onClick={onClear}
      >
        Clear selection
      </button>
    </div>
  );
}
