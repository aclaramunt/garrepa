#!/usr/bin/env node
'use strict';
const path = require('path');
const { installHook } = require(path.resolve(__dirname, '../packages/adapter-claude-code/dist/install.js'));

const projectRoot = path.resolve(__dirname, '..');
installHook(projectRoot);
console.log('garrepa hook installed into', path.join(projectRoot, '.claude/settings.json'));
