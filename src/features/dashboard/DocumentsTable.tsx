/**
 * The register: the screen's primary surface, and deliberately not a card. Hairline rules,
 * tabular figures, monospace identifiers, and a margin mark at the left edge that repeats the
 * lane so a flagged row can be found by running an eye down the column - docs/design/direction.md §6.
 * It owns all four of its states, so loading, error and both empty cases are testable without a router.
 */
import { confidenceBand, documentConfidence, flaggedFields, lane } from '../../domain/derive';
import { maskPhone } from '../../domain/derive';
import { InfoTip } from '../../components/InfoTip';
import { confidence as fmtConfidence, ago } from '../../lib/format';
import { documentTypeLabel, FIELD_LABEL } from '../../lib/labels';
import type { TermKey } from '../../lib/glossary';
import { MarginMark, StatusMark } from './StatusMark';
import type { SortKey } from '../../app/search';
import type { Document } from '../../domain/types';

type Props = {
  docs: Document[];
  isPending: boolean;
  error: unknown;
  /** Drives which empty state to show: a filtered-to-nothing view is fixable, a fresh one is not. */
  hasFilters: boolean;
  sort: SortKey | undefined;
  onSort: (sort: SortKey) => void;
  onOpen: (id: string) => void;
  onRetry: () => void;
  onClearFilters: () => void;
};

const BAND_LABEL = {
  high: 'High',
  review_recommended: 'Review recommended',
  review_required: 'Review required',
} as const;

/**
 * The two raw axes, kept visible beneath the lane. The lane says what to do; this says why.
 * A flagged document names the field that flagged it, because "needs review" beside a
 * confidence of 0.97 reads as a contradiction - the document is flagged for a field that has
 * no confidence at all, and only naming it explains that.
 */
function rawPair(doc: Document): string {
  const parts: string[] = [doc.status];
  if (doc.error) {
    parts.push(doc.error.message, doc.error.retryable ? 'retryable' : 'not retryable');
  } else if (doc.reviewStatus === 'needs_review' && doc.extraction) {
    const flagged = flaggedFields(doc.extraction);
    parts.push(
      flagged.length === 1
        ? `${FIELD_LABEL[flagged[0]].toLowerCase()} ${doc.extraction[flagged[0]].status}`
        : `${flagged.length} fields flagged`,
    );
  } else if (doc.reviewStatus !== 'not_required') {
    parts.push(doc.reviewStatus.replace(/_/g, ' '));
  }
  return parts.join(' · ');
}

const SORTABLE = { fileName: 'File', uploadedAt: 'Uploaded', confidence: 'Conf.' } as const;

function SortHeader({
  field,
  sort,
  onSort,
  className,
  term,
}: {
  field: keyof typeof SORTABLE;
  sort: SortKey | undefined;
  onSort: (sort: SortKey) => void;
  className?: string;
  term?: TermKey;
}) {
  const active = sort === field || sort === `-${field}`;
  const descending = sort === `-${field}`;
  return (
    <th
      scope="col"
      className={className}
      aria-sort={!active ? 'none' : descending ? 'descending' : 'ascending'}
    >
      <button
        type="button"
        className="uppercase tracking-[0.06em] hover:text-ink"
        onClick={() => onSort((descending ? field : active ? `-${field}` : field) as SortKey)}
      >
        {SORTABLE[field]}
        {active ? <span aria-hidden="true"> {descending ? '↓' : '↑'}</span> : null}
      </button>
      {term ? <InfoTip term={term} /> : null}
    </th>
  );
}

const TH = 'px-3 py-2 text-left text-xs font-medium uppercase tracking-[0.06em] text-ink-muted';
const TD = 'px-3 py-2 align-top';

function Notice({ children }: { children: React.ReactNode }) {
  return <div className="border-b border-rule px-3 py-12 text-center">{children}</div>;
}

export function DocumentsTable({
  docs,
  isPending,
  error,
  hasFilters,
  sort,
  onSort,
  onOpen,
  onRetry,
  onClearFilters,
}: Props) {
  if (error)
    return (
      <Notice>
        <p role="alert" className="text-failed">
          Could not load documents. {String((error as Error).message ?? error)}
        </p>
        <button type="button" className="mt-3 border border-field px-3 py-1.5" onClick={onRetry}>
          Try again
        </button>
      </Notice>
    );

  // A skeleton, not an empty table: announcing "no documents" while the first page loads is a lie.
  if (isPending)
    return (
      <div role="status" aria-busy="true" aria-label="Loading documents" className="py-2">
        {Array.from({ length: 8 }, (_, i) => (
          <div key={i} className="border-b border-rule px-3 py-3">
            <div className="h-4 w-full max-w-3xl bg-paper-sunk" />
          </div>
        ))}
      </div>
    );

  if (!docs.length)
    return (
      <Notice>
        {hasFilters ? (
          <>
            <p>No documents match these filters.</p>
            <button
              type="button"
              className="mt-3 border border-field px-3 py-1.5"
              onClick={onClearFilters}
            >
              Clear filters
            </button>
          </>
        ) : (
          <p>No documents yet. Upload a batch to start digitising the archive.</p>
        )}
      </Notice>
    );

  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[940px] border-collapse">
        <caption className="sr-only">
          Documents in the archive, with processing state and extraction confidence
        </caption>
        <thead>
          <tr className="border-b border-rule-strong bg-paper-sunk">
            <th scope="col" className="w-[2.5ch] px-0">
              <span className="sr-only">Margin mark</span>
            </th>
            <th scope="col" className={TH}>
              Identifier
            </th>
            <SortHeader field="fileName" sort={sort} onSort={onSort} className={TH} />
            <th scope="col" className={TH}>
              Type
            </th>
            <th scope="col" className={TH}>
              State
              <InfoTip term="lane" />
            </th>
            <th scope="col" className={TH}>
              Person
            </th>
            <SortHeader
              field="confidence"
              sort={sort}
              onSort={onSort}
              className={`${TH} w-44`}
              term="confidence"
            />
            <SortHeader field="uploadedAt" sort={sort} onSort={onSort} className={`${TH} w-32`} />
          </tr>
        </thead>
        <tbody>
          {docs.map((doc) => {
            const bucket = lane(doc);
            const score = doc.extraction ? documentConfidence(doc.extraction) : undefined;
            const band = confidenceBand(score);
            return (
              <tr key={doc.id} className="border-b border-rule hover:bg-paper-hover">
                <MarginMark lane={bucket} />
                <td className={`${TD} font-mono text-[11px] text-ink-muted`}>{doc.id}</td>
                <td className={TD}>
                  <button
                    type="button"
                    data-doc-id={doc.id}
                    className="text-left underline underline-offset-2 hover:text-processing"
                    onClick={() => onOpen(doc.id)}
                  >
                    {doc.fileName}
                  </button>
                </td>
                {/* Blank, never a dash: an unprocessed document has no type yet and the state
                    column already says why. A dash would read as "we looked and found nothing". */}
                <td className={TD}>{documentTypeLabel(doc.extraction?.documentType.value)}</td>
                <td className={TD}>
                  <StatusMark lane={bucket} />
                  <span className="block text-[11px] text-ink-muted">{rawPair(doc)}</span>
                </td>
                {/* Masked here and full in the drawer: this archive holds medical intake sheets
                    and ID scans, so a list view should not put a phone number on a shared screen. */}
                <td className={TD}>
                  {doc.extraction?.personName.value}
                  {doc.extraction?.phone.value ? (
                    <span className="block font-mono text-[11px] text-ink-muted">
                      {maskPhone(doc.extraction.phone.value)}
                    </span>
                  ) : null}
                </td>
                <td className={`${TD} text-right`}>
                  {score === undefined ? null : (
                    <>
                      <span className="font-mono">{fmtConfidence(score)}</span>
                      <span className="block text-[11px] text-ink-muted">
                        {band ? BAND_LABEL[band] : null}
                      </span>
                    </>
                  )}
                </td>
                <td className={`${TD} text-right text-[11px] text-ink-muted`}>
                  {ago(doc.uploadedAt)}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
