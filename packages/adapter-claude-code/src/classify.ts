import * as path from 'path';

const DOC_EXTENSIONS = new Set([
  '.md',
  '.mdx',
  '.markdown',
  '.rst',
  '.txt',
  '.adoc',
  '.org',
]);

const DOC_BASENAMES = new Set([
  'readme',
  'changelog',
  'license',
  'copying',
  'authors',
  'notice',
]);

const DOC_DIR_SEGMENT = /(?:^|\/)(?:docs|documentation)(?:\/|$)/i;

/**
 * True only for documentation we are willing to compress.
 * Everything else (source, config, lockfiles, app HTML, unknown) is false.
 */
export function isDocumentationPath(filePath: string): boolean {
  const normalized = filePath.replace(/\\/g, '/');
  const base = path.basename(normalized);
  const ext = path.extname(base).toLowerCase();

  if (DOC_EXTENSIONS.has(ext)) return true;

  if (ext === '.html' || ext === '.htm') {
    return DOC_DIR_SEGMENT.test(normalized);
  }

  if (ext === '' && DOC_BASENAMES.has(base.toLowerCase())) return true;

  return false;
}
