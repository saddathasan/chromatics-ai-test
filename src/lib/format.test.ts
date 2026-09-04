import { describe, expect, it } from 'vitest';
import { ago, confidence, count, duration } from './format';

describe('duration', () => {
  it('reads as something a person can act on', () => {
    expect(duration(45)).toBe('45 s');
    expect(duration(399)).toBe('6 min 39 s');
    expect(duration(120)).toBe('2 min');
    expect(duration(7_800)).toBe('2 h 10 min');
    expect(duration(7_200)).toBe('2 h');
  });

  it('never renders a negative age from a clock that ran backwards', () => {
    expect(duration(-5)).toBe('0 s');
  });
});

describe('ago', () => {
  const now = Date.parse('2026-09-04T12:00:00.000Z');

  it('counts recent activity in elapsed time', () => {
    expect(ago('2026-09-04T11:59:58.000Z', now)).toBe('2 s ago');
    expect(ago('2026-09-04T09:12:00.000Z', now)).toBe('2 h 48 min ago');
  });

  it('switches to a date once elapsed time stops being readable', () => {
    // "75 h 55 min ago" is arithmetic, not information: past a day, say when.
    // Month abbreviation is ICU's call ("Sep" or "Sept"), so assert the shape, not the spelling.
    expect(ago('2026-09-01T05:52:11.000Z', now)).toMatch(/^1 Sept?, 05:52$/);
  });

  it('does not claim the future is in the past', () => {
    expect(ago('2026-09-04T12:00:00.000Z', now)).toBe('just now');
  });
});

describe('count and confidence', () => {
  it('separates thousands and pads confidence to a fixed width', () => {
    expect(count(100_000)).toBe('100,000');
    expect(confidence(0.9)).toBe('0.90');
    expect(confidence(0.664)).toBe('0.66');
  });
});
