/**
 * The words the interface uses for domain values, in one place. Three components were each
 * carrying their own copy of these maps, which is how a table ends up saying `id_scan` while
 * the drawer beside it says "ID scan".
 */
import type { DocumentType, NormalizedRecord } from '../domain/types';

export const FIELD_LABEL: Record<keyof NormalizedRecord, string> = {
  documentType: 'Document type',
  personName: 'Person name',
  phone: 'Phone',
  location: 'Location',
  programName: 'Programme',
  date: 'Date',
};

export const DOCUMENT_TYPE_LABEL: Record<DocumentType, string> = {
  enrollment: 'Enrollment',
  medical_intake: 'Medical intake',
  id_scan: 'ID scan',
  handwritten_note: 'Handwritten note',
  unknown: 'Unknown',
};

/** The extracted document type as a person would write it, or nothing if it was never read. */
export const documentTypeLabel = (value: DocumentType | undefined): string =>
  value ? (DOCUMENT_TYPE_LABEL[value] ?? '') : '';
