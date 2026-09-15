import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { afterEach, describe, it, expect } from 'vitest';
import { installHook } from './install';
import { WRITE_SKILL_NAME, WRITE_SKILL_BODY } from './skill';
import {
  BASH_GIT_HOOK_IF,
  BASH_POST_TOOL_MATCHER,
  CLAUDE_HOOK_LAUNCHER_ARG,
  HOOK_TIMEOUT_SECONDS,
  LAUNCHER_RELATIVE_PATH,
  MCP_POST_TOOL_MATCHER,
} from './constants';

const tmpDirs: string[] = [];

function makeTmp(): string {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'garrepa-claude-install-'));
  tmpDirs.push(dir);
  return dir;
}

afterEach(() => {
  for (const dir of tmpDirs.splice(0)) {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

function readSettings(root: string): {
  hooks?: {
    PreToolUse?: Array<{ matcher: string; hooks: Array<{ command: string; args?: string[]; timeout?: number }> }>;
    PostToolUse?: Array<{
      matcher: string;
      hooks: Array<{ command: string; args?: string[]; timeout?: number; if?: string; type?: string }>;
    }>;
  };
} {
  return JSON.parse(fs.readFileSync(path.join(root, '.claude', 'settings.json'), 'utf8')) as {
    hooks?: {
      PreToolUse?: Array<{ matcher: string; hooks: Array<{ command: string; args?: string[]; timeout?: number }> }>;
      PostToolUse?: Array<{
        matcher: string;
        hooks: Array<{ command: string; args?: string[]; timeout?: number; if?: string; type?: string }>;
      }>;
    };
  };
}

describe('installHook — Claude Code skill', () => {
  it('writes the garrepa-write skill to .claude/skills/<name>/SKILL.md', () => {
    const root = makeTmp();
    installHook(root);

    const skillPath = path.join(root, '.claude', 'skills', WRITE_SKILL_NAME, 'SKILL.md');
    expect(fs.existsSync(skillPath)).toBe(true);

    const content = fs.readFileSync(skillPath, 'utf8');
    expect(content).toContain(`name: ${WRITE_SKILL_NAME}`);
    expect(content).toContain(WRITE_SKILL_BODY);
  });

  it('is idempotent — a second install still leaves a single skill file', () => {
    const root = makeTmp();
    installHook(root);
    installHook(root);

    const skillDir = path.join(root, '.claude', 'skills', WRITE_SKILL_NAME);
    const files = fs.readdirSync(skillDir);
    expect(files).toEqual(['SKILL.md']);
  });
});

describe('installHook — settings merge', () => {
  it('writes Read, MCP, and Bash git hooks with the project-local launcher and timeout', () => {
    const root = makeTmp();
    installHook(root);

    const settings = readSettings(root);
    const groups = settings.hooks?.PreToolUse ?? [];
    const readGroups = groups.filter((g) => g.matcher === 'Read');
    expect(readGroups).toHaveLength(1);
    expect(readGroups[0]?.hooks).toHaveLength(1);
    const hook = readGroups[0]?.hooks[0];
    expect(hook?.command).toBe('node');
    expect(hook?.args).toEqual([CLAUDE_HOOK_LAUNCHER_ARG]);
    expect(hook?.timeout).toBe(HOOK_TIMEOUT_SECONDS);

    const postGroups = settings.hooks?.PostToolUse ?? [];
    const mcpGroups = postGroups.filter((g) => g.matcher === MCP_POST_TOOL_MATCHER);
    expect(mcpGroups).toHaveLength(1);
    expect(mcpGroups[0]?.hooks).toEqual([
      {
        type: 'command',
        command: 'node',
        args: [CLAUDE_HOOK_LAUNCHER_ARG],
        timeout: HOOK_TIMEOUT_SECONDS,
      },
    ]);

    const bashGroups = postGroups.filter((g) => g.matcher === BASH_POST_TOOL_MATCHER);
    expect(bashGroups).toHaveLength(1);
    expect(bashGroups[0]?.hooks).toEqual([
      {
        type: 'command',
        command: 'node',
        args: [CLAUDE_HOOK_LAUNCHER_ARG],
        timeout: HOOK_TIMEOUT_SECONDS,
        if: BASH_GIT_HOOK_IF,
      },
    ]);

    const launcher = fs.readFileSync(path.join(root, LAUNCHER_RELATIVE_PATH), 'utf8');
    expect(launcher).toContain('CLAUDE_PROJECT_DIR');
    expect(launcher).toContain('process.exit(0)');
  });

  it('does not duplicate the garrepa hook on a second install', () => {
    const root = makeTmp();
    installHook(root);
    installHook(root);
    const hooks = readSettings(root).hooks;
    const preHooks = (hooks?.PreToolUse ?? [])
      .flatMap((g) => g.hooks)
      .filter((h) => (h.args ?? []).some((a) => a.includes('garrepa-hook.js')));
    const postHooks = (hooks?.PostToolUse ?? [])
      .flatMap((g) => g.hooks)
      .filter((h) => (h.args ?? []).some((a) => a.includes('garrepa-hook.js')));
    expect(preHooks).toHaveLength(1);
    expect(postHooks).toHaveLength(2);
  });

  it('preserves unrelated hooks and permissions', () => {
    const root = makeTmp();
    const claudeDir = path.join(root, '.claude');
    fs.mkdirSync(claudeDir, { recursive: true });
    fs.writeFileSync(
      path.join(claudeDir, 'settings.json'),
      JSON.stringify({
        permissions: { allow: ['Bash(git *)'] },
        hooks: {
          PreToolUse: [
            {
              matcher: 'Bash',
              hooks: [{ type: 'command', command: 'echo', args: ['ok'] }],
            },
          ],
          PostToolUse: [
            {
              matcher: 'Write',
              hooks: [{ type: 'command', command: 'echo', args: ['post-ok'] }],
            },
          ],
        },
      }) + '\n',
      'utf8',
    );

    installHook(root);
    const raw = JSON.parse(fs.readFileSync(path.join(claudeDir, 'settings.json'), 'utf8')) as {
      permissions: { allow: string[] };
      hooks: { PreToolUse: unknown[]; PostToolUse: unknown[] };
    };
    expect(raw.permissions.allow).toEqual(['Bash(git *)']);
    expect(raw.hooks.PreToolUse).toHaveLength(2);
    expect(raw.hooks.PostToolUse).toHaveLength(3);
  });

  it('aborts without clobbering invalid settings JSON', () => {
    const root = makeTmp();
    const claudeDir = path.join(root, '.claude');
    fs.mkdirSync(claudeDir, { recursive: true });
    const settingsPath = path.join(claudeDir, 'settings.json');
    fs.writeFileSync(settingsPath, '{ not json {{', 'utf8');

    expect(() => installHook(root)).toThrow(/not valid JSON/);
    expect(fs.readFileSync(settingsPath, 'utf8')).toBe('{ not json {{');
  });
});
