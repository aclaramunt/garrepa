import * as fs from 'fs';
import * as path from 'path';
import { DEFAULT_GARREPA_CONFIG } from './config';
import { installSkill } from './skill';
import {
  BASH_GIT_HOOK_IF,
  BASH_POST_TOOL_MATCHER,
  CLAUDE_HOOK_LAUNCHER_ARG,
  HOOK_TIMEOUT_SECONDS,
  LAUNCHER_RELATIVE_PATH,
  MCP_POST_TOOL_MATCHER,
} from './constants';

interface HookEntry {
  type: string;
  command: string;
  args?: string[];
  timeout?: number;
  if?: string;
}

interface HookGroup {
  matcher: string;
  hooks: HookEntry[];
}

interface ClaudeSettings {
  hooks?: {
    PreToolUse?: HookGroup[];
    PostToolUse?: HookGroup[];
    [key: string]: unknown;
  };
  [key: string]: unknown;
}

const LAUNCHER_TEMPLATE_PATH = path.resolve(__dirname, '..', 'hooks', 'garrepa-hook.js');

function isGarrepaHook(hook: HookEntry): boolean {
  const blob = `${hook.command} ${(hook.args ?? []).join(' ')}`;
  return blob.includes('garrepa-hook.js') || blob.includes('pre-tool-use-hook.js');
}

function stripGarrepaHooks(groups: HookGroup[], matcher: string): HookGroup[] {
  const next: HookGroup[] = [];
  for (const group of groups) {
    if (group.matcher !== matcher) {
      next.push(group);
      continue;
    }
    const hooks = group.hooks.filter((h) => !isGarrepaHook(h));
    if (hooks.length > 0) {
      next.push({ ...group, hooks });
    }
  }
  return next;
}

function writeLauncher(projectRoot: string): void {
  const dest = path.join(projectRoot, LAUNCHER_RELATIVE_PATH);
  fs.mkdirSync(path.dirname(dest), { recursive: true });

  // Embed the install-time absolute path so the hook works even when the
  // adapter is installed globally or via npx (not in the project's node_modules).
  // __dirname is adapter-claude-code/dist/ at runtime.
  const installTimeEntry = path.resolve(__dirname, 'hook-entry.js');

  const source = `#!/usr/bin/env node
'use strict';
const path = require('path');
const root = process.env.CLAUDE_PROJECT_DIR || process.cwd();
function failOpen(err) {
  try { process.stderr.write(String(err) + '\\n'); } catch { /* ignore */ }
  process.exit(0);
}
function resolveEntry() {
  try {
    const pkgJson = require.resolve('@garrepa/adapter-claude-code/package.json', { paths: [root] });
    return path.join(path.dirname(pkgJson), 'dist', 'hook-entry.js');
  } catch {
    // Fall back to install-time location (global or npx install).
    return ${JSON.stringify(installTimeEntry)};
  }
}
try {
  require(resolveEntry()).main().catch(failOpen);
} catch (err) {
  failOpen(err);
}
`;
  fs.writeFileSync(dest, source, 'utf8');
}

/**
 * Registers the garrepa PreToolUse hook in `<projectRoot>/.claude/settings.json`,
 * installs the `garrepa-write` project skill, and creates a default
 * `garrepa.config.json` if one does not exist.
 *
 * Safe to call multiple times. Invalid existing settings JSON aborts without write.
 */
export function installHook(projectRoot: string): void {
  const claudeDir = path.join(projectRoot, '.claude');
  const settingsPath = path.join(claudeDir, 'settings.json');
  const configPath = path.join(projectRoot, 'garrepa.config.json');

  if (!fs.existsSync(claudeDir)) {
    fs.mkdirSync(claudeDir, { recursive: true });
  }

  let settings: ClaudeSettings = {};
  if (fs.existsSync(settingsPath)) {
    const raw = fs.readFileSync(settingsPath, 'utf8');
    try {
      settings = JSON.parse(raw) as ClaudeSettings;
    } catch {
      throw new Error(
        `garrepa: ${settingsPath} is not valid JSON; refusing to overwrite. Fix the file and re-run garrepa init.`,
      );
    }
  }

  if (!settings.hooks) settings.hooks = {};
  if (!settings.hooks.PreToolUse) settings.hooks.PreToolUse = [];
  if (!settings.hooks.PostToolUse) settings.hooks.PostToolUse = [];

  settings.hooks.PreToolUse = stripGarrepaHooks(settings.hooks.PreToolUse, 'Read');
  settings.hooks.PreToolUse.push({
    matcher: 'Read',
    hooks: [
      {
        type: 'command',
        command: 'node',
        args: [CLAUDE_HOOK_LAUNCHER_ARG],
        timeout: HOOK_TIMEOUT_SECONDS,
      },
    ],
  });
  const launcherHook: HookEntry = {
    type: 'command',
    command: 'node',
    args: [CLAUDE_HOOK_LAUNCHER_ARG],
    timeout: HOOK_TIMEOUT_SECONDS,
  };
  settings.hooks.PostToolUse = stripGarrepaHooks(
    settings.hooks.PostToolUse,
    MCP_POST_TOOL_MATCHER,
  );
  settings.hooks.PostToolUse = stripGarrepaHooks(
    settings.hooks.PostToolUse,
    BASH_POST_TOOL_MATCHER,
  );
  settings.hooks.PostToolUse.push({
    matcher: MCP_POST_TOOL_MATCHER,
    hooks: [launcherHook],
  });
  settings.hooks.PostToolUse.push({
    matcher: BASH_POST_TOOL_MATCHER,
    hooks: [{ ...launcherHook, if: BASH_GIT_HOOK_IF }],
  });

  writeLauncher(projectRoot);
  fs.writeFileSync(settingsPath, JSON.stringify(settings, null, 2) + '\n', 'utf8');

  installSkill(projectRoot);

  if (!fs.existsSync(configPath)) {
    fs.writeFileSync(
      configPath,
      JSON.stringify(DEFAULT_GARREPA_CONFIG, null, 2) + '\n',
      'utf8',
    );
  }
}
