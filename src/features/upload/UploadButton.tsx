/**
 * The app bar's entry point to uploading. Owns nothing but whether the dialog is mounted;
 * unmounting it is also what discards a finished queue, so a second upload starts clean.
 */
import { useState } from 'react';
import { useNavigate } from '@tanstack/react-router';
import { UploadDialog } from './UploadDialog';

export function UploadButton() {
  const [open, setOpen] = useState(false);
  const navigate = useNavigate();

  return (
    <>
      <button
        type="button"
        className="border border-ink bg-ink px-3 py-1.5 text-paper"
        onClick={() => setOpen(true)}
      >
        Upload documents
      </button>
      {open ? (
        <UploadDialog
          onClose={() => setOpen(false)}
          onViewBatch={(batch) => {
            setOpen(false);
            // Straight to the new batch, filtered - the whole point of the upload was these files.
            void navigate({ to: '/', search: { batch, page: 1 } });
          }}
        />
      ) : null}
    </>
  );
}
