// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { ReviewActions } from './ReviewActions';
import type { Document } from '../../domain/types';

const doc = (over: Partial<Document> = {}): Document => ({
  id: 'doc_1',
  batchId: 'batch_archive',
  fileName: 'intake_scan_88.pdf',
  mimeType: 'application/pdf',
  size: 1_800_000,
  status: 'completed',
  reviewStatus: 'needs_review',
  attempts: 0,
  uploadedAt: '2026-09-04T09:12:00.000Z',
  ...over,
});

const handlers = { onConfirm: vi.fn(), onReject: vi.fn(), onRetry: vi.fn() };

const failed = (retryable: boolean, code: Document['error'] extends infer _ ? string : never) =>
  doc({
    status: 'failed',
    reviewStatus: 'not_required',
    error: {
      code: code as never,
      message: retryable ? 'OCR worker exceeded 30 s' : 'HEIC is not a supported format',
      retryable,
    },
  });

describe('ReviewActions', () => {
  it('offers confirm and reject on a document awaiting review', () => {
    render(<ReviewActions doc={doc()} pending={false} {...handlers} />);
    expect(screen.getByRole('button', { name: /confirm/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /reject/i })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /retry/i })).not.toBeInTheDocument();
  });

  it('withdraws confirm and reject once the document is confirmed', () => {
    render(<ReviewActions doc={doc({ reviewStatus: 'confirmed' })} pending={false} {...handlers} />);
    expect(screen.queryByRole('button', { name: /confirm/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /reject/i })).not.toBeInTheDocument();
    expect(screen.getByText(/confirmed/i)).toBeInTheDocument();
  });

  it('offers retry for a retryable failure and explains why it can be retried', () => {
    render(<ReviewActions doc={failed(true, 'PROCESSING_TIMEOUT')} pending={false} {...handlers} />);
    expect(screen.getByRole('button', { name: /retry/i })).toBeInTheDocument();
    expect(screen.getByText(/fault in the pipeline, not in the paper/i)).toBeInTheDocument();
  });

  it('omits retry entirely for a dead-end failure and says what to do instead', () => {
    render(
      <ReviewActions doc={failed(false, 'UNSUPPORTED_FORMAT')} pending={false} {...handlers} />
    );
    // Absent, not disabled: a disabled button invites a click that can never work.
    expect(screen.queryByRole('button', { name: /retry/i })).not.toBeInTheDocument();
    expect(screen.getByText(/replace the file/i)).toBeInTheDocument();
    expect(screen.getByText(/HEIC is not a supported format/)).toBeInTheDocument();
  });

  it('reports the action the operator asked for', () => {
    const onConfirm = vi.fn();
    render(<ReviewActions doc={doc()} pending={false} {...handlers} onConfirm={onConfirm} />);
    fireEvent.click(screen.getByRole('button', { name: /confirm/i }));
    expect(onConfirm).toHaveBeenCalled();
  });

  it('blocks a second click while the first is still in flight', () => {
    const onConfirm = vi.fn();
    render(<ReviewActions doc={doc()} pending {...handlers} onConfirm={onConfirm} />);
    const confirm = screen.getByRole('button', { name: /confirm/i });
    expect(confirm).toBeDisabled();
    fireEvent.click(confirm);
    expect(onConfirm).not.toHaveBeenCalled();
  });

  it('still allows rejecting an auto-accepted document, which the transition table permits', () => {
    // High confidence is not proof: an operator who sees the extraction is wrong can still
    // reject it. Confirm is gone because there is no review outstanding to confirm.
    render(<ReviewActions doc={doc({ reviewStatus: 'not_required' })} pending={false} {...handlers} />);
    expect(screen.queryByRole('button', { name: /confirm/i })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: /reject/i })).toBeInTheDocument();
  });

  it('says nothing is left to decide once a document is rejected', () => {
    render(<ReviewActions doc={doc({ reviewStatus: 'rejected' })} pending={false} {...handlers} />);
    expect(screen.queryByRole('button')).not.toBeInTheDocument();
    expect(screen.getByText(/needs a fresh capture/i)).toBeInTheDocument();
  });
});
