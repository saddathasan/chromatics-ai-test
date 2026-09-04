// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest';
import { act, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { vi } from 'vitest';
import { InfoTip } from './InfoTip';

const trigger = () => screen.getByRole('button', { name: /about throughput/i });
const tip = () => screen.queryByRole('tooltip');

describe('InfoTip', () => {
  beforeEach(() => vi.useFakeTimers({ shouldAdvanceTime: true }));
  afterEach(() => vi.useRealTimers());

  it('opens on hover, but not instantly - a pointer sweeping the screen must not strobe tips', () => {
    render(<InfoTip term="throughput" />);
    fireEvent.mouseEnter(trigger());
    expect(tip()).not.toBeInTheDocument();

    act(() => void vi.advanceTimersByTime(150));
    expect(tip()).toHaveTextContent(/documents finishing/i);
  });

  it('opens at once on keyboard focus, where the delay would only be a stutter', () => {
    render(<InfoTip term="throughput" />);
    fireEvent.focus(trigger());
    expect(tip()).toBeInTheDocument();
  });

  it('survives the pointer travelling from the trigger into the tip', () => {
    render(<InfoTip term="throughput" />);
    fireEvent.focus(trigger());

    // Leaving the trigger starts a close, entering the panel must cancel it.
    fireEvent.mouseLeave(trigger());
    fireEvent.mouseEnter(screen.getByRole('tooltip'));
    act(() => void vi.advanceTimersByTime(400));
    expect(tip()).toBeInTheDocument();
  });

  it('closes when the pointer leaves for good', () => {
    render(<InfoTip term="throughput" />);
    fireEvent.focus(trigger());
    fireEvent.mouseLeave(trigger());
    act(() => void vi.advanceTimersByTime(400));
    expect(tip()).not.toBeInTheDocument();
  });

  it('closes on Escape, as anything that appears over the page must', () => {
    render(<InfoTip term="throughput" />);
    fireEvent.focus(trigger());
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(tip()).not.toBeInTheDocument();
  });

  it('describes its trigger only while it is open', () => {
    render(<InfoTip term="throughput" />);
    expect(trigger()).not.toHaveAttribute('aria-describedby');
    fireEvent.focus(trigger());
    expect(trigger()).toHaveAttribute('aria-describedby', screen.getByRole('tooltip').id);
  });

  it('points at the term inside the guide rather than restating the whole definition', () => {
    render(<InfoTip term="throughput" />);
    fireEvent.focus(trigger());
    expect(screen.getByRole('link', { name: /read more/i })).toHaveAttribute(
      'href',
      '/guide#term-throughput',
    );
  });
});
