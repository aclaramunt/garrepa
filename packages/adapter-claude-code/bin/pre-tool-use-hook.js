#!/usr/bin/env node
'use strict';

require('../dist/hook-entry').main().catch((/** @type {unknown} */ err) => {
  try {
    process.stderr.write(String(err) + '\n');
  } catch {
    // ignore
  }
  process.exit(0);
});
