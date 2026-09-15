import * as fs from 'fs';

export interface ReadWindowOpts {
  offset?: number;
  limit?: number;
  maxChars: number;
}

/** Hard cap on bytes scanned from disk to extract a Read window. */
export const MAX_SCAN_BYTES = 2_000_000;

export function applyOffsetLimit(text: string, offset?: number, limit?: number): string {
  if (offset == null && limit == null) return text;
  const lines = text.split('\n');
  const start = offset != null && offset > 0 ? offset - 1 : 0;
  const end = limit != null ? start + limit : lines.length;
  return lines.slice(start, end).join('\n');
}

function looksBinary(buf: Buffer): boolean {
  const sample = buf.subarray(0, Math.min(buf.length, 8192));
  return sample.includes(0);
}

/**
 * Reads a bounded window of a text file. Throws on unreadable or binary files
 * so the hook can fail open.
 */
export function readTextWindow(filePath: string, opts: ReadWindowOpts): string {
  const fd = fs.openSync(filePath, 'r');
  try {
    const toRead = Math.min(MAX_SCAN_BYTES, Math.max(opts.maxChars * 4, opts.maxChars));
    const buf = Buffer.alloc(toRead);
    const bytesRead = fs.readSync(fd, buf, 0, toRead, 0);
    const slice = buf.subarray(0, bytesRead);
    if (looksBinary(slice)) {
      throw new Error('binary file');
    }
    const text = slice.toString('utf8');
    const window = applyOffsetLimit(text, opts.offset, opts.limit);
    return window.length > opts.maxChars ? window.slice(0, opts.maxChars) : window;
  } finally {
    fs.closeSync(fd);
  }
}

export function statSize(filePath: string): number {
  return fs.statSync(filePath).size;
}
