import { describe, expect, it } from 'vitest';
import { parseDocumentSearch } from './search';

describe('parseDocumentSearch', () => {
  it('defaults to page one with no filters', () => {
    expect(parseDocumentSearch({})).toEqual({
      q: undefined,
      status: undefined,
      review: undefined,
      type: undefined,
      batch: undefined,
      sort: undefined,
      page: 1,
      doc: undefined,
    });
  });

  it('accepts a single filter value or a list', () => {
    expect(parseDocumentSearch({ status: 'failed' }).status).toEqual(['failed']);
    expect(parseDocumentSearch({ status: ['failed', 'queued'] }).status).toEqual([
      'failed',
      'queued',
    ]);
  });

  it('drops values outside the domain instead of erroring', () => {
    expect(parseDocumentSearch({ status: ['failed', 'exploded'] }).status).toEqual(['failed']);
    expect(parseDocumentSearch({ status: 'exploded' }).status).toBeUndefined();
    expect(parseDocumentSearch({ sort: 'sideways' }).sort).toBeUndefined();
  });

  it('clamps a nonsense page to the first one', () => {
    expect(parseDocumentSearch({ page: 0 }).page).toBe(1);
    expect(parseDocumentSearch({ page: -3 }).page).toBe(1);
    expect(parseDocumentSearch({ page: 'abc' }).page).toBe(1);
    expect(parseDocumentSearch({ page: 2.5 }).page).toBe(1);
    expect(parseDocumentSearch({ page: '4' }).page).toBe(4);
  });

  it('trims text and ignores blank strings', () => {
    expect(parseDocumentSearch({ q: '  amina  ' }).q).toBe('amina');
    expect(parseDocumentSearch({ q: '   ' }).q).toBeUndefined();
  });

  it('carries the open document id', () => {
    expect(parseDocumentSearch({ doc: 'doc_42' }).doc).toBe('doc_42');
  });
});
