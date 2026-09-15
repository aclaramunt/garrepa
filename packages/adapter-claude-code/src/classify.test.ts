import { describe, it, expect } from 'vitest';
import { isDocumentationPath } from './classify';

describe('isDocumentationPath()', () => {
  it('accepts documentation extensions', () => {
    expect(isDocumentationPath('/proj/README.md')).toBe(true);
    expect(isDocumentationPath('/proj/guide.mdx')).toBe(true);
    expect(isDocumentationPath('/proj/notes.markdown')).toBe(true);
    expect(isDocumentationPath('/proj/spec.rst')).toBe(true);
    expect(isDocumentationPath('/proj/notes.txt')).toBe(true);
    expect(isDocumentationPath('/proj/book.adoc')).toBe(true);
    expect(isDocumentationPath('/proj/notes.org')).toBe(true);
  });

  it('accepts HTML only under docs/ or documentation/', () => {
    expect(isDocumentationPath('/proj/docs/api.html')).toBe(true);
    expect(isDocumentationPath('/proj/documentation/index.htm')).toBe(true);
    expect(isDocumentationPath('/proj/src/index.html')).toBe(false);
    expect(isDocumentationPath('/proj/public/app.html')).toBe(false);
  });

  it('accepts well-known prose basenames without extension', () => {
    expect(isDocumentationPath('/proj/README')).toBe(true);
    expect(isDocumentationPath('/proj/CHANGELOG')).toBe(true);
    expect(isDocumentationPath('/proj/LICENSE')).toBe(true);
  });

  it('rejects source, config, lockfiles, and generated artefacts', () => {
    expect(isDocumentationPath('/proj/src/index.ts')).toBe(false);
    expect(isDocumentationPath('/proj/src/app.py')).toBe(false);
    expect(isDocumentationPath('/proj/package.json')).toBe(false);
    expect(isDocumentationPath('/proj/package-lock.json')).toBe(false);
    expect(isDocumentationPath('/proj/pnpm-lock.yaml')).toBe(false);
    expect(isDocumentationPath('/proj/dist/bundle.js')).toBe(false);
    expect(isDocumentationPath('/proj/app.css')).toBe(false);
  });
});
