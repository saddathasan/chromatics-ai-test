// @vitest-environment jsdom
import { describe, expect, it } from 'vitest';
import { MAX_BYTES, validate } from './validate';

const file = (name: string, bytes = 10, type?: string) =>
  new File([new Uint8Array(bytes)], name, { type, lastModified: 1_700_000_000_000 });

describe('validate', () => {
  it('accepts the archive formats and normalizes the type from the extension', () => {
    const { accepted, skipped } = validate([file('intake.PDF'), file('scan.tiff')]);
    expect(skipped).toEqual([]);
    expect(accepted.map((i) => i.mimeType)).toEqual(['application/pdf', 'image/tiff']);
  });

  it('names a reason for every file it refuses', () => {
    const { accepted, skipped } = validate([
      file('notes.docx'),
      file('blank.pdf', 0),
      file('huge.pdf', MAX_BYTES + 1),
    ]);
    expect(accepted).toEqual([]);
    expect(skipped).toEqual([
      { name: 'notes.docx', reason: 'unsupported' },
      { name: 'blank.pdf', reason: 'empty' },
      { name: 'huge.pdf', reason: 'too_large' },
    ]);
  });

  it('skips the second copy of a file rather than uploading it twice', () => {
    const { accepted, skipped } = validate([file('intake.pdf'), file('intake.pdf')]);
    expect(accepted).toHaveLength(1);
    expect(skipped).toEqual([{ name: 'intake.pdf', reason: 'duplicate' }]);
  });

  it('treats same-named files from different folders as different files', () => {
    const a = file('intake.pdf');
    const b = file('intake.pdf');
    Object.defineProperty(a, 'webkitRelativePath', { value: 'kurigram/intake.pdf' });
    Object.defineProperty(b, 'webkitRelativePath', { value: 'sylhet/intake.pdf' });
    expect(validate([a, b]).accepted).toHaveLength(2);
  });

  it('carries an existing selection forward so a second drop cannot re-add a file', () => {
    const first = validate([file('intake.pdf')]);
    const second = validate([file('intake.pdf')], first.accepted);
    expect(second.accepted).toEqual([]);
    expect(second.skipped).toEqual([{ name: 'intake.pdf', reason: 'duplicate' }]);
  });
});
