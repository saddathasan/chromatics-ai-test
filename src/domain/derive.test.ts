import { describe, expect, it } from 'vitest';
import { confidenceBand, documentConfidence, lane, maskPhone, reviewOutcome } from './derive';
import type { Document, ExtractedField, NormalizedRecord } from './types';

const field = (over: Partial<ExtractedField> = {}): ExtractedField => ({
  status: 'extracted',
  value: 'x',
  confidence: 0.95,
  ...over,
});

const record = (over: Partial<NormalizedRecord> = {}): NormalizedRecord => ({
  documentType: { status: 'extracted', value: 'enrollment', confidence: 0.99 },
  personName: field(),
  phone: field(),
  location: field(),
  programName: field(),
  date: field(),
  ...over,
});

const doc = (over: Partial<Document> = {}): Document => ({
  id: 'doc_1',
  batchId: 'batch_1',
  fileName: 'f.pdf',
  mimeType: 'application/pdf',
  size: 10,
  status: 'completed',
  reviewStatus: 'not_required',
  attempts: 0,
  uploadedAt: '2026-09-01T10:00:00.000Z',
  ...over,
});

describe('documentConfidence', () => {
  it('is the weakest field, not the average', () => {
    expect(documentConfidence(record({ phone: field({ confidence: 0.42 }) }))).toBe(0.42);
  });

  it('ignores fields that carry no confidence', () => {
    expect(
      documentConfidence(
        record({ programName: { status: 'missing' }, phone: field({ confidence: 0.8 }) }),
      ),
    ).toBe(0.8);
  });

  it('is undefined when nothing was extracted with confidence', () => {
    expect(
      documentConfidence({
        documentType: { status: 'missing' },
        personName: { status: 'missing' },
        phone: { status: 'unreadable' },
        location: { status: 'not_applicable' },
        programName: { status: 'missing' },
        date: { status: 'missing' },
      }),
    ).toBeUndefined();
  });
});

describe('confidenceBand', () => {
  it('splits at the documented thresholds', () => {
    expect(confidenceBand(0.95)).toBe('high');
    expect(confidenceBand(0.9)).toBe('high');
    expect(confidenceBand(0.89)).toBe('review_recommended');
    expect(confidenceBand(0.7)).toBe('review_recommended');
    expect(confidenceBand(0.69)).toBe('review_required');
  });

  it('has no band without a number', () => {
    expect(confidenceBand(undefined)).toBeUndefined();
  });
});

describe('reviewOutcome', () => {
  it('needs no review when every field is confidently extracted', () => {
    expect(reviewOutcome(record())).toBe('not_required');
  });

  it.each(['uncertain', 'missing', 'unreadable'] as const)('flags a %s field', (status) => {
    expect(reviewOutcome(record({ phone: { status } }))).toBe('needs_review');
  });

  it('does not flag a field that does not apply to this document type', () => {
    expect(reviewOutcome(record({ phone: { status: 'not_applicable' } }))).toBe('not_required');
  });

  it('does not flag a field a human already corrected', () => {
    expect(reviewOutcome(record({ phone: { status: 'corrected', value: '+880' } }))).toBe(
      'not_required',
    );
  });
});

describe('lane', () => {
  it('puts queued and processing documents in flight', () => {
    expect(lane(doc({ status: 'queued' }))).toBe('in_flight');
    expect(lane(doc({ status: 'processing' }))).toBe('in_flight');
  });

  it('sends unreadable documents to recapture rather than field review', () => {
    const failed = doc({
      status: 'failed',
      error: { code: 'UNREADABLE_DOCUMENT', message: 'x', retryable: false },
    });
    expect(lane(failed)).toBe('recapture');
  });

  it('sends human-rejected documents to recapture', () => {
    expect(lane(doc({ reviewStatus: 'rejected' }))).toBe('recapture');
  });

  it('treats a retryable failure as needing human action', () => {
    const failed = doc({
      status: 'failed',
      error: { code: 'PROCESSING_TIMEOUT', message: 'x', retryable: true },
    });
    expect(lane(failed)).toBe('needs_review');
  });

  it('puts uncertain extractions in review', () => {
    expect(lane(doc({ reviewStatus: 'needs_review' }))).toBe('needs_review');
  });

  it('auto-accepts clean and confirmed documents', () => {
    expect(lane(doc())).toBe('auto_accepted');
    expect(lane(doc({ reviewStatus: 'confirmed' }))).toBe('auto_accepted');
  });
});

describe('maskPhone', () => {
  it('keeps the country code and last three digits', () => {
    expect(maskPhone('+8801712345678')).toBe('+880 17•• ••• 678');
  });

  it('leaves short or absent values alone', () => {
    expect(maskPhone(undefined)).toBeUndefined();
    expect(maskPhone('017')).toBe('017');
  });
});
