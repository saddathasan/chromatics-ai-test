/**
 * The document state machine: the only place a document's status or review status changes.
 * Every mock-API mutation routes through `transition`, so an illegal move is impossible to
 * express rather than merely discouraged. Mirrors the table in design spec §2.
 */
import { reviewOutcome } from './derive';
import type { Document, NormalizedRecord, ProcessingError } from './types';

/** Every way a document can legally be asked to change. */
export type Action =
  | { type: 'start'; at: string }
  | { type: 'complete'; at: string; extraction: NormalizedRecord | undefined }
  | { type: 'fail'; at: string; error: ProcessingError }
  | { type: 'retry'; at: string }
  | { type: 'confirm'; at: string }
  | { type: 'correct'; at: string; field: keyof NormalizedRecord; value: string }
  | { type: 'reject'; at: string };

/** Thrown when an action is not permitted from the document's current state; handlers map it to HTTP 409. */
export class IllegalTransition extends Error {
  constructor(action: Action['type'], doc: Document) {
    super(`Cannot ${action} a document that is ${doc.status}/${doc.reviewStatus}`);
    this.name = 'IllegalTransition';
  }
}

/** Applies an action, returning a new document. Throws IllegalTransition when the guard fails. */
export function transition(doc: Document, action: Action): Document {
  switch (action.type) {
    case 'start':
      if (doc.status !== 'queued') throw new IllegalTransition(action.type, doc);
      return { ...doc, status: 'processing', startedAt: action.at };

    case 'complete': {
      if (doc.status !== 'processing') throw new IllegalTransition(action.type, doc);
      const extraction = action.extraction;
      return {
        ...doc,
        status: 'completed',
        finishedAt: action.at,
        extraction,
        reviewStatus: extraction ? reviewOutcome(extraction) : 'needs_review',
      };
    }

    case 'fail':
      if (doc.status !== 'processing') throw new IllegalTransition(action.type, doc);
      return { ...doc, status: 'failed', finishedAt: action.at, error: action.error };

    case 'retry': {
      const blocked =
        doc.status !== 'failed' || !doc.error?.retryable || doc.reviewStatus === 'rejected';
      if (blocked) throw new IllegalTransition(action.type, doc);
      const { error: _dropped, finishedAt: _cleared, ...rest } = doc;
      return { ...rest, status: 'queued', attempts: doc.attempts + 1, startedAt: undefined };
    }

    case 'confirm':
      if (doc.status !== 'completed' || doc.reviewStatus !== 'needs_review')
        throw new IllegalTransition(action.type, doc);
      return { ...doc, reviewStatus: 'confirmed' };

    case 'correct': {
      if (doc.status !== 'completed' || !doc.extraction)
        throw new IllegalTransition(action.type, doc);
      const previous = doc.extraction[action.field];
      // The raw OCR text survives correction: it is the audit trail for what the machine read.
      // Confidence is dropped because a human value has no model confidence.
      const corrected = {
        status: 'corrected' as const,
        value: action.value,
        raw: previous.raw ?? (typeof previous.value === 'string' ? previous.value : undefined),
      };
      return {
        ...doc,
        extraction: { ...doc.extraction, [action.field]: corrected },
      };
    }

    case 'reject':
      if (
        (doc.status !== 'completed' && doc.status !== 'failed') ||
        doc.reviewStatus === 'confirmed'
      )
        throw new IllegalTransition(action.type, doc);
      return { ...doc, reviewStatus: 'rejected' };
  }
}
