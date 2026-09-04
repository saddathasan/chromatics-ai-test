// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { StatsStrip } from './StatsStrip';
import type { Batch } from '../../domain/types';

const batch = (over: Partial<Batch['counts']> = {}, rest: Partial<Batch> = {}): Batch => ({
  id: 'batch_archive',
  name: 'Kurigram field drives 2024',
  createdAt: '2026-09-04T09:12:00.000Z',
  counts: {
    queued: 8_000,
    processing: 5_571,
    completed: 86_025,
    failed: 404,
    needsReview: 4_821,
    confirmed: 0,
    rejected: 0,
    total: 100_000,
    ...over,
  },
  throughputPerSec: 34,
  etaSeconds: 399,
  ...rest,
});

const props = {
  batches: [batch()],
  samples: [10, 20, 30],
  onFilter: vi.fn(),
  search: { page: 1 },
  updatedAt: Date.now(),
};

describe('StatsStrip', () => {
  it('leads with how much is left, summed across every batch', () => {
    render(<StatsStrip {...props} batches={[batch(), batch({}, { id: 'b2' })]} />);
    expect(screen.getByRole('heading', { level: 2 })).toHaveTextContent(
      '172,050 of 200,000 processed',
    );
  });

  it('states throughput and a human ETA rather than a raw second count', () => {
    render(<StatsStrip {...props} />);
    expect(screen.getByText('34/s')).toBeInTheDocument();
    expect(screen.getByText(/6 min 39 s/)).toBeInTheDocument();
  });

  it('says the work is done instead of showing an ETA of nothing', () => {
    render(
      <StatsStrip
        {...props}
        batches={[batch({ queued: 0, processing: 0 }, { etaSeconds: null, throughputPerSec: 0 })]}
      />,
    );
    expect(screen.getByText(/nothing in flight/i)).toBeInTheDocument();
  });

  it('renders every count as a filter button, not as a read-only tile', () => {
    render(<StatsStrip {...props} />);
    for (const name of [/^all/i, /in flight/i, /needs review/i, /failed/i, /completed/i]) {
      expect(screen.getByRole('button', { name })).toBeInTheDocument();
    }
  });

  it('writes the filter the API can actually honour', () => {
    const onFilter = vi.fn();
    render(<StatsStrip {...props} onFilter={onFilter} />);

    fireEvent.click(screen.getByRole('button', { name: /in flight/i }));
    expect(onFilter).toHaveBeenCalledWith({
      status: ['queued', 'processing'],
      review: undefined,
      page: 1,
    });

    fireEvent.click(screen.getByRole('button', { name: /needs review/i }));
    expect(onFilter).toHaveBeenCalledWith({
      status: undefined,
      review: ['needs_review'],
      page: 1,
    });
  });

  it('marks the active chip as pressed so the filter is not colour-only', () => {
    render(<StatsStrip {...props} search={{ page: 1, review: ['needs_review'] }} />);
    expect(screen.getByRole('button', { name: /needs review/i })).toHaveAttribute(
      'aria-pressed',
      'true',
    );
    expect(screen.getByRole('button', { name: /^all/i })).toHaveAttribute('aria-pressed', 'false');
  });

  it('says the feed is live while work is in flight, and idle once it drains', () => {
    const { rerender } = render(<StatsStrip {...props} />);
    expect(screen.getByText(/^live · updated/i)).toBeInTheDocument();

    rerender(
      <StatsStrip
        {...props}
        batches={[batch({ queued: 0, processing: 0 }, { throughputPerSec: 0 })]}
      />,
    );
    expect(screen.getByText(/^idle · updated/i)).toBeInTheDocument();
  });

  it('describes the sparkline for anyone who cannot see it', () => {
    render(<StatsStrip {...props} />);
    expect(screen.getByRole('img', { name: /completed per poll/i })).toBeInTheDocument();
  });

  it('omits the sparkline until there is more than one sample to draw', () => {
    render(<StatsStrip {...props} samples={[10]} />);
    expect(screen.queryByRole('img')).not.toBeInTheDocument();
  });
});
