/**
 * Everything the UI needs that is computed from a document rather than stored on it:
 * confidence, whether a human must look at it, which operational lane it belongs to.
 * Keeping these derived stops the two status axes from drifting out of sync with reality.
 */
import { CONFIDENCE } from './types';
import type { Document, Lane, NormalizedRecord, ReviewStatus } from './types';

/** Field states that mean a human has to look at the value. */
const FLAGGED = new Set(['uncertain', 'missing', 'unreadable']);

/**
 * Which fields are the reason a document needs attention. Single-sourced with reviewOutcome
 * so the table's explanation can never disagree with the flag that produced it, and because
 * a count is not an explanation: "date missing" is actionable where "needs review" is not.
 */
export function flaggedFields(record: NormalizedRecord): (keyof NormalizedRecord)[] {
  return (Object.keys(record) as (keyof NormalizedRecord)[]).filter((key) =>
    FLAGGED.has(record[key].status)
  );
}

/**
 * A document is only as trustworthy as its weakest field, so this is the minimum and not
 * the mean: an average hides one unreadable phone number behind five perfect fields.
 * Undefined when no field carries a confidence at all.
 */
export function documentConfidence(record: NormalizedRecord): number | undefined {
  const scores = Object.values(record)
    .map((f) => f.confidence)
    .filter((c): c is number => typeof c === 'number');
  return scores.length ? Math.min(...scores) : undefined;
}

/** Confidence bands. The thresholds are a product assumption, documented in the README. */
export function confidenceBand(
  confidence: number | undefined
): 'high' | 'review_recommended' | 'review_required' | undefined {
  if (typeof confidence !== 'number') return undefined;
  if (confidence >= CONFIDENCE.high) return 'high';
  return confidence >= CONFIDENCE.review ? 'review_recommended' : 'review_required';
}

/**
 * Whether a freshly extracted record needs human attention. Missing is deliberately as
 * flag-worthy as uncertain: a blank the operator never sees is the failure mode this
 * product exists to prevent. Fields that do not apply to the document type never flag.
 */
export function reviewOutcome(record: NormalizedRecord): ReviewStatus {
  return flaggedFields(record).length ? 'needs_review' : 'not_required';
}

/**
 * The operational bucket the dashboard groups by, answering "what does an operator do with
 * this?". A retryable failure lands in needs_review because it needs a human click; only
 * dead-end failures and human rejections go to recapture, where the fix is a new file.
 */
export function lane(doc: Document): Lane {
  if (doc.status === 'queued' || doc.status === 'processing') return 'in_flight';
  if (doc.reviewStatus === 'rejected') return 'recapture';
  if (doc.status === 'failed') return doc.error?.retryable ? 'needs_review' : 'recapture';
  return doc.reviewStatus === 'needs_review' ? 'needs_review' : 'auto_accepted';
}

/**
 * The archive holds medical intake sheets and ID scans, so list views show a masked number
 * and the full value stays behind the detail drawer.
 */
export function maskPhone(phone: string | undefined): string | undefined {
  if (!phone || phone.length < 8) return phone;
  const country = phone.startsWith('+') ? phone.slice(0, 4) : '';
  const rest = phone.slice(country.length);
  return `${country} ${rest.slice(0, 2)}•• ••• ${phone.slice(-3)}`.trim();
}
