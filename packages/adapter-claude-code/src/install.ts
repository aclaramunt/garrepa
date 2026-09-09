import * as fs from 'fs';
import * as path from 'path';
import { DEFAULT_GARREPA_CONFIG } from './config';

/** Absolute path to the hook bin script in this package. */
const HOOK_BIN = path.resolve(__dirname, '..', 'bin', 'pre-tool-use-hook.js');

interface HookEntry {
  type: string;
  command: string;
  args?: string[];
}

interface HookGroup {
  matcher: string;
  hooks: HookEntry[];
}

interface ClaudeSettings {
  hooks?: {
    PreToolUse?: HookGroup[];
    [key: string]: unknown;
  };
  [key: string]: unknown;
}

/**
 * Registers the garrepa PreToolUse hook in `<projectRoot>/.claude/settings.json`
 * and creates a default `garrepa.config.json` if one does not exist.
 *
 * Safe to call multiple times — will not add a duplicate hook entry.
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
    try {
      settings = JSON.parse(fs.readFileSync(settingsPath, 'utf8')) as ClaudeSettings;
    } catch {
      settings = {};
    }
  }

  if (!settings.hooks) settings.hooks = {};
  if (!settings.hooks.PreToolUse) settings.hooks.PreToolUse = [];

  const alreadyInstalled = settings.hooks.PreToolUse.some(
    (group) =>
      group.matcher === 'Read' &&
      group.hooks.some(
        (h) => h.command === 'node' && Array.isArray(h.args) && h.args.includes(HOOK_BIN),
      ),
  );

  if (!alreadyInstalled) {
    settings.hooks.PreToolUse.push({
      matcher: 'Read',
      hooks: [{ type: 'command', command: 'node', args: [HOOK_BIN] }],
    });
  }

  fs.writeFileSync(settingsPath, JSON.stringify(settings, null, 2) + '\n', 'utf8');

  if (!fs.existsSync(configPath)) {
    fs.writeFileSync(
      configPath,
      JSON.stringify(DEFAULT_GARREPA_CONFIG, null, 2) + '\n',
      'utf8',
    );
  }
}
