/**
 * The extracted record, worst-first. This is where the brief's "make that reality visible"
 * requirement actually lands: six field statuses, each stated in words, so a blank is never
 * ambiguous between "not on the form", "we could not read it" and "this form has no such field".
 * Naming the defect rather than scoring it comes from archival condition-survey practice -
 * docs/design/direction.md §3.1.
 */
import { useState } from 'react';
import { confidence as fmtConfidence } from '../../lib/format';
import { DOCUMENT_TYPE_LABEL, FIELD_LABEL } from '../../lib/labels';
import type { DocumentType, ExtractedField, FieldStatus, NormalizedRecord } from '../../domain/types';

type FieldKey = keyof NormalizedRecord;

/** The wording is the whole point: each of these is a different fact about the archive. */
const STATUS_TEXT: Record<FieldStatus, string> = {
  extracted: 'extracted',
  uncertain: 'uncertain',
  missing: 'not present on this form',
  unreadable: 'present, but could not be read',
  not_applicable: 'not used on this form type',
  corrected: 'corrected by a person',
};

/**
 * Worst first. `uncertain` leads because a value that is present and wrong is the failure this
 * product exists to prevent - an unreadable or missing field is at least obviously empty.
 * `not_applicable` sits last: it is the only status that needs no attention at all.
 */
const SEVERITY: Record<FieldStatus, number> = {
  uncertain: 0,
  unreadable: 1,
  missing: 2,
  corrected: 3,
  extracted: 4,
  not_applicable: 5,
};

const FLAGGED: FieldStatus[] = ['uncertain', 'unreadable', 'missing'];
const needsAttention = (field: ExtractedField<string | never>) => FLAGGED.includes(field.status);

function FieldRow({
  fieldKey,
  field,
  onCorrect,
}: {
  fieldKey: FieldKey;
  field: NormalizedRecord[FieldKey];
  onCorrect: (field: FieldKey, value: string) => void;
}) {
  const [draft, setDraft] = useState<string | null>(null);
  const label = FIELD_LABEL[fieldKey];
  // documentType carries an enum, not prose; every other field is already a person's words.
  const value =
    fieldKey === 'documentType' && field.value
      ? DOCUMENT_TYPE_LABEL[field.value as DocumentType]
      : field.value;
  // A field this form type does not have is not missing data - there is nothing to enter.
  const editable = field.status !== 'not_applicable';
  // Raw only when it says something the normalized value does not.
  const raw = field.raw && field.raw !== value ? field.raw : undefined;

  return (
    <div className="border-b border-rule py-3 last:border-b-0">
      <div className="flex items-baseline gap-3">
        <dt className="flex-1 text-xs font-medium uppercase tracking-[0.06em] text-ink-muted">
          {label}
        </dt>
        <span className="text-[11px] text-ink-muted">
          {STATUS_TEXT[field.status]}
          {typeof field.confidence === 'number' ? ` · ${fmtConfidence(field.confidence)}` : ''}
        </span>
      </div>

      <dd className="mt-0.5 ml-0">
        {draft === null ? (
          <>
            {value ? (
              <div className="font-medium">{value}</div>
            ) : editable ? (
              <div className="text-ink-muted">no value recorded</div>
            ) : null}
            {raw ? (
              <div className="mt-0.5 text-[11px] text-ink-muted">
                raw <code className="font-mono">“{raw}”</code>
              </div>
            ) : null}
            {editable ? (
              <button
                type="button"
                className="mt-1 text-xs text-processing underline underline-offset-[3px]"
                onClick={() => setDraft(String(field.value ?? ''))}
              >
                {value ? `Correct ${label.toLowerCase()}` : `Enter ${label.toLowerCase()}`}
              </button>
            ) : null}
          </>
        ) : (
          <form
            className="flex flex-wrap items-center gap-2"
            onSubmit={(e) => {
              e.preventDefault();
              onCorrect(fieldKey, draft);
              setDraft(null);
            }}
          >
            <label className="sr-only" htmlFor={`field-${fieldKey}`}>
              {label}
            </label>
            <input
              id={`field-${fieldKey}`}
              className="min-h-8 flex-1 border border-field bg-paper px-2 py-1"
              value={draft}
              autoFocus
              onChange={(e) => setDraft(e.target.value)}
            />
            <button type="submit" className="border border-ink bg-ink px-3 py-1.5 text-paper">
              Save
            </button>
            <button
              type="button"
              className="border border-field px-3 py-1.5"
              onClick={() => setDraft(null)}
            >
              Cancel
            </button>
          </form>
        )}
      </dd>
    </div>
  );
}

export function FieldList({
  record,
  onCorrect,
}: {
  record: NormalizedRecord;
  onCorrect: (field: FieldKey, value: string) => void;
}) {
  const [flaggedOnly, setFlaggedOnly] = useState(false);

  const keys = (Object.keys(record) as FieldKey[])
    .filter((key) => !flaggedOnly || needsAttention(record[key]))
    .sort((a, b) => {
      const bySeverity = SEVERITY[record[a].status] - SEVERITY[record[b].status];
      if (bySeverity !== 0) return bySeverity;
      // Within a status, least confident first; a field with no score cannot be ranked by one.
      return (record[a].confidence ?? 1) - (record[b].confidence ?? 1);
    });

  return (
    <section>
      <div className="flex items-center justify-between border-b border-rule py-2">
        <h4 className="text-xs font-medium uppercase tracking-[0.06em] text-ink-muted">
          Extracted record
        </h4>
        <label className="flex items-center gap-2 text-xs">
          <input
            type="checkbox"
            checked={flaggedOnly}
            onChange={(e) => setFlaggedOnly(e.target.checked)}
          />
          Flagged only
        </label>
      </div>
      <dl className="m-0">
        {keys.map((key) => (
          <FieldRow key={key} fieldKey={key} field={record[key]} onCorrect={onCorrect} />
        ))}
      </dl>
    </section>
  );
}
