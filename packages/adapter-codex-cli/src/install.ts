import * as fs from 'fs';
import * as path from 'path';
import { DEFAULT_GARREPA_CONFIG } from '@garrepa/core';
import { installSkill } from './skill';

/** Absolute path to the hook bin script in this package. */
const HOOK_BIN = path.resolve(__dirname, '..', 'bin', 'pre-tool-use-hook.js');

interface HookEntry {
  type: 'command';
  command: string;
  timeout?: number;
}

interface MatcherGroup {
  matcher?: string;
  hooks: HookEntry[];
}

interface CodexHooksFile {
  hooks?: {
    PreToolUse?: MatcherGroup[];
    [key: string]: unknown;
  };
  [key: string]: unknown;
}

/**
 * Registers the garrepa PreToolUse hook in `<projectRoot>/.codex/hooks.json`,
 * installs the `garrepa-write` project skill under `.agents/skills/`, and
 * creates a default `garrepa.config.json` if one does not exist.
 *
 * Hook config format source: openai/codex codex-rs/config/src/hook_config.rs
 * File location source: openai/codex codex-rs/hooks/src/engine/discovery.rs
 *   (load_hooks_json joins the .codex config folder with "hooks.json")
 * Skill location source: https://developers.openai.com/codex/skills
 *   (repo skills live in `.agents/skills`)
 *
 * Safe to call multiple times — will not add a duplicate hook entry.
 */
export function installHook(projectRoot: string): void {
  const codexDir = path.join(projectRoot, '.codex');
  const hooksPath = path.join(codexDir, 'hooks.json');
  const configPath = path.join(projectRoot, 'garrepa.config.json');

  if (!fs.existsSync(codexDir)) {
    fs.mkdirSync(codexDir, { recursive: true });
  }

  let hooksFile: CodexHooksFile = { hooks: {} };
  if (fs.existsSync(hooksPath)) {
    try {
      hooksFile = JSON.parse(fs.readFileSync(hooksPath, 'utf8')) as CodexHooksFile;
    } catch {
      hooksFile = { hooks: {} };
    }
  }

  if (!hooksFile.hooks) hooksFile.hooks = {};
  if (!hooksFile.hooks.PreToolUse) hooksFile.hooks.PreToolUse = [];

  // Codex CLI hook command is a single shell string (no separate args field).
  const hookCommand = `node ${HOOK_BIN}`;
  const alreadyInstalled = hooksFile.hooks.PreToolUse.some(
    (group) =>
      group.matcher === '^exec_command$' &&
      group.hooks.some((h) => h.command === hookCommand),
  );

  if (!alreadyInstalled) {
    hooksFile.hooks.PreToolUse.push({
      matcher: '^exec_command$',
      hooks: [{ type: 'command', command: hookCommand, timeout: 30 }],
    });
  }

  fs.writeFileSync(hooksPath, JSON.stringify(hooksFile, null, 2) + '\n', 'utf8');

  installSkill(projectRoot);

  if (!fs.existsSync(configPath)) {
    fs.writeFileSync(
      configPath,
      JSON.stringify(DEFAULT_GARREPA_CONFIG, null, 2) + '\n',
      'utf8',
    );
  }
}
