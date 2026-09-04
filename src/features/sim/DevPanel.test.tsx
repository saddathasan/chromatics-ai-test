// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { DevPanel } from './DevPanel';

const sim = { speed: 1, failureRate: 0.05, outage: false };

describe('DevPanel', () => {
  it('fast-forwards the archive without touching anything else', () => {
    const onChange = vi.fn();
    render(<DevPanel sim={sim} onChange={onChange} onReset={vi.fn()} />);
    fireEvent.click(screen.getByRole('button', { name: '×100' }));
    expect(onChange).toHaveBeenCalledWith({ speed: 100 });
  });

  it('sets the failure rate as a percentage a person can read', () => {
    const onChange = vi.fn();
    render(<DevPanel sim={sim} onChange={onChange} onReset={vi.fn()} />);
    fireEvent.change(screen.getByRole('slider', { name: /failure rate/i }), {
      target: { value: '25' },
    });
    expect(onChange).toHaveBeenCalledWith({ failureRate: 0.25 });
  });

  it('injects and clears an outage', () => {
    const onChange = vi.fn();
    render(<DevPanel sim={{ ...sim, outage: true }} onChange={onChange} onReset={vi.fn()} />);
    fireEvent.click(screen.getByRole('checkbox', { name: /service outage/i }));
    expect(onChange).toHaveBeenCalledWith({ outage: false });
  });

  it('shows the current speed as pressed, so the panel reports state rather than only setting it', () => {
    render(<DevPanel sim={{ ...sim, speed: 10 }} onChange={vi.fn()} onReset={vi.fn()} />);
    expect(screen.getByRole('button', { name: '×10' })).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByRole('button', { name: '×1' })).toHaveAttribute('aria-pressed', 'false');
  });
});
