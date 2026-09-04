/**
 * Turning a drop into a flat list of files. Dropping a folder is the normal case for an
 * archive digitisation run, and the directory API it goes through is the one part of the
 * upload path with a contract that punishes the obvious implementation.
 */

/**
 * `readEntries` returns at most 100 entries per call and signals the end with an empty array.
 * Calling it once - the shape everyone writes first - silently loses every file past the
 * hundredth, which looks like a working upload right up until the archive is short.
 */
async function readAll(reader: FileSystemDirectoryReader): Promise<FileSystemEntry[]> {
  const all: FileSystemEntry[] = [];
  for (;;) {
    const batch = await new Promise<FileSystemEntry[]>((resolve, reject) =>
      reader.readEntries(resolve, reject),
    );
    if (batch.length === 0) return all;
    all.push(...batch);
  }
}

const toFile = (entry: FileSystemFileEntry) =>
  new Promise<File>((resolve, reject) => entry.file(resolve, reject));

/** Report often enough that the count visibly climbs, rarely enough to not re-render per file. */
const PROGRESS_EVERY = 100;

/**
 * Walks entries breadth-first into a flat file list. Every await yields to the event loop,
 * which is what keeps a 10,000-file folder from freezing the dialog: there is no long
 * synchronous stretch to break up, so no explicit chunking is needed.
 */
export async function filesFromEntries(
  entries: FileSystemEntry[],
  onCount?: (found: number) => void,
): Promise<File[]> {
  const files: File[] = [];
  const queue = [...entries];
  while (queue.length) {
    const entry = queue.shift()!;
    if (entry.isDirectory) {
      queue.push(...(await readAll((entry as FileSystemDirectoryEntry).createReader())));
    } else if (entry.isFile) {
      files.push(await toFile(entry as FileSystemFileEntry));
      if (files.length % PROGRESS_EVERY === 0) onCount?.(files.length);
    }
  }
  onCount?.(files.length);
  return files;
}

/**
 * The drop-event entry point. `webkitGetAsEntry` must be called synchronously against the
 * live DataTransfer, before any await empties it - hence the eager map.
 */
export function filesFromDrop(
  transfer: DataTransfer,
  onCount?: (found: number) => void,
): Promise<File[]> {
  const entries = [...transfer.items]
    .map((item) => item.webkitGetAsEntry())
    .filter((entry): entry is FileSystemEntry => entry !== null);
  return entries.length ? filesFromEntries(entries, onCount) : Promise.resolve([...transfer.files]);
}
