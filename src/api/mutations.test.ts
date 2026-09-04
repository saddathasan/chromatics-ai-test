import { QueryClient } from '@tanstack/react-query';
import { describe, expect, it, vi } from 'vitest';
import { invalidateAfterWrite } from './mutations';

describe('invalidateAfterWrite', () => {
  it('refreshes the list and the counts above it, since every write moves both', () => {
    const client = new QueryClient();
    const spy = vi.spyOn(client, 'invalidateQueries');
    invalidateAfterWrite(client);
    const keys = spy.mock.calls.map((call) => String(call[0]?.queryKey?.[0]));
    expect(keys).toEqual(['documents', 'batches']);
  });

  it('also refreshes the open document when a write named one', () => {
    const client = new QueryClient();
    const spy = vi.spyOn(client, 'invalidateQueries');
    invalidateAfterWrite(client, 'doc_8');
    expect(spy.mock.calls.at(-1)?.[0]?.queryKey).toEqual(['document', 'doc_8']);
  });
});
