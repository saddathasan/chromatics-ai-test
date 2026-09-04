// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { SelectionBar } from './SelectionBar';

const handlers = { onRetrySelected: vi.fn(), onRetryMatching: vi.fn(), onClear: vi.fn() };
const props = { selected: 3, retryable: 3, hasFilters: true, pending: false, ...handlers };

describe('SelectionBar', () => {
  it('counts what is selected and what can actually be retried', () => {
    render(<SelectionBar {...props} selected={12} retryable={5} />);
    expect(screen.getByText(/12 selected/)).toBeInTheDocument();
    // Only the retryable ones will move, so that is the number on the button.
    expect(screen.getByRole('button', { name: /retry 5 selected/i })).toBeInTheDocument();
  });

  it('refuses to offer a retry when nothing selected can be retried', () => {
    render(<SelectionBar {...props} selected={4} retryable={0} />);
    expect(screen.queryByRole('button', { name: /retry .* selected/i })).not.toBeInTheDocument();
    expect(screen.getByText(/none of these can be retried/i)).toBeInTheDocument();
  });

  it('offers the wider, filter-scoped retry as a separate act', () => {
    render(<SelectionBar {...props} />);
    fireEvent.click(screen.getByRole('button', { name: /matching these filters/i }));
    expect(handlers.onRetryMatching).toHaveBeenCalled();
  });

  it('says "the whole archive" rather than "these filters" when nothing is filtered', () => {
    render(<SelectionBar {...props} hasFilters={false} />);
    expect(screen.getByRole('button', { name: /the whole archive/i })).toBeInTheDocument();
  });

  it('blocks every action while a bulk retry is in flight', () => {
    render(<SelectionBar {...props} pending />);
    for (const button of screen.getAllByRole('button')) expect(button).toBeDisabled();
  });
});
