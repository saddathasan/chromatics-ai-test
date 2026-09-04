// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { QueueList } from './QueueList';
import type { QueueItem } from './queue';

const items = (n: number): QueueItem[] =>
  Array.from({ length: n }, (_, i) => ({
    key: `k${i}`,
    name: i % 2 === 0 ? `kurigram/scan-${i}.pdf` : `sylhet/scan-${i}.pdf`,
    size: 100,
    mimeType: 'application/pdf',
    state: 'pending',
    attempts: 0,
  }));

describe('QueueList', () => {
  it('renders a window, not ten thousand rows', () => {
    render(<QueueList items={items(10_000)} />);
    const rows = screen.getAllByRole('row');
    expect(rows.length).toBeLessThan(30);
    // The full count is still announced, which is what aria-rowcount exists for.
    expect(screen.getByRole('grid')).toHaveAttribute('aria-rowcount', '10000');
    expect(rows[0]).toHaveAttribute('aria-rowindex', '1');
  });

  it('moves the window as the list scrolls', () => {
    render(<QueueList items={items(10_000)} />);
    fireEvent.scroll(screen.getByRole('grid'), { target: { scrollTop: 2600 } });
    expect(screen.getAllByRole('row')[0]).toHaveAttribute('aria-rowindex', '97');
  });

  it('narrows to the failures, which are otherwise unfindable by scrolling', () => {
    const queue = items(600);
    queue[417].state = 'failed';
    queue[417].attempts = 1;
    render(<QueueList items={queue} />);
    fireEvent.click(screen.getByRole('checkbox', { name: /failed only \(1\)/i }));
    expect(screen.getAllByRole('row')).toHaveLength(1);
    expect(screen.getByText('failed after retry')).toBeInTheDocument();
  });

  it('offers no failed-only toggle while nothing has failed', () => {
    render(<QueueList items={items(10)} />);
    expect(screen.queryByRole('checkbox')).not.toBeInTheDocument();
  });

  it('filters by name, because a queue you cannot search is a wall', () => {
    render(<QueueList items={items(1000)} />);
    fireEvent.change(screen.getByRole('searchbox', { name: /filter the queue/i }), {
      target: { value: 'sylhet' },
    });
    expect(screen.getByRole('grid')).toHaveAttribute('aria-rowcount', '500');
    expect(screen.getByText('500 of 1,000 files')).toBeInTheDocument();
  });
});
