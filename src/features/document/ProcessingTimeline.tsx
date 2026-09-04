/**
 * What actually happened to this document, in order and with elapsed times. A spinner says
 * "wait"; this says why a retryable failure is worth retrying and how long the work took.
 */
import { duration } from '../../lib/format';
import type { Document } from '../../domain/types';

type Step = { mark: string; className: string; text: string; at?: string };

const seconds = (from: string | undefined, to: string | undefined) =>
  from && to ? (Date.parse(to) - Date.parse(from)) / 1000 : undefined;

/** Renders the document's own timestamps; nothing here is inferred or invented. */
function steps(doc: Document): Step[] {
  const out: Step[] = [
    { mark: '✓', className: 'text-completed', text: 'Uploaded', at: doc.uploadedAt },
  ];
  if (doc.attempts > 0) {
    out.push({
      mark: '✓',
      className: 'text-completed',
      text: `Retried by a person — attempt ${doc.attempts + 1}`,
    });
  }
  if (doc.startedAt) {
    out.push({
      mark: '✓',
      className: 'text-completed',
      text: 'Processing started',
      at: doc.startedAt,
    });
  } else {
    out.push({ mark: '▸', className: 'text-processing', text: 'Waiting in the queue' });
  }

  const took = seconds(doc.startedAt, doc.finishedAt);
  const elapsed = took === undefined ? '' : ` in ${duration(took)}`;
  if (doc.status === 'completed') {
    out.push({
      mark: '✓',
      className: 'text-completed',
      text: `Extraction completed${elapsed}`,
      at: doc.finishedAt,
    });
  } else if (doc.status === 'failed') {
    // The reason is a full sentence and lives in the error card below; repeating it here and
    // suffixing "in 9 s" onto it produced "A new scan is required. in 9 s".
    out.push({
      mark: '✕',
      className: 'text-failed',
      text: `Processing failed${elapsed}`,
      at: doc.finishedAt,
    });
  } else if (doc.status === 'processing') {
    out.push({ mark: '▸', className: 'text-processing', text: 'Processing now' });
  }
  return out;
}

const TIME = new Intl.DateTimeFormat('en-GB', {
  hour: '2-digit',
  minute: '2-digit',
  second: '2-digit',
  timeZone: 'UTC',
});

export function ProcessingTimeline({ doc }: { doc: Document }) {
  return (
    <section className="pt-4">
      <h4 className="border-b border-rule pb-2 text-xs font-medium uppercase tracking-[0.06em] text-ink-muted">
        Processing
      </h4>
      <ol className="m-0 list-none p-0">
        {steps(doc).map((step, i) => (
          <li key={i} className="grid grid-cols-[2ch_1fr_auto] gap-2 py-1.5">
            <span aria-hidden="true" className={`font-mono text-[11px] ${step.className}`}>
              {step.mark}
            </span>
            <span>{step.text}</span>
            <span className="font-mono text-[11px] text-ink-muted">
              {step.at ? TIME.format(Date.parse(step.at)) : ''}
            </span>
          </li>
        ))}
      </ol>
    </section>
  );
}
