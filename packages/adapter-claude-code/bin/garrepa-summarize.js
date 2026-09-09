#!/usr/bin/env node
'use strict';

require('../dist/summarize-entry').main().catch((/** @type {unknown} */ err) => {
  process.stderr.write(String(err) + '\n');
  process.exit(1);
});
