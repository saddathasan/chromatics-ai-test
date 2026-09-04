/**
 * What the operator can do about this document, and nothing they cannot. Availability is read
 * from `can()` in the transition table rather than restated here, so the UI can never offer a
 * move the server would answer with a 409.
 */
import { can } from '../../domain/transitions';
import type { Document } from '../../domain/types';

type Props = {
  doc: Document;
  /** A mutation is in flight; every action is blocked rather than queued behind it. */
  pending: boolean;
  onConfirm: () => void;
  onReject: () => void;
  onRetry: () => void;
};

const BTN = 'border border-field px-3 py-1.5 min-h-8 disabled:opacity-50';

export function ReviewActions({ doc, pending, onConfirm, onReject, onRetry }: Props) {
  const confirmable = can(doc, 'confirm');
  const rejectable = can(doc, 'reject');
  const retryable = can(doc, 'retry');
  const nothingToDo = !confirmable && !rejectable && !retryable;

  return (
    <div className="border-t border-rule-strong bg-paper-sunk px-6 py-3">
      {doc.error ? (
        <p className="mb-3 text-[11px] text-ink-muted">
          <span className="text-failed">{doc.error.message}</span>{' '}
          {doc.error.retryable
            ? 'A timeout or an unavailable service is a fault in the pipeline, not in the paper — the scan is intact and another attempt may succeed.'
            : 'This cannot be retried: the file itself is the problem. Replace the file with a fresh capture and upload it again.'}
        </p>
      ) : null}

      {nothingToDo ? (
        <p className="text-[11px] text-ink-muted">
          {doc.reviewStatus === 'confirmed'
            ? 'Confirmed by a person. Nothing further to decide.'
            : doc.reviewStatus === 'rejected'
              ? 'Rejected. This document needs a fresh capture.'
              : 'No review needed — every field was read cleanly.'}
        </p>
      ) : (
        <div className="flex flex-wrap gap-2">
          {confirmable ? (
            <button
              type="button"
              disabled={pending}
              className={`${BTN} border-ink bg-ink font-medium text-paper`}
              onClick={onConfirm}
            >
              Confirm
            </button>
          ) : null}
          {retryable ? (
            <button type="button" disabled={pending} className={BTN} onClick={onRetry}>
              Retry
            </button>
          ) : null}
          <span className="flex-1" />
          {rejectable ? (
            <button type="button" disabled={pending} className={BTN} onClick={onReject}>
              Reject
            </button>
          ) : null}
        </div>
      )}
    </div>
  );
}
