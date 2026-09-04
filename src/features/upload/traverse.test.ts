// @vitest-environment jsdom
import { describe, expect, it, vi } from 'vitest';
import { filesFromEntries } from './traverse';

/**
 * A directory reader that hands back at most 100 entries per call and ends with an empty
 * array - the actual contract of `FileSystemDirectoryReader`, and the one every naive
 * implementation gets wrong by calling `readEntries` once and trusting the result.
 */
function fakeDirectory(name: string, childCount: number): FileSystemEntry {
  const children = Array.from({ length: childCount }, (_, i) => fakeFile(`${name}-${i}.pdf`));
  let cursor = 0;
  const reader = {
    readEntries(onSuccess: (entries: FileSystemEntry[]) => void) {
      const batch = children.slice(cursor, cursor + 100);
      cursor += batch.length;
      setTimeout(() => onSuccess(batch), 0);
    },
  };
  return {
    isFile: false,
    isDirectory: true,
    name,
    createReader: () => reader,
  } as unknown as FileSystemEntry;
}

function fakeFile(name: string): FileSystemEntry {
  return {
    isFile: true,
    isDirectory: false,
    name,
    file: (onSuccess: (file: File) => void) =>
      setTimeout(() => onSuccess(new File(['x'], name)), 0),
  } as unknown as FileSystemEntry;
}

describe('filesFromEntries', () => {
  it('keeps calling readEntries until it returns nothing', async () => {
    const files = await filesFromEntries([fakeDirectory('scans', 250)]);
    expect(files).toHaveLength(250);
    expect(files[249].name).toBe('scans-249.pdf');
  });

  it('descends into nested directories', async () => {
    const root = {
      isFile: false,
      isDirectory: true,
      name: 'root',
      createReader: () => {
        let done = false;
        return {
          readEntries(onSuccess: (entries: FileSystemEntry[]) => void) {
            const batch = done ? [] : [fakeDirectory('inner', 3), fakeFile('loose.pdf')];
            done = true;
            setTimeout(() => onSuccess(batch), 0);
          },
        };
      },
    } as unknown as FileSystemEntry;

    const files = await filesFromEntries([root]);
    expect(files.map((f) => f.name).sort()).toEqual([
      'inner-0.pdf',
      'inner-1.pdf',
      'inner-2.pdf',
      'loose.pdf',
    ]);
  });

  it('reports progress while enumerating, so a large folder is not a frozen dialog', async () => {
    const onCount = vi.fn();
    await filesFromEntries([fakeDirectory('scans', 250)], onCount);
    expect(onCount).toHaveBeenCalled();
    expect(onCount).toHaveBeenLastCalledWith(250);
  });
});
