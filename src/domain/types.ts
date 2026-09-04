/**
 * Domain vocabulary for the document-processing archive: the shapes every layer
 * (mock backend, queries, UI) agrees on. Mirrors the design spec §2.
 */

/** Where a document sits in the processing pipeline. Independent of review state. */
export type DocumentStatus = 'queued' | 'processing' | 'completed' | 'failed';

/** What a human has decided about a document's extracted data. Orthogonal to DocumentStatus. */
export type ReviewStatus = 'not_required' | 'needs_review' | 'confirmed' | 'rejected';

/** Operational bucket derived from the two status axes; never stored, always computed. */
export type Lane = 'auto_accepted' | 'needs_review' | 'recapture' | 'in_flight';

/** Why processing failed. Retryability is a property of the code, not a caller's guess. */
export type ErrorCode =
  | 'UNREADABLE_DOCUMENT'
  | 'UNSUPPORTED_FORMAT'
  | 'PROCESSING_TIMEOUT'
  | 'EXTRACTION_FAILED'
  | 'OCR_SERVICE_UNAVAILABLE';

/** A processing failure carrying its own retry eligibility so the UI never offers a doomed retry. */
export type ProcessingError = {
  code: ErrorCode;
  message: string;
  retryable: boolean;
};

/** Retry eligibility per error code. The single source of truth for the `retryable` flag. */
export const RETRYABLE: Record<ErrorCode, boolean> = {
  UNREADABLE_DOCUMENT: false,
  UNSUPPORTED_FORMAT: false,
  PROCESSING_TIMEOUT: true,
  EXTRACTION_FAILED: true,
  OCR_SERVICE_UNAVAILABLE: true,
};

/**
 * Why a field looks the way it does. Distinguishing these is the whole point of the
 * "make missing/uncertain data visible" requirement — a bare dash hides all five cases.
 */
export type FieldStatus =
  'extracted' | 'uncertain' | 'missing' | 'unreadable' | 'not_applicable' | 'corrected';

/** One extracted value: normalized form, the raw OCR text behind it, and how sure we are. */
export type ExtractedField<T = string> = {
  status: FieldStatus;
  /** Normalized: E.164 phone, ISO date, canonical program/location name. */
  value?: T;
  /** What OCR actually read. Shown alongside `value` when the two differ. */
  raw?: string;
  /** 0..1. Absent for `missing` and `not_applicable`, which have nothing to be confident about. */
  confidence?: number;
};

export type DocumentType =
  'enrollment' | 'medical_intake' | 'id_scan' | 'handwritten_note' | 'unknown';

/** The normalized record a processed document produces. Fields absent for a type are not_applicable. */
export type NormalizedRecord = {
  documentType: ExtractedField<DocumentType>;
  personName: ExtractedField;
  phone: ExtractedField;
  location: ExtractedField;
  programName: ExtractedField;
  date: ExtractedField;
};

/** A single archived file and everything known about processing it. */
export type Document = {
  id: string;
  batchId: string;
  fileName: string;
  mimeType: string;
  size: number;
  status: DocumentStatus;
  reviewStatus: ReviewStatus;
  /** Processing attempts so far; incremented by retry. */
  attempts: number;
  error?: ProcessingError;
  /** Present only when status is 'completed'. */
  extraction?: NormalizedRecord;
  uploadedAt: string;
  startedAt?: string;
  finishedAt?: string;
};

/** One upload operation and its rolled-up counts, as the dashboard's headline numbers. */
export type Batch = {
  id: string;
  name: string;
  createdAt: string;
  counts: Record<DocumentStatus, number> & {
    needsReview: number;
    confirmed: number;
    rejected: number;
    total: number;
  };
  /** Documents finishing per second right now; drives the ETA. */
  throughputPerSec: number;
  /** Seconds until the batch drains, or null when nothing is in flight. */
  etaSeconds: number | null;
};

/** Confidence bands. Thresholds are a documented product assumption, not a fact about OCR. */
export const CONFIDENCE = { high: 0.9, review: 0.7 } as const;
