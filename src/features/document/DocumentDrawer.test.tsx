// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeAll, describe, expect, it, vi } from 'vitest';
import { DocumentDrawer } from './DocumentDrawer';
import type { Document } from '../../domain/types';

/**
 * jsdom 30 still has no HTMLDialogElement.showModal, so the real focus trap, Escape handling and
 * inert background - all of which the browser gives us for free - cannot be exercised here.
 * The shim only makes the element render; what is asserted below is our own behaviour.
 */
beforeAll(() => {
  const proto = window.HTMLDialogElement.prototype;
  proto.showModal = function showModal(this: HTMLDialogElement) {
    this.open = true;
  };
  proto.close = function close(this: HTMLDialogElement) {
    this.open = false;
    this.dispatchEvent(new Event('close'));
  };
});

const doc = (over: Partial<Document> = {}): Document => ({
  id: 'doc_1',
  batchId: 'batch_archive',
  fileName: 'intake_scan_88.pdf',
  mimeType: 'application/pdf',
  size: 1_800_000,
  status: 'completed',
  reviewStatus: 'needs_review',
  attempts: 2,
  uploadedAt: '2026-09-04T09:12:00.000Z',
  startedAt: '2026-09-04T09:12:14.000Z',
  finishedAt: '2026-09-04T09:12:54.000Z',
  extraction: {
    documentType: { status: 'extracted', value: 'medical_intake', confidence: 0.98 },
    personName: { status: 'uncertain', value: 'Rahima Khatun', confidence: 0.66 },
    phone: { status: 'extracted', value: '+8801712345402', confidence: 0.91 },
    location: { status: 'extracted', value: 'Kurigram', confidence: 0.93 },
    programName: { status: 'extracted', value: 'Safe Motherhood', confidence: 0.9 },
    date: { status: 'missing' },
  },
  ...over,
});

const props = {
  doc: doc(),
  isPending: false,
  error: null,
  pending: false,
  returnFocusTo: 'doc_1',
  onClose: vi.fn(),
  onConfirm: vi.fn(),
  onReject: vi.fn(),
  onRetry: vi.fn(),
  onCorrect: vi.fn(),
};

/** Stands in for the table row the drawer was opened from. */
function withRow(ui: React.ReactElement) {
  return render(
    <>
      <button type="button" data-doc-id="doc_1">
        intake_scan_88.pdf
      </button>
      {ui}
    </>,
  );
}

describe('DocumentDrawer', () => {
  it('returns focus to the row it was opened from', async () => {
    const onClose = vi.fn();
    const { rerender } = withRow(<DocumentDrawer {...props} onClose={onClose} />);

    rerender(
      <>
        <button type="button" data-doc-id="doc_1">
          intake_scan_88.pdf
        </button>
      </>,
    );
    // Deferred a tick, so the browser's own focus fixup cannot overwrite it as the dialog leaves.
    await waitFor(() => expect(document.querySelector('[data-doc-id="doc_1"]')).toHaveFocus());
  });

  it('closes when the dialog itself is dismissed, so Escape needs no handler of ours', () => {
    const onClose = vi.fn();
    withRow(<DocumentDrawer {...props} onClose={onClose} />);
    fireEvent(screen.getByRole('dialog', { hidden: true }), new Event('close'));
    expect(onClose).toHaveBeenCalled();
  });

  it('names the document and both raw status axes in the header', () => {
    withRow(<DocumentDrawer {...props} />);
    expect(screen.getByRole('heading', { name: 'intake_scan_88.pdf' })).toBeInTheDocument();
    // Both raw axes plus the attempt count, in one line under the lane.
    expect(screen.getByText('completed · needs review · attempt 3')).toBeInTheDocument();
  });

  it('shows the phone in full here, where the table masked it', () => {
    withRow(<DocumentDrawer {...props} />);
    expect(screen.getByText('+8801712345402')).toBeInTheDocument();
  });

  it('reports a document that could not be loaded instead of rendering an empty panel', () => {
    withRow(<DocumentDrawer {...props} doc={undefined} error={new Error('not found')} />);
    expect(screen.getByRole('alert')).toHaveTextContent(/not found/i);
  });

  it('has no field list to show while the document is still loading', () => {
    withRow(<DocumentDrawer {...props} doc={undefined} isPending />);
    expect(screen.getByRole('status')).toHaveAttribute('aria-busy', 'true');
    expect(screen.queryByText(/flagged only/i)).not.toBeInTheDocument();
  });
});
