/**
 * Exercises the mock backend through its HTTP contract rather than its internals, so these
 * tests keep passing if the store is rewritten and start failing if the API shape drifts.
 */
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { ApiError, api, toQuery } from '../api/client';
import { TOTAL_DOCUMENTS } from './generate';
import { server } from './node';
import { advance, batchStats, initStore, list, reset, setSim } from './store';

beforeAll(() => server.listen({ onUnhandledRequest: 'error' }));
afterAll(() => server.close());
afterEach(() => server.resetHandlers());

// A 5,000-document archive keeps the suite fast; scale behaviour is asserted separately.
beforeEach(async () => {
  await initStore(5_000);
  reset();
});

describe('toQuery', () => {
  it('repeats a key per value and drops empties', () => {
    expect(toQuery({ status: ['failed', 'queued'], q: '', page: 2 })).toBe(
      '?status=failed&status=queued&page=2'
    );
  });
});

describe('GET /documents', () => {
  it('returns a page, never the whole archive', async () => {
    const page = await api.listDocuments({ page: 1, pageSize: 50 });
    expect(page.items).toHaveLength(50);
    expect(page.total).toBe(5_000);
    expect(page.pageSize).toBe(50);
  });

  it('returns the tail page and an empty page past the end', async () => {
    const last = await api.listDocuments({ page: 100, pageSize: 50 });
    expect(last.items).toHaveLength(50);
    const past = await api.listDocuments({ page: 101, pageSize: 50 });
    expect(past.items).toHaveLength(0);
    expect(past.total).toBe(5_000);
  });

  it('clamps a nonsense page rather than erroring', async () => {
    const page = await api.listDocuments({ page: 0, pageSize: 50 });
    expect(page.page).toBe(1);
    expect(page.items).toHaveLength(50);
  });

  it('is deterministic for a fixed seed', async () => {
    const first = await api.listDocuments({ page: 3, pageSize: 20 });
    await initStore(5_000);
    reset();
    const second = await api.listDocuments({ page: 3, pageSize: 20 });
    expect(second.items.map((d) => d.id)).toEqual(first.items.map((d) => d.id));
  });

  it('filters by status server-side', async () => {
    const failed = await api.listDocuments({ status: ['failed'], pageSize: 20 });
    expect(failed.items.every((d) => d.status === 'failed')).toBe(true);
    expect(failed.total).toBeGreaterThan(0);
    expect(failed.total).toBeLessThan(5_000);
  });

  it('filters by review status', async () => {
    const review = await api.listDocuments({ review: ['needs_review'], pageSize: 20 });
    expect(review.items.every((d) => d.reviewStatus === 'needs_review')).toBe(true);
    expect(review.total).toBeGreaterThan(0);
  });

  it('combines a filter with a search term', async () => {
    const page = await api.listDocuments({ status: ['completed'], q: 'id-scan', pageSize: 20 });
    expect(page.items.every((d) => d.status === 'completed')).toBe(true);
    expect(page.items.every((d) => d.fileName.includes('id-scan'))).toBe(true);
  });

  it('returns an empty page for a search that matches nothing', async () => {
    const page = await api.listDocuments({ q: 'no-such-file-anywhere' });
    expect(page.items).toHaveLength(0);
    expect(page.total).toBe(0);
  });

  it('sorts by file name in both directions', async () => {
    const asc = await api.listDocuments({ sort: 'fileName', pageSize: 10 });
    const desc = await api.listDocuments({ sort: '-fileName', pageSize: 10 });
    const names = asc.items.map((d) => d.fileName);
    expect([...names].sort()).toEqual(names);
    expect(desc.items[0].fileName > asc.items[0].fileName).toBe(true);
  });

  it('the status counts across pages add up to the archive', async () => {
    const totals = await Promise.all(
      (['queued', 'processing', 'completed', 'failed'] as const).map(async (status) => {
        const page = await api.listDocuments({ status: [status], pageSize: 1 });
        return page.total;
      })
    );
    expect(totals.reduce((a, b) => a + b, 0)).toBe(5_000);
  });

  it('attaches the extraction to listed rows so the table can show type and confidence', async () => {
    const completed = await api.listDocuments({ status: ['completed'], pageSize: 5 });
    expect(completed.items.every((d) => d.extraction?.documentType.value)).toBe(true);

    // Nothing has been read off an unprocessed document, so there is nothing to attach.
    const queued = await api.listDocuments({ status: ['queued'], pageSize: 5 });
    expect(queued.items.every((d) => d.extraction === undefined)).toBe(true);
  });
});

describe('GET /documents/:id', () => {
  it('attaches the extraction only for completed documents', async () => {
    const completed = await api.listDocuments({ status: ['completed'], pageSize: 1 });
    const doc = await api.getDocument(completed.items[0].id);
    expect(doc.extraction?.personName).toBeDefined();

    const queued = await api.listDocuments({ status: ['queued'], pageSize: 1 });
    const pending = await api.getDocument(queued.items[0].id);
    expect(pending.extraction).toBeUndefined();
  });

  it('produces the same extraction on every read', async () => {
    const page = await api.listDocuments({ status: ['completed'], pageSize: 1 });
    const a = await api.getDocument(page.items[0].id);
    const b = await api.getDocument(page.items[0].id);
    expect(b.extraction).toEqual(a.extraction);
  });

  it('404s for an unknown id', async () => {
    await expect(api.getDocument('doc_does_not_exist')).rejects.toMatchObject({ status: 404 });
  });
});

describe('review actions', () => {
  const firstNeedingReview = async () => {
    const page = await api.listDocuments({ review: ['needs_review'], pageSize: 1 });
    return page.items[0].id;
  };

  it('confirms a document that needs review', async () => {
    const id = await firstNeedingReview();
    const confirmed = await api.confirm(id);
    expect(confirmed.reviewStatus).toBe('confirmed');
    expect((await api.getDocument(id)).reviewStatus).toBe('confirmed');
  });

  it('409s when confirming a document that needs no review', async () => {
    const clean = await api.listDocuments({ review: ['not_required'], status: ['completed'], pageSize: 1 });
    await expect(api.confirm(clean.items[0].id)).rejects.toMatchObject({ status: 409 });
  });

  it('corrects one field, keeps the raw value and leaves the rest alone', async () => {
    const id = await firstNeedingReview();
    const before = await api.getDocument(id);
    const corrected = await api.correct(id, 'personName', 'Corrected Name');
    expect(corrected.extraction?.personName).toMatchObject({
      status: 'corrected',
      value: 'Corrected Name',
    });
    expect(corrected.extraction?.location).toEqual(before.extraction?.location);
    expect((await api.getDocument(id)).extraction?.personName.value).toBe('Corrected Name');
  });

  it('rejects a document and then refuses to retry it', async () => {
    const failed = await api.listDocuments({ status: ['failed'], pageSize: 50 });
    const retryable = failed.items.find((d) => d.error?.retryable);
    expect(retryable).toBeDefined();
    await api.reject(retryable!.id);
    await expect(api.retry(retryable!.id)).rejects.toMatchObject({ status: 409 });
  });
});

describe('retry', () => {
  it('requeues a retryable failure', async () => {
    const failed = await api.listDocuments({ status: ['failed'], pageSize: 50 });
    const retryable = failed.items.find((d) => d.error?.retryable)!;
    const after = await api.retry(retryable.id);
    expect(after.status).toBe('queued');
    expect(after.error).toBeUndefined();
    expect(after.attempts).toBe(1);
  });

  it('refuses a non-retryable failure with a 409', async () => {
    const failed = await api.listDocuments({ status: ['failed'], pageSize: 200 });
    const dead = failed.items.find((d) => d.error && !d.error.retryable);
    expect(dead).toBeDefined();
    await expect(api.retry(dead!.id)).rejects.toBeInstanceOf(ApiError);
    await expect(api.retry(dead!.id)).rejects.toMatchObject({ status: 409 });
  });

  it('a retried document processes again as time passes', async () => {
    const failed = await api.listDocuments({ status: ['failed'], pageSize: 50 });
    const retryable = failed.items.find((d) => d.error?.retryable)!;
    await api.retry(retryable.id);
    advance(600);
    const after = await api.getDocument(retryable.id);
    expect(['completed', 'failed']).toContain(after.status);
  });
});

describe('POST /documents/retry (filter-scoped bulk)', () => {
  it('retries every retryable failure and reports the count', async () => {
    const before = await api.listDocuments({ status: ['failed'], pageSize: 1 });
    const { affected } = await api.retryMatching({ status: ['failed'] });
    expect(affected).toBeGreaterThan(0);
    expect(affected).toBeLessThanOrEqual(before.total);
    const after = await api.listDocuments({ status: ['failed'], pageSize: 1 });
    expect(after.total).toBe(before.total - affected);
  });

  it('skips documents a human rejected', async () => {
    const failed = await api.listDocuments({ status: ['failed'], pageSize: 50 });
    const retryable = failed.items.find((d) => d.error?.retryable)!;
    await api.reject(retryable.id);
    await api.retryMatching({ status: ['failed'] });
    expect((await api.getDocument(retryable.id)).status).toBe('failed');
  });

  it('leaves non-retryable failures failed', async () => {
    await api.retryMatching({ status: ['failed'] });
    const remaining = await api.listDocuments({ status: ['failed'], pageSize: 200 });
    expect(remaining.items.every((d) => d.error?.retryable === false)).toBe(true);
  });
});

describe('batches', () => {
  it('counts every document exactly once and sums to the total', async () => {
    const batch = await api.getBatch('batch_archive');
    const { queued, processing, completed, failed, total } = batch.counts;
    expect(queued + processing + completed + failed).toBe(total);
    expect(total).toBe(5_000);
  });

  it('reports an ETA while work is outstanding', async () => {
    const batch = await api.getBatch('batch_archive');
    expect(batch.counts.queued + batch.counts.processing).toBeGreaterThan(0);
    expect(batch.throughputPerSec).toBeGreaterThanOrEqual(0);
  });

  it('creates a batch and adds documents to it idempotently', async () => {
    const batch = await api.createBatch('September field visit');
    const files = [
      { clientKey: 'a', name: 'intake-1.pdf', size: 1000, mimeType: 'application/pdf' },
      { clientKey: 'b', name: 'intake-2.pdf', size: 2000, mimeType: 'application/pdf' },
    ];
    expect((await api.addDocuments(batch.id, files)).added).toBe(2);
    // The same upload replayed must not duplicate the documents.
    expect((await api.addDocuments(batch.id, files)).added).toBe(0);
    expect((await api.getBatch(batch.id)).counts.total).toBe(2);
  });

  it('mints its own document ids rather than echoing the client key back', async () => {
    const batch = await api.createBatch('Kurigram drive');
    // A client key is a path, a size and a file modification time - an upload-side identity
    // that has no business appearing in the identifier column of an archive.
    await api.addDocuments(batch.id, [
      { clientKey: 'kurigram/intake.pdf:112:1788525508618', name: 'intake.pdf', size: 112, mimeType: 'application/pdf' },
    ]);
    const page = await api.listDocuments({ batch: batch.id });
    expect(page.items[0].id).not.toContain('1788525508618');
    expect(page.items[0].fileName).toBe('intake.pdf');
  });
});

describe('simulation controls', () => {
  it('serves 503 on reads while an outage is injected', async () => {
    setSim({ outage: true });
    await expect(api.listDocuments({})).rejects.toMatchObject({ status: 503 });
    await expect(api.getBatch('batch_archive')).rejects.toMatchObject({ status: 503 });
    setSim({ outage: false });
    await expect(api.listDocuments({})).resolves.toBeDefined();
  });

  it('drains the backlog as virtual time advances', async () => {
    const before = await api.getBatch('batch_archive');
    advance(4_000);
    const after = await api.getBatch('batch_archive');
    expect(after.counts.queued).toBeLessThan(before.counts.queued);
    expect(after.counts.completed + after.counts.failed).toBeGreaterThan(
      before.counts.completed + before.counts.failed
    );
  });
});

describe('scale', () => {
  it('builds the full archive and answers a filtered page without blocking the UI', async () => {
    const builtAt = performance.now();
    await initStore(TOTAL_DOCUMENTS);
    const buildMs = performance.now() - builtAt;

    const queriedAt = performance.now();
    const page = list({ status: ['failed'], q: 'enrollment', page: 2, pageSize: 50 });
    const queryMs = performance.now() - queriedAt;

    const statsAt = performance.now();
    const stats = batchStats('batch_archive')!;
    const statsMs = performance.now() - statsAt;

    expect(page.total).toBeGreaterThan(0);
    expect(page.items).toHaveLength(50);
    expect(stats.counts.total).toBe(TOTAL_DOCUMENTS);
    // Handlers run on the page's main thread, so a request must stay well inside a frame budget.
    expect(buildMs).toBeLessThan(500);
    expect(queryMs).toBeLessThan(30);
    expect(statsMs).toBeLessThan(30);
  });

  it('every document lands in exactly one lane', async () => {
    await initStore(TOTAL_DOCUMENTS);
    const stats = batchStats('batch_archive')!;
    const { queued, processing, completed, failed, needsReview, total } = stats.counts;
    expect(queued + processing + completed + failed).toBe(total);
    expect(needsReview).toBeGreaterThan(0);
    expect(needsReview).toBeLessThan(completed);
  });
});
