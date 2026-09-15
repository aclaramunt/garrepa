import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { afterEach, describe, it, expect } from 'vitest';
import { applyOffsetLimit, readTextWindow } from './read-window';

describe('applyOffsetLimit()', () => {
  const text = ['one', 'two', 'three', 'four', 'five'].join('\n');

  it('returns the full text when offset and limit are omitted', () => {
    expect(applyOffsetLimit(text)).toBe(text);
  });

  it('treats offset as a 1-based line number', () => {
    expect(applyOffsetLimit(text, 2, 2)).toBe('two\nthree');
  });

  it('reads through the end when only offset is set', () => {
    expect(applyOffsetLimit(text, 4)).toBe('four\nfive');
  });
});

describe('readTextWindow()', () => {
  const tmpDirs: string[] = [];

  function tmpFile(name: string, contents: Buffer | string): string {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'garrepa-read-'));
    tmpDirs.push(dir);
    const filePath = path.join(dir, name);
    fs.writeFileSync(filePath, contents);
    return filePath;
  }

  afterEach(() => {
    for (const dir of tmpDirs.splice(0)) {
      fs.rmSync(dir, { recursive: true, force: true });
    }
  });

  it('caps characters and respects a line window', () => {
    const filePath = tmpFile('doc.md', ['a', 'b', 'c', 'd', 'e'].join('\n'));
    expect(readTextWindow(filePath, { offset: 2, limit: 2, maxChars: 100 })).toBe('b\nc');
  });

  it('rejects binary files', () => {
    const filePath = tmpFile('blob.bin', Buffer.from([0, 1, 2, 3, 0, 9]));
    expect(() => readTextWindow(filePath, { maxChars: 100 })).toThrow(/binary/);
  });
});
