/**
 * The gate between a file selection and the upload queue. Every refusal carries a reason,
 * because "88 skipped" without a why is the point where an operator stops trusting the tool.
 */
import type { QueueItem } from './queue';

export type SkipReason = 'unsupported' | 'empty' | 'too_large' | 'duplicate';
export type Skipped = { name: string; reason: SkipReason };

/** What a scanning station actually produces. Anything else is a mis-drop, not a document. */
const ACCEPTED: Record<string, string> = {
  pdf: 'application/pdf',
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  png: 'image/png',
  tif: 'image/tiff',
  tiff: 'image/tiff',
};

/** A scanned page past this is a mis-scan, and the queue is not where that gets discovered. */
export const MAX_BYTES = 25 * 1024 * 1024;

/**
 * Identity of a file within one upload. Folder-relative path rather than name: two `intake.pdf`
 * from two districts are two documents, and collapsing them would drop real data.
 */
const clientKey = (file: File) =>
  `${file.webkitRelativePath || file.name}:${file.size}:${file.lastModified}`;

/** Dropped folders often arrive with an empty `type`, so the extension is the reliable source. */
const mimeOf = (file: File) => ACCEPTED[file.name.split('.').pop()?.toLowerCase() ?? ''];

/**
 * Validates a selection against an existing one, so a second drop of the same folder adds
 * nothing rather than doubling the batch.
 */
export function validate(
  files: File[],
  existing: QueueItem[] = []
): { accepted: QueueItem[]; skipped: Skipped[] } {
  const seen = new Set(existing.map((item) => item.key));
  const accepted: QueueItem[] = [];
  const skipped: Skipped[] = [];

  for (const file of files) {
    const mimeType = mimeOf(file);
    const key = clientKey(file);
    const reason: SkipReason | undefined = !mimeType
      ? 'unsupported'
      : file.size === 0
        ? 'empty'
        : file.size > MAX_BYTES
          ? 'too_large'
          : seen.has(key)
            ? 'duplicate'
            : undefined;

    if (reason) {
      skipped.push({ name: file.name, reason });
      continue;
    }
    seen.add(key);
    accepted.push({
      key,
      name: file.webkitRelativePath || file.name,
      size: file.size,
      mimeType,
      state: 'pending',
      attempts: 0,
    });
  }

  return { accepted, skipped };
}

/** Plain wording for the summary line; a reason code in the UI is a bug report, not an answer. */
export const SKIP_REASON: Record<SkipReason, string> = {
  unsupported: 'not a PDF, JPEG, PNG or TIFF',
  empty: 'empty file',
  too_large: 'larger than 25 MB',
  duplicate: 'already in this upload',
};
