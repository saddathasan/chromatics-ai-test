/**
 * The dashboard's URL contract. Filters, sort, page and the open document live in the query
 * string rather than component state, so a view is shareable, survives reload, and the back
 * button undoes a filter. Every list query is keyed off this shape.
 */
import type { DocumentStatus, DocumentType, ReviewStatus } from '../domain/types';

export const SORT_KEYS = [
  'uploadedAt',
  '-uploadedAt',
  'fileName',
  '-fileName',
  'confidence',
  '-confidence',
] as const;
export type SortKey = (typeof SORT_KEYS)[number];

const STATUSES: DocumentStatus[] = ['queued', 'processing', 'completed', 'failed'];
const REVIEWS: ReviewStatus[] = ['not_required', 'needs_review', 'confirmed', 'rejected'];
const TYPES: DocumentType[] = [
  'enrollment',
  'medical_intake',
  'id_scan',
  'handwritten_note',
  'unknown',
];

export type DocumentSearch = {
  q?: string;
  status?: DocumentStatus[];
  review?: ReviewStatus[];
  type?: DocumentType[];
  batch?: string;
  sort?: SortKey;
  /** 1-based; out-of-range input clamps to 1 rather than erroring the route. */
  page: number;
  /** Id of the document whose detail drawer is open. */
  doc?: string;
};

/** Keeps only values in `allowed`, accepting a bare string or an array, dropping empties. */
function enums<T extends string>(raw: unknown, allowed: readonly T[]): T[] | undefined {
  const list = Array.isArray(raw) ? raw : typeof raw === 'string' ? [raw] : [];
  const kept = list.filter((v): v is T => allowed.includes(v as T));
  return kept.length ? kept : undefined;
}

function text(raw: unknown): string | undefined {
  return typeof raw === 'string' && raw.trim() ? raw.trim() : undefined;
}

/**
 * Parses untrusted URL input into the typed shape. Unknown or malformed values are dropped
 * rather than rejected: a hand-edited URL should degrade to a usable view, never a crash.
 */
export function parseDocumentSearch(raw: Record<string, unknown>): DocumentSearch {
  const page = Number(raw.page);
  return {
    q: text(raw.q),
    status: enums(raw.status, STATUSES),
    review: enums(raw.review, REVIEWS),
    type: enums(raw.type, TYPES),
    batch: text(raw.batch),
    sort: enums(raw.sort, SORT_KEYS)?.[0],
    page: Number.isInteger(page) && page > 0 ? page : 1,
    doc: text(raw.doc),
  };
}
