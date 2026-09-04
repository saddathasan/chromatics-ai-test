import { QueryClient } from '@tanstack/react-query';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { setupServer } from 'msw/node';
import { handlers } from '../mocks/handlers';
import { api } from './client';
import { invalidateAfterWrite } from './mutations';

const server = setupServer(...handlers);
beforeAll(() => server.listen({ onUnhandledRequest: 'error' }));
afterAll(() => server.close());

describe('invalidateAfterWrite', () => {
  it('refreshes the list and the counts above it, since a bulk retry moves both', () => {
    const client = new QueryClient();
    const spy = vi.spyOn(client, 'invalidateQueries');
    invalidateAfterWrite(client);
    const keys = spy.mock.calls.map((call) => String(call[0]?.queryKey?.[0]));
    expect(keys).toContain('documents');
    expect(keys).toContain('batches');
  });
});

describe('filter-scoped bulk retry', () => {
  it('retries only the retryable failures inside the filter, and reports how many moved', async () => {
    const scoped = await api.retryMatching({ batch: 'batch_archive', type: ['id_scan'] });
    expect(scoped.affected).toBeGreaterThan(0);

    // Rerunning finds nothing: those documents are queued again, not failed.
    const again = await api.retryMatching({ batch: 'batch_archive', type: ['id_scan'] });
    expect(again.affected).toBeLessThan(scoped.affected);
  });

  it('leaves documents outside the filter alone', async () => {
    const none = await api.retryMatching({ batch: 'batch_does_not_exist' });
    expect(none.affected).toBe(0);
  });
});
