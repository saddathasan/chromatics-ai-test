// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest';
import { act, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { FilterBar } from './FilterBar';
import type { DocumentSearch } from '../../app/search';

const search: DocumentSearch = { page: 1 };
const batches = [{ id: 'batch_archive', name: 'Kurigram field drives 2024' }];

describe('FilterBar', () => {
  beforeEach(() => vi.useFakeTimers({ shouldAdvanceTime: true }));
  afterEach(() => vi.useRealTimers());

  it('debounces the search box so a poll is not fired per keystroke', () => {
    const onChange = vi.fn();
    render(<FilterBar search={search} batches={batches} onChange={onChange} />);

    fireEvent.change(screen.getByRole('searchbox', { name: /search/i }), {
      target: { value: 'intake' },
    });
    expect(onChange).not.toHaveBeenCalled();

    act(() => void vi.advanceTimersByTime(300));
    expect(onChange).toHaveBeenCalledWith({ q: 'intake', page: 1 });
  });

  it('clears the search term rather than sending an empty string', () => {
    const onChange = vi.fn();
    render(<FilterBar search={{ ...search, q: 'intake' }} batches={batches} onChange={onChange} />);

    fireEvent.change(screen.getByRole('searchbox', { name: /search/i }), { target: { value: '' } });
    act(() => void vi.advanceTimersByTime(300));
    expect(onChange).toHaveBeenCalledWith({ q: undefined, page: 1 });
  });

  it('writes the document type and resets to the first page', () => {
    const onChange = vi.fn();
    render(<FilterBar search={{ ...search, page: 7 }} batches={batches} onChange={onChange} />);

    fireEvent.change(screen.getByRole('combobox', { name: /type/i }), {
      target: { value: 'medical_intake' },
    });
    expect(onChange).toHaveBeenCalledWith({ type: ['medical_intake'], page: 1 });
  });

  it('drops the type filter when All types is chosen', () => {
    const onChange = vi.fn();
    render(
      <FilterBar search={{ ...search, type: ['id_scan'] }} batches={batches} onChange={onChange} />,
    );
    fireEvent.change(screen.getByRole('combobox', { name: /type/i }), { target: { value: '' } });
    expect(onChange).toHaveBeenCalledWith({ type: undefined, page: 1 });
  });

  it('writes the batch filter by id while showing its name', () => {
    const onChange = vi.fn();
    render(<FilterBar search={search} batches={batches} onChange={onChange} />);
    const select = screen.getByRole('combobox', { name: /batch/i });
    expect(screen.getByRole('option', { name: 'Kurigram field drives 2024' })).toBeInTheDocument();

    fireEvent.change(select, { target: { value: 'batch_archive' } });
    expect(onChange).toHaveBeenCalledWith({ batch: 'batch_archive', page: 1 });
  });

  it('shows Clear only when something is filtered, and clears every axis at once', () => {
    const onChange = vi.fn();
    const { rerender } = render(
      <FilterBar search={search} batches={batches} onChange={onChange} />,
    );
    expect(screen.queryByRole('button', { name: /^clear$/i })).not.toBeInTheDocument();

    rerender(
      <FilterBar
        search={{ page: 3, q: 'intake', type: ['id_scan'], status: ['failed'], batch: 'b1' }}
        batches={batches}
        onChange={onChange}
      />,
    );
    fireEvent.click(screen.getByRole('button', { name: /^clear$/i }));
    expect(onChange).toHaveBeenCalledWith({
      q: undefined,
      status: undefined,
      review: undefined,
      type: undefined,
      batch: undefined,
      page: 1,
    });
  });
});
