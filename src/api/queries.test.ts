import { describe, expect, it } from 'vitest';
import { pollInterval } from './queries';
import type { Batch } from '../domain/types';

const batch = (queued: number, processing: number): Batch => ({
  id: 'batch_archive',
  name: 'Archive',
  createdAt: '2026-09-04T00:00:00.000Z',
  counts: {
    queued,
    processing,
    completed: 10,
    failed: 0,
    needsReview: 0,
    confirmed: 0,
    rejected: 0,
    total: 10 + queued + processing,
  },
  throughputPerSec: 1,
  etaSeconds: null,
});

describe('pollInterval', () => {
  it('polls while anything is queued or processing', () => {
    expect(pollInterval([batch(5, 0)], 3000)).toBe(3000);
    expect(pollInterval([batch(0, 5)], 3000)).toBe(3000);
  });

  it('stops once nothing is in flight', () => {
    expect(pollInterval([batch(0, 0)], 3000)).toBe(false);
  });

  it('polls when any one batch is still draining', () => {
    expect(pollInterval([batch(0, 0), batch(1, 0)], 3000)).toBe(3000);
  });

  it('keeps polling while the first load is still in flight', () => {
    // Undefined means "we do not know yet" - stopping here would strand the dashboard.
    expect(pollInterval(undefined, 3000)).toBe(3000);
  });
});
