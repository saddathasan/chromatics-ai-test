/**
 * The detail panel for one document, opened by the `doc` search param.
 *
 * Built on the native <dialog> element deliberately: showModal() gives a real focus trap, an
 * inert background, Escape-to-close and a backdrop, all of which the platform maintains and none
 * of which we have to. That decision is what let this milestone ship without a dialog library.
 */
import { useEffect, useRef } from 'react';
import { StatusMark } from '../dashboard/StatusMark';
import { lane } from '../../domain/derive';
import { count } from '../../lib/format';
import { documentTypeLabel } from '../../lib/labels';
import { FieldList } from './FieldList';
import { ProcessingTimeline } from './ProcessingTimeline';
import { ReviewActions } from './ReviewActions';
import type { Document, NormalizedRecord } from '../../domain/types';

type Props = {
  doc: Document | undefined;
  isPending: boolean;
  error: unknown;
  /** A mutation is in flight. */
  pending: boolean;
  /** The row this was opened from, so focus can go back where it came from. */
  returnFocusTo: string;
  onClose: () => void;
  onConfirm: () => void;
  onReject: () => void;
  onRetry: () => void;
  onCorrect: (field: keyof NormalizedRecord, value: string) => void;
};

/** Both raw axes in one line, so the drawer shows the truth the table's lane summarises. */
function subtitle(doc: Document): string {
  const parts = [doc.status.replace(/_/g, ' ')];
  if (doc.reviewStatus !== 'not_required') parts.push(doc.reviewStatus.replace(/_/g, ' '));
  if (doc.error) parts.push(doc.error.retryable ? 'retryable' : 'not retryable');
  if (doc.attempts > 0) parts.push(`attempt ${doc.attempts + 1}`);
  return parts.join(' · ');
}

export function DocumentDrawer({
  doc,
  isPending,
  error,
  pending,
  returnFocusTo,
  onClose,
  onConfirm,
  onReject,
  onRetry,
  onCorrect,
}: Props) {
  const dialog = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    dialog.current?.showModal();
    // <dialog> restores focus itself, but only to whatever was focused when it opened - and a
    // drawer opened from a URL had nothing focused, so that lands on <body>. The row is named
    // explicitly, and deferred by a tick: the browser's own focus fixup runs as the dialog
    // leaves the DOM and would otherwise overwrite ours. Verified in a real browser, since
    // jsdom has no showModal and cannot reproduce either behaviour.
    return () => {
      setTimeout(() => {
        document.querySelector<HTMLElement>(`[data-doc-id="${returnFocusTo}"]`)?.focus();
      }, 0);
    };
  }, [returnFocusTo]);

  return (
    <dialog
      ref={dialog}
      aria-label={doc ? doc.fileName : 'Document detail'}
      // Fires for Escape and for the backdrop, so neither needs a handler of ours.
      onClose={onClose}
      className="m-0 ml-auto h-dvh max-h-none w-[min(520px,100%)] max-w-none flex-col border-l border-rule-strong bg-paper p-0 text-ink open:flex backdrop:bg-ink/40"
    >
      {error ? (
        <div className="p-6">
          <p role="alert" className="text-failed">
            Could not load this document. {String((error as Error).message ?? error)}
          </p>
        </div>
      ) : isPending || !doc ? (
        <div role="status" aria-busy="true" className="p-6">
          <span className="sr-only">Loading document</span>
          <div className="h-5 w-64 bg-paper-sunk" />
        </div>
      ) : (
        <>
          <div className={`flex items-baseline gap-2 border-b border-rule-strong px-6 py-3 ${
              lane(doc) === 'auto_accepted' ? 'bg-paper-sunk' : 'bg-tint-attention'
            }`}>
            <StatusMark lane={lane(doc)} />
            <span className="text-[11px] text-ink-muted">{subtitle(doc)}</span>
          </div>

          <div className="border-b border-rule px-6 py-4">
            <h3 className="text-lg font-semibold">{doc.fileName}</h3>
            <p className="m-0 font-mono text-[11px] text-ink-muted">
              {doc.id} · {doc.batchId} · {count(Math.round(doc.size / 1024))} kB
              {doc.extraction?.documentType.value
                ? ` · ${documentTypeLabel(doc.extraction.documentType.value)}`
                : ''}
            </p>
          </div>

          <div className="flex-1 overflow-y-auto px-6 pb-6">
            {/* Full here, masked in the table: the drawer is a deliberate act, a list is a glance. */}
            {doc.extraction ? (
              <FieldList record={doc.extraction} onCorrect={onCorrect} />
            ) : (
              <p className="py-4 text-ink-muted">
                Nothing has been extracted yet — this document has not finished processing.
              </p>
            )}
            <ProcessingTimeline doc={doc} />
          </div>

          <ReviewActions
            doc={doc}
            pending={pending}
            onConfirm={onConfirm}
            onReject={onReject}
            onRetry={onRetry}
          />
        </>
      )}

      <form method="dialog" className="absolute top-3 right-4">
        <button type="submit" className="text-ink-muted underline underline-offset-[3px]">
          Close
        </button>
      </form>
    </dialog>
  );
}
