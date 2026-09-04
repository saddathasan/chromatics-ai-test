/**
 * The bulk upload dialog: select, validate, watch it drain. Native <dialog> again, for the
 * same reason the detail drawer uses one - the platform owns the focus trap and Escape, and
 * nothing here needs behaviour a library would have to supply.
 */
import { useEffect, useMemo, useRef, useState } from 'react';
import { count, duration } from '../../lib/format';
import { QueueList } from './QueueList';
import { useFileSelection, useUploadQueue } from './useUpload';
import { SKIP_REASON, type Skipped } from './validate';

/** React passes unknown lowercase attributes straight through; the DOM type has no name for these. */
const DIRECTORY_PICKER = { webkitdirectory: '', directory: '' } as Record<string, string>;

const NAMED = new Intl.DateTimeFormat('en-GB', {
  day: 'numeric',
  month: 'short',
  hour: '2-digit',
  minute: '2-digit',
});

/** Refusals are grouped by reason: eighty-eight lines of "unsupported" is not a summary. */
function reasons(skipped: Skipped[]): string[] {
  const tally = new Map<string, number>();
  for (const item of skipped) tally.set(item.reason, (tally.get(item.reason) ?? 0) + 1);
  return [...tally].map(([reason, n]) => `${count(n)} ${SKIP_REASON[reason as Skipped['reason']]}`);
}

export function UploadDialog({
  onClose,
  onViewBatch,
}: {
  onClose: () => void;
  onViewBatch: (batchId: string) => void;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  const filesInput = useRef<HTMLInputElement>(null);
  const folderInput = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);
  const [name, setName] = useState(() => `Upload ${NAMED.format(new Date())}`);

  const selection = useFileSelection();
  const upload = useUploadQueue(selection.items);
  const { total, settled, done, failed, ratePerSec, etaSeconds } = upload.aggregate;

  useEffect(() => dialog.current?.showModal(), []);

  // Closing stops the upload, which is exactly what the warning above the queue promises.
  const close = () => {
    upload.cancel();
    onClose();
  };

  /** Announced at each tenth, because a screen reader reciting every file is unusable. */
  const decile = total > 0 ? Math.floor((settled / total) * 10) * 10 : 0;
  const announcement =
    upload.phase === 'uploading' ? `Uploading. ${decile} percent of ${count(total)} files.` : '';

  const summary = useMemo(() => reasons(selection.skipped), [selection.skipped]);
  const idle = upload.phase === 'idle';

  return (
    <dialog
      ref={dialog}
      aria-label="Upload documents"
      onClose={close}
      className="m-auto w-[min(760px,calc(100%-2rem))] max-w-none border border-rule-strong bg-paper p-0 text-ink backdrop:bg-ink/40"
    >
      <div className="flex items-baseline gap-3 border-b border-rule-strong px-6 py-3">
        <h3 className="text-lg font-semibold">Upload documents</h3>
        <span className="flex-1" />
        <form method="dialog">
          <button type="submit" className="text-ink-muted underline underline-offset-[3px]">
            Close
          </button>
        </form>
      </div>

      <div className="px-6 py-4">
        {upload.phase === 'idle' || upload.phase === 'uploading' ? (
          <p className="m-0 mb-4 border-l-2 border-attention bg-tint-attention px-3 py-2 text-[15px]">
            Keep this tab open — uploading stops if you close it. Anything already uploaded keeps
            processing.
          </p>
        ) : null}

        {idle ? (
          <>
            <div
              onDragOver={(event) => {
                event.preventDefault();
                setDragging(true);
              }}
              onDragLeave={() => setDragging(false)}
              onDrop={(event) => {
                event.preventDefault();
                setDragging(false);
                void selection.addFromDrop(event.dataTransfer);
              }}
              className={`flex flex-col items-center gap-3 border border-dashed px-6 py-8 ${
                dragging ? 'border-focus bg-tint-selected' : 'border-field'
              }`}
            >
              <p className="m-0 text-ink-muted">
                {selection.enumerating === null
                  ? 'Drop files or a folder here'
                  : `Reading folder — ${count(selection.enumerating)} files found`}
              </p>
              <div className="flex gap-2">
                <button
                  type="button"
                  className="border border-field px-3 py-1.5"
                  onClick={() => filesInput.current?.click()}
                >
                  Choose files
                </button>
                <button
                  type="button"
                  className="border border-field px-3 py-1.5"
                  onClick={() => folderInput.current?.click()}
                >
                  Choose folder
                </button>
              </div>
              <input
                ref={filesInput}
                type="file"
                multiple
                hidden
                onChange={(event) => selection.add([...(event.target.files ?? [])])}
              />
              <input
                ref={folderInput}
                type="file"
                multiple
                hidden
                {...DIRECTORY_PICKER}
                onChange={(event) => selection.add([...(event.target.files ?? [])])}
              />
            </div>

            {total > 0 || summary.length > 0 ? (
              <p className="mt-3 mb-0 text-[15px]">
                <strong>{count(total)} accepted</strong>
                {summary.length > 0 ? (
                  <>
                    {' · '}
                    <details className="inline">
                      <summary className="inline cursor-pointer">
                        {count(selection.skipped.length)} skipped — see why
                      </summary>
                      <span className="ml-2 text-ink-muted">{summary.join(' · ')}</span>
                    </details>
                  </>
                ) : null}
              </p>
            ) : null}

            <label className="mt-4 flex items-baseline gap-3">
              <span className="text-[13px] text-ink-muted">Batch name</span>
              <input
                value={name}
                onChange={(event) => setName(event.target.value)}
                className="flex-1 border border-field px-2 py-1"
              />
            </label>
          </>
        ) : (
          <div className="mb-4">
            <p className="m-0 flex items-baseline gap-3">
              <strong className="text-lg">
                {count(settled)} of {count(total)}
              </strong>
              <span className="text-ink-muted">
                {Math.round(ratePerSec)}/s
                {etaSeconds !== null && upload.phase === 'uploading'
                  ? ` · about ${duration(etaSeconds)} left`
                  : ''}
                {failed > 0 ? ` · ${count(failed)} failed` : ''}
              </span>
            </p>
            <progress
              value={settled}
              max={total}
              className="mt-2 h-1.5 w-full"
              aria-label="Upload progress"
            />
            <span aria-live="polite" className="sr-only">
              {announcement}
            </span>

            {upload.phase === 'error' ? (
              <p role="alert" className="mt-2 mb-0 text-failed">
                Upload could not start. {upload.error}
              </p>
            ) : null}
            {upload.phase !== 'uploading' && upload.batch ? (
              <p className="mt-2 mb-0">
                {count(done)} documents are now processing in <strong>{upload.batch.name}</strong>
                {failed > 0 ? `, and ${count(failed)} did not upload` : ''}.
              </p>
            ) : null}
          </div>
        )}

        {total > 0 ? <QueueList items={selection.items} /> : null}
      </div>

      <div className="flex items-center gap-2 border-t border-rule-strong px-6 py-3">
        {idle ? (
          <>
            <button
              type="button"
              disabled={total === 0}
              onClick={() => void upload.start(name.trim() || 'Untitled batch')}
              className="border border-ink bg-ink px-3 py-1.5 text-paper disabled:opacity-50"
            >
              Start upload
            </button>
            {total > 0 ? (
              <button
                type="button"
                className="border border-field px-3 py-1.5"
                onClick={selection.clear}
              >
                Clear selection
              </button>
            ) : null}
          </>
        ) : upload.phase === 'uploading' ? (
          <button type="button" className="border border-field px-3 py-1.5" onClick={upload.cancel}>
            Cancel remaining
          </button>
        ) : (
          <>
            {upload.batch ? (
              <button
                type="button"
                className="border border-ink bg-ink px-3 py-1.5 text-paper"
                onClick={() => onViewBatch(upload.batch!.id)}
              >
                View batch
              </button>
            ) : null}
            <button type="button" className="border border-field px-3 py-1.5" onClick={close}>
              Done
            </button>
          </>
        )}
      </div>
    </dialog>
  );
}
