// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest';
import { fireEvent, render, screen, within } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { DocumentsTable } from './DocumentsTable';
import type { Document } from '../../domain/types';

const doc = (over: Partial<Document> = {}): Document => ({
  id: 'doc_1',
  batchId: 'batch_archive',
  fileName: 'intake_scan_88.pdf',
  mimeType: 'application/pdf',
  size: 1_800_000,
  status: 'completed',
  reviewStatus: 'not_required',
  attempts: 0,
  uploadedAt: '2026-09-04T09:12:00.000Z',
  ...over,
});

const props = {
  docs: [doc()],
  isPending: false,
  error: null,
  hasFilters: false,
  sort: undefined,
  onSort: vi.fn(),
  onOpen: vi.fn(),
  onRetry: vi.fn(),
  onClearFilters: vi.fn(),
};

describe('DocumentsTable states', () => {
  it('shows a first-run empty state when nothing is filtered', () => {
    render(<DocumentsTable {...props} docs={[]} />);
    expect(screen.getByText(/no documents yet/i)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /clear filters/i })).not.toBeInTheDocument();
  });

  it('offers to clear filters when a filter hid everything', () => {
    const onClearFilters = vi.fn();
    render(<DocumentsTable {...props} docs={[]} hasFilters onClearFilters={onClearFilters} />);
    expect(screen.getByText(/no documents match/i)).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /clear filters/i }));
    expect(onClearFilters).toHaveBeenCalled();
  });

  it('offers a retry on error', () => {
    const onRetry = vi.fn();
    render(<DocumentsTable {...props} docs={[]} error={new Error('offline')} onRetry={onRetry} />);
    expect(screen.getByRole('alert')).toHaveTextContent(/offline/i);
    fireEvent.click(screen.getByRole('button', { name: /try again/i }));
    expect(onRetry).toHaveBeenCalled();
  });

  it('marks the loading skeleton as busy rather than announcing an empty table', () => {
    render(<DocumentsTable {...props} docs={[]} isPending />);
    expect(screen.getByRole('status')).toHaveAttribute('aria-busy', 'true');
    expect(screen.queryByText(/no documents/i)).not.toBeInTheDocument();
  });
});

describe('DocumentsTable rows', () => {
  // The load-bearing accessibility rule: colour is never the only carrier of state.
  it.each([
    ['in_flight', 'In flight', doc({ status: 'processing' })],
    ['needs_review', 'Needs review', doc({ reviewStatus: 'needs_review' })],
    [
      'needs_review',
      'Needs review',
      doc({
        status: 'failed',
        error: { code: 'PROCESSING_TIMEOUT', message: 'timed out', retryable: true },
      }),
    ],
    [
      'recapture',
      'Recapture',
      doc({
        status: 'failed',
        error: { code: 'UNSUPPORTED_FORMAT', message: 'not supported', retryable: false },
      }),
    ],
    ['recapture', 'Recapture', doc({ reviewStatus: 'rejected' })],
    ['auto_accepted', 'Auto-accepted', doc()],
  ])('renders lane %s as a word, not only a colour', (_lane, label, document) => {
    render(<DocumentsTable {...props} docs={[document]} />);
    expect(screen.getByText(label)).toBeInTheDocument();
  });

  it('repeats the lane as a margin mark that is hidden from screen readers', () => {
    render(<DocumentsTable {...props} docs={[doc({ reviewStatus: 'needs_review' })]} />);
    const mark = document.querySelector('.c-mark[aria-hidden="true"]');
    expect(mark).toHaveTextContent('!');
  });

  it('shows the raw status pair beneath the lane so the two axes stay visible', () => {
    render(
      <DocumentsTable
        {...props}
        docs={[
          doc({
            status: 'failed',
            error: { code: 'PROCESSING_TIMEOUT', message: 'timed out', retryable: true },
          }),
        ]}
      />,
    );
    expect(screen.getByText(/failed · timed out · retryable/i)).toBeInTheDocument();
  });

  it('names the field that flagged the document, not just that it is flagged', () => {
    // "Needs review" beside 0.97 High reads as a contradiction until the missing field is named.
    render(
      <DocumentsTable
        {...props}
        docs={[
          doc({
            reviewStatus: 'needs_review',
            extraction: {
              documentType: { status: 'extracted', value: 'id_scan', confidence: 0.97 },
              personName: { status: 'extracted', value: 'Abdul Karim', confidence: 0.97 },
              phone: { status: 'extracted', value: '+8801712345402', confidence: 0.98 },
              location: { status: 'extracted', value: 'Kurigram', confidence: 0.99 },
              programName: { status: 'extracted', value: 'Safe Motherhood', confidence: 0.97 },
              date: { status: 'missing' },
            },
          }),
        ]}
      />,
    );
    expect(screen.getByText('completed · date missing')).toBeInTheDocument();
  });

  it('counts the flagged fields when more than one is at fault', () => {
    render(
      <DocumentsTable
        {...props}
        docs={[
          doc({
            reviewStatus: 'needs_review',
            extraction: {
              documentType: { status: 'extracted', value: 'id_scan', confidence: 0.97 },
              personName: { status: 'uncertain', value: 'Abdul Karim', confidence: 0.4 },
              phone: { status: 'unreadable' },
              location: { status: 'extracted', value: 'Kurigram', confidence: 0.99 },
              programName: { status: 'extracted', value: 'Safe Motherhood', confidence: 0.97 },
              date: { status: 'missing' },
            },
          }),
        ]}
      />,
    );
    expect(screen.getByText('completed · 3 fields flagged')).toBeInTheDocument();
  });

  it('shows the confidence of the weakest field, not a blank cell', () => {
    render(
      <DocumentsTable
        {...props}
        docs={[
          doc({
            extraction: {
              documentType: { status: 'extracted', value: 'medical_intake', confidence: 0.98 },
              personName: { status: 'uncertain', value: 'Rahima Khatun', confidence: 0.66 },
              phone: { status: 'extracted', value: '+8801712345402', confidence: 0.91 },
              location: { status: 'extracted', value: 'Kurigram', confidence: 0.93 },
              programName: { status: 'extracted', value: 'Safe Motherhood', confidence: 0.9 },
              date: { status: 'missing' },
            },
          }),
        ]}
      />,
    );
    expect(screen.getByText('0.66')).toBeInTheDocument();
    expect(screen.getByText(/review required/i)).toBeInTheDocument();
  });

  it('opens a document by its file name', () => {
    const onOpen = vi.fn();
    render(<DocumentsTable {...props} onOpen={onOpen} />);
    fireEvent.click(screen.getByRole('button', { name: 'intake_scan_88.pdf' }));
    expect(onOpen).toHaveBeenCalledWith('doc_1');
  });

  it('sorts by a column header and flips the direction on a second press', () => {
    const onSort = vi.fn();
    const { rerender } = render(<DocumentsTable {...props} onSort={onSort} />);
    fireEvent.click(screen.getByRole('button', { name: /file/i }));
    expect(onSort).toHaveBeenCalledWith('fileName');

    rerender(<DocumentsTable {...props} sort="fileName" onSort={onSort} />);
    const header = screen.getByRole('columnheader', { name: /file/i });
    expect(header).toHaveAttribute('aria-sort', 'ascending');
    fireEvent.click(within(header).getByRole('button'));
    expect(onSort).toHaveBeenCalledWith('-fileName');
  });

  it('masks the phone number in the list, where the drawer shows it in full', () => {
    render(
      <DocumentsTable
        {...props}
        docs={[
          doc({
            extraction: {
              documentType: { status: 'extracted', value: 'medical_intake', confidence: 0.98 },
              personName: { status: 'extracted', value: 'Rahima Khatun', confidence: 0.95 },
              phone: { status: 'extracted', value: '+8801712345402', confidence: 0.91 },
              location: { status: 'extracted', value: 'Kurigram', confidence: 0.93 },
              programName: { status: 'extracted', value: 'Safe Motherhood', confidence: 0.9 },
              date: { status: 'extracted', value: '2026-08-31', confidence: 0.94 },
            },
          }),
        ]}
      />,
    );
    expect(screen.getByText('Rahima Khatun')).toBeInTheDocument();
    expect(screen.queryByText('+8801712345402')).not.toBeInTheDocument();
    expect(screen.getByText(/•/)).toBeInTheDocument();
  });
});
