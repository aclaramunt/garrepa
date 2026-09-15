import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { afterEach, describe, it, expect } from 'vitest';
import { installHook, BASH_HOOK_MATCHER } from './install';
import { WRITE_SKILL_NAME, WRITE_SKILL_BODY } from './skill';

const tmpDirs: string[] = [];

function makeTmp(): string {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'garrepa-codex-install-'));
  tmpDirs.push(dir);
  return dir;
}

afterEach(() => {
  for (const dir of tmpDirs.splice(0)) {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

describe('installHook — Codex CLI skill', () => {
  it('writes the garrepa-write skill to .agents/skills/<name>/SKILL.md', () => {
    const root = makeTmp();
    installHook(root);

    const skillPath = path.join(root, '.agents', 'skills', WRITE_SKILL_NAME, 'SKILL.md');
    expect(fs.existsSync(skillPath)).toBe(true);

    const content = fs.readFileSync(skillPath, 'utf8');
    expect(content).toContain(`name: ${WRITE_SKILL_NAME}`);
    expect(content).toContain(WRITE_SKILL_BODY);
  });

  it('is idempotent — a second install still leaves a single skill file', () => {
    const root = makeTmp();
    installHook(root);
    installHook(root);

    const skillDir = path.join(root, '.agents', 'skills', WRITE_SKILL_NAME);
    const files = fs.readdirSync(skillDir);
    expect(files).toEqual(['SKILL.md']);
  });
});

interface CodexHooksFile {
  hooks?: {
    PreToolUse?: Array<{ matcher?: string; hooks: Array<{ command: string }> }>;
  };
}

function readHooks(root: string): CodexHooksFile {
  return JSON.parse(
    fs.readFileSync(path.join(root, '.codex', 'hooks.json'), 'utf8'),
  ) as CodexHooksFile;
}

describe('installHook — Codex CLI matcher', () => {
  it('registers a PreToolUse matcher for Bash', () => {
    const root = makeTmp();
    installHook(root);

    const groups = readHooks(root).hooks?.PreToolUse ?? [];
    expect(groups).toHaveLength(1);
    expect(groups[0].matcher).toBe(BASH_HOOK_MATCHER);
    expect(groups[0].hooks).toHaveLength(1);
    expect(groups[0].hooks[0].command).toMatch(/pre-tool-use-hook\.js/);
  });

  it('is idempotent — a second install does not duplicate the hook group', () => {
    const root = makeTmp();
    installHook(root);
    installHook(root);

    const groups = readHooks(root).hooks?.PreToolUse ?? [];
    expect(groups).toHaveLength(1);
    expect(groups[0].matcher).toBe(BASH_HOOK_MATCHER);
  });

  it('upgrades a legacy exec_command matcher without duplicating the hook', () => {
    const root = makeTmp();
    installHook(root);

    const hooksPath = path.join(root, '.codex', 'hooks.json');
    const hooks = readHooks(root);
    const groups = hooks.hooks?.PreToolUse ?? [];
    groups[0].matcher = '^exec_command$';
    fs.writeFileSync(hooksPath, JSON.stringify(hooks, null, 2) + '\n', 'utf8');

    installHook(root);

    const updated = readHooks(root).hooks?.PreToolUse ?? [];
    expect(updated).toHaveLength(1);
    expect(updated[0].matcher).toBe(BASH_HOOK_MATCHER);
  });
});
