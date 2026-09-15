#!/usr/bin/env node
'use strict';

/**
 * Project-local launcher. Resolves @garrepa/adapter-claude-code from the
 * project's node_modules — never from an npx cache path.
 */
const path = require('path');

const root = process.env.CLAUDE_PROJECT_DIR || process.cwd();

function failOpen(err) {
  try {
    process.stderr.write(String(err) + '\n');
  } catch {
    // ignore
  }
  process.exit(0);
}

try {
  const pkgJson = require.resolve('@garrepa/adapter-claude-code/package.json', { paths: [root] });
  const entry = path.join(path.dirname(pkgJson), 'dist', 'hook-entry.js');
  require(entry)
    .main()
    .catch(failOpen);
} catch (err) {
  failOpen(err);
}
