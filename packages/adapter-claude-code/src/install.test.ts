import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { afterEach, describe, it, expect } from 'vitest';
import { installHook } from './install';
import { WRITE_SKILL_NAME, WRITE_SKILL_BODY } from './skill';

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
