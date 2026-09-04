import { describe, expect, it } from 'vitest';
import { can, IllegalTransition, transition } from './transitions';
import type { Document, ProcessingError } from './types';

const base: Document = {
  id: 'doc_1',
  batchId: 'batch_1',
  fileName: 'enrollment-01.pdf',
  mimeType: 'application/pdf',
  size: 1024,
  status: 'queued',
  reviewStatus: 'not_required',
  attempts: 0,
  uploadedAt: '2026-09-01T10:00:00.000Z',
};

const doc = (over: Partial<Document> = {}): Document => ({ ...base, ...over });

const timeout: ProcessingError = {
  code: 'PROCESSING_TIMEOUT',
  message: 'Timed out',
  retryable: true,
};
const unsupported: ProcessingError = {
  code: 'UNSUPPORTED_FORMAT',
  message: 'Not supported',
  retryable: false,
};

const at = '2026-09-01T10:05:00.000Z';

describe('start', () => {
  it('moves queued to processing and stamps startedAt', () => {
    const next = transition(doc(), { type: 'start', at });
    expect(next.status).toBe('processing');
    expect(next.startedAt).toBe(at);
  });

  it('rejects start from any other status', () => {
    expect(() => transition(doc({ status: 'processing' }), { type: 'start', at })).toThrow(
      IllegalTransition,
    );
    expect(() => transition(doc({ status: 'completed' }), { type: 'start', at })).toThrow(
      IllegalTransition,
    );
  });
});

describe('complete', () => {
  it('moves processing to completed, attaches extraction and derives review status', () => {
    const next = transition(doc({ status: 'processing' }), {
      type: 'complete',
      at,
      extraction: {
        documentType: { status: 'extracted', value: 'enrollment', confidence: 0.99 },
        personName: { status: 'extracted', value: 'Amina Rahman', confidence: 0.97 },
        phone: { status: 'extracted', value: '+8801712345678', confidence: 0.95 },
        location: { status: 'extracted', value: 'Dhaka', confidence: 0.93 },
        programName: { status: 'extracted', value: 'Education', confidence: 0.91 },
        date: { status: 'extracted', value: '2026-04-12', confidence: 0.9 },
      },
    });
    expect(next.status).toBe('completed');
    expect(next.reviewStatus).toBe('not_required');
    expect(next.finishedAt).toBe(at);
    expect(next.extraction?.personName.value).toBe('Amina Rahman');
  });

  it('flags needs_review when a field is uncertain', () => {
    const next = transition(doc({ status: 'processing' }), {
      type: 'complete',
      at,
      extraction: {
        documentType: { status: 'extracted', value: 'medical_intake', confidence: 0.98 },
        personName: { status: 'extracted', value: 'Karim Uddin', confidence: 0.96 },
        phone: {
          status: 'uncertain',
          value: '+8801711111111',
          raw: '017l1111111',
          confidence: 0.62,
        },
        location: { status: 'extracted', value: 'Khulna', confidence: 0.94 },
        programName: { status: 'missing' },
        date: { status: 'extracted', value: '2026-03-02', confidence: 0.92 },
      },
    });
    expect(next.reviewStatus).toBe('needs_review');
  });

  it('rejects complete unless processing', () => {
    expect(() =>
      transition(doc({ status: 'queued' }), { type: 'complete', at, extraction: undefined }),
    ).toThrow(IllegalTransition);
  });
});

describe('fail', () => {
  it('moves processing to failed and records the error', () => {
    const next = transition(doc({ status: 'processing' }), { type: 'fail', at, error: timeout });
    expect(next.status).toBe('failed');
    expect(next.error).toEqual(timeout);
    expect(next.finishedAt).toBe(at);
  });

  it('rejects fail unless processing', () => {
    expect(() =>
      transition(doc({ status: 'failed' }), { type: 'fail', at, error: timeout }),
    ).toThrow(IllegalTransition);
  });
});

describe('retry', () => {
  it('requeues a retryable failure and increments attempts', () => {
    const next = transition(doc({ status: 'failed', error: timeout, attempts: 1 }), {
      type: 'retry',
      at,
    });
    expect(next.status).toBe('queued');
    expect(next.attempts).toBe(2);
    expect(next.error).toBeUndefined();
    expect(next.finishedAt).toBeUndefined();
  });

  it('refuses to retry a non-retryable error', () => {
    expect(() =>
      transition(doc({ status: 'failed', error: unsupported }), { type: 'retry', at }),
    ).toThrow(IllegalTransition);
  });

  it('refuses to retry a document a human rejected', () => {
    expect(() =>
      transition(doc({ status: 'failed', error: timeout, reviewStatus: 'rejected' }), {
        type: 'retry',
        at,
      }),
    ).toThrow(IllegalTransition);
  });

  it('refuses to retry anything not failed', () => {
    expect(() => transition(doc({ status: 'completed' }), { type: 'retry', at })).toThrow(
      IllegalTransition,
    );
  });
});

describe('confirm', () => {
  it('marks a needs_review document confirmed', () => {
    const next = transition(doc({ status: 'completed', reviewStatus: 'needs_review' }), {
      type: 'confirm',
      at,
    });
    expect(next.reviewStatus).toBe('confirmed');
  });

  it('refuses to confirm a document that needs no review', () => {
    expect(() =>
      transition(doc({ status: 'completed', reviewStatus: 'not_required' }), {
        type: 'confirm',
        at,
      }),
    ).toThrow(IllegalTransition);
  });
});

describe('correct', () => {
  const withUncertainPhone = doc({
    status: 'completed',
    reviewStatus: 'needs_review',
    extraction: {
      documentType: { status: 'extracted', value: 'id_scan', confidence: 0.99 },
      personName: { status: 'extracted', value: 'Nadia Islam', confidence: 0.98 },
      phone: { status: 'uncertain', value: '+8801700000000', raw: '017OOOOOOOO', confidence: 0.55 },
      location: { status: 'extracted', value: 'Sylhet', confidence: 0.95 },
      programName: { status: 'extracted', value: 'Health', confidence: 0.93 },
      date: { status: 'extracted', value: '2026-01-09', confidence: 0.91 },
    },
  });

  it('replaces the value, marks the field corrected and keeps the raw audit trail', () => {
    const next = transition(withUncertainPhone, {
      type: 'correct',
      at,
      field: 'phone',
      value: '+8801799999999',
    });
    expect(next.extraction?.phone).toMatchObject({
      status: 'corrected',
      value: '+8801799999999',
      raw: '017OOOOOOOO',
    });
    expect(next.extraction?.phone.confidence).toBeUndefined();
  });

  it('leaves other fields untouched', () => {
    const next = transition(withUncertainPhone, {
      type: 'correct',
      at,
      field: 'phone',
      value: '+8801799999999',
    });
    expect(next.extraction?.personName).toEqual(withUncertainPhone.extraction?.personName);
  });

  it('refuses to correct a document with no extraction', () => {
    expect(() =>
      transition(doc({ status: 'completed', reviewStatus: 'needs_review' }), {
        type: 'correct',
        at,
        field: 'phone',
        value: 'x',
      }),
    ).toThrow(IllegalTransition);
  });
});

describe('reject', () => {
  it('rejects a completed document', () => {
    const next = transition(doc({ status: 'completed', reviewStatus: 'needs_review' }), {
      type: 'reject',
      at,
    });
    expect(next.reviewStatus).toBe('rejected');
  });

  it('rejects a failed document', () => {
    const next = transition(doc({ status: 'failed', error: unsupported }), { type: 'reject', at });
    expect(next.reviewStatus).toBe('rejected');
  });

  it('refuses to reject an already confirmed document', () => {
    expect(() =>
      transition(doc({ status: 'completed', reviewStatus: 'confirmed' }), { type: 'reject', at }),
    ).toThrow(IllegalTransition);
  });

  it('refuses to reject a document that is already rejected', () => {
    expect(() =>
      transition(doc({ status: 'completed', reviewStatus: 'rejected' }), { type: 'reject', at }),
    ).toThrow(IllegalTransition);
  });

  it('refuses to reject a document still in flight', () => {
    expect(() => transition(doc({ status: 'processing' }), { type: 'reject', at })).toThrow(
      IllegalTransition,
    );
  });
});

describe('purity', () => {
  it('never mutates the input document', () => {
    const input = doc({ status: 'processing' });
    const snapshot = structuredClone(input);
    transition(input, { type: 'fail', at, error: timeout });
    expect(input).toEqual(snapshot);
  });
});

describe('can', () => {
  const reviewable: Document = {
    id: 'doc_1',
    batchId: 'b',
    fileName: 'f.pdf',
    mimeType: 'application/pdf',
    size: 1,
    status: 'completed',
    reviewStatus: 'needs_review',
    attempts: 0,
    uploadedAt: '2026-09-04T00:00:00.000Z',
    extraction: {
      documentType: { status: 'extracted', value: 'id_scan', confidence: 0.9 },
      personName: { status: 'uncertain', value: 'A', confidence: 0.5 },
      phone: { status: 'missing' },
      location: { status: 'extracted', value: 'K', confidence: 0.9 },
      programName: { status: 'extracted', value: 'P', confidence: 0.9 },
      date: { status: 'extracted', value: '2026-01-01', confidence: 0.9 },
    },
  };

  it('permits exactly the review actions the transition table allows', () => {
    expect(can(reviewable, 'confirm')).toBe(true);
    expect(can(reviewable, 'reject')).toBe(true);
    expect(can(reviewable, 'correct')).toBe(true);
    expect(can(reviewable, 'retry')).toBe(false);
  });

  it('withdraws confirm and reject once a document is confirmed', () => {
    const confirmed = { ...reviewable, reviewStatus: 'confirmed' as const };
    expect(can(confirmed, 'confirm')).toBe(false);
    expect(can(confirmed, 'reject')).toBe(false);
  });

  it('offers retry only for a retryable failure that was not rejected', () => {
    const failed: Document = {
      ...reviewable,
      status: 'failed',
      reviewStatus: 'not_required',
      extraction: undefined,
      error: { code: 'PROCESSING_TIMEOUT', message: 'timed out', retryable: true },
    };
    expect(can(failed, 'retry')).toBe(true);
    expect(can({ ...failed, reviewStatus: 'rejected' }, 'retry')).toBe(false);
    expect(
      can(
        { ...failed, error: { code: 'UNSUPPORTED_FORMAT', message: 'nope', retryable: false } },
        'retry',
      ),
    ).toBe(false);
  });
});
