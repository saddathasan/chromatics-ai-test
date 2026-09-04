// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { FieldList } from './FieldList';
import type { NormalizedRecord } from '../../domain/types';

/** One record carrying all six field statuses at once, which no real document does. */
const record: NormalizedRecord = {
  documentType: { status: 'not_applicable' },
  personName: { status: 'uncertain', value: 'Rahima Khatun', raw: 'Rahima Kha—n', confidence: 0.66 },
  phone: { status: 'extracted', value: '+8801712345402', confidence: 0.94 },
  location: { status: 'unreadable' },
  programName: { status: 'corrected', value: 'Safe Motherhood', raw: 'Safe Mother hood' },
  date: { status: 'missing' },
};

describe('FieldList', () => {
  it('gives every field status its own wording and never a bare dash', () => {
    render(<FieldList record={record} onCorrect={vi.fn()} />);

    expect(screen.getByText(/uncertain/i)).toBeInTheDocument();
    expect(screen.getByText(/not present on this form/i)).toBeInTheDocument();
    expect(screen.getByText(/present, but could not be read/i)).toBeInTheDocument();
    expect(screen.getByText(/not used on this form type/i)).toBeInTheDocument();
    expect(screen.getByText(/corrected by a person/i)).toBeInTheDocument();
    expect(screen.getByText(/^extracted · 0\.94$/)).toBeInTheDocument();

    // A dash would say "we looked and found nothing", which is only one of the five cases.
    expect(screen.queryByText('—')).not.toBeInTheDocument();
  });

  it('orders fields worst-first, so the reason for review is at the top', () => {
    render(<FieldList record={record} onCorrect={vi.fn()} />);
    const labels = screen.getAllByRole('term').map((el) => el.textContent);
    expect(labels).toEqual([
      'Person name',
      'Location',
      'Date',
      'Programme',
      'Phone',
      'Document type',
    ]);
  });

  it('shows the raw OCR text only where it differs from the normalized value', () => {
    render(<FieldList record={record} onCorrect={vi.fn()} />);
    expect(screen.getByText(/Rahima Kha—n/)).toBeInTheDocument();
    expect(screen.getByText(/Safe Mother hood/)).toBeInTheDocument();
    // phone reads the same either way, so repeating it would be noise
    expect(screen.getAllByText(/\+8801712345402/)).toHaveLength(1);
  });

  it('hides the settled fields when flagged-only is on', () => {
    render(<FieldList record={record} onCorrect={vi.fn()} />);
    fireEvent.click(screen.getByRole('checkbox', { name: /flagged only/i }));

    expect(screen.getByText('Person name')).toBeInTheDocument();
    expect(screen.getByText('Location')).toBeInTheDocument();
    expect(screen.getByText('Date')).toBeInTheDocument();
    expect(screen.queryByText('Phone')).not.toBeInTheDocument();
    expect(screen.queryByText('Programme')).not.toBeInTheDocument();
  });

  it('corrects one field inline and submits the new value', () => {
    const onCorrect = vi.fn();
    render(<FieldList record={record} onCorrect={onCorrect} />);

    fireEvent.click(screen.getByRole('button', { name: /correct person name/i }));
    const input = screen.getByRole('textbox', { name: /person name/i });
    // Seeded with the current value: most corrections are a character, not a retype.
    expect(input).toHaveValue('Rahima Khatun');

    fireEvent.change(input, { target: { value: 'Rahima Khatun Begum' } });
    fireEvent.submit(input);
    expect(onCorrect).toHaveBeenCalledWith('personName', 'Rahima Khatun Begum');
  });

  it('offers to enter a value for a field that has none', () => {
    render(<FieldList record={record} onCorrect={vi.fn()} />);
    expect(screen.getByRole('button', { name: /enter date/i })).toBeInTheDocument();
  });

  it('offers nothing for a field this form type does not have', () => {
    render(<FieldList record={record} onCorrect={vi.fn()} />);
    // not_applicable is not missing data, so there is nothing to enter and nothing absent.
    expect(screen.queryByRole('button', { name: /document type/i })).not.toBeInTheDocument();
    expect(screen.getAllByText('no value recorded')).toHaveLength(2);
  });

  it('renders the document type as words, not as the stored enum', () => {
    render(
      <FieldList
        record={{ ...record, documentType: { status: 'extracted', value: 'id_scan', confidence: 1 } }}
        onCorrect={vi.fn()}
      />
    );
    expect(screen.getByText('ID scan')).toBeInTheDocument();
    expect(screen.queryByText('id_scan')).not.toBeInTheDocument();
  });

  it('abandons an edit without reporting a correction', () => {
    const onCorrect = vi.fn();
    render(<FieldList record={record} onCorrect={onCorrect} />);
    fireEvent.click(screen.getByRole('button', { name: /correct person name/i }));
    fireEvent.click(screen.getByRole('button', { name: /cancel/i }));
    expect(onCorrect).not.toHaveBeenCalled();
    expect(screen.queryByRole('textbox')).not.toBeInTheDocument();
  });
});
