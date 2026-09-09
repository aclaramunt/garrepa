/**
 * Project skill installed by `garrepa init` for Claude Code.
 *
 * Location follows current Claude Code docs:
 *   https://code.claude.com/docs/en/skills
 *   project skills → `.claude/skills/<name>/SKILL.md`
 */
import * as fs from 'fs';
import * as path from 'path';

export const WRITE_SKILL_NAME = 'garrepa-write';

export const WRITE_SKILL_BODY =
  'When about to commit changes, if the diff is large or the change is straightforward, pipe `git diff` (or `git diff --staged`) into `garrepa write commit-message` to get a suggested commit message instead of writing one from scratch. Always review the suggested message before committing — garrepa never runs `git commit` itself.';

export const WRITE_SKILL_MARKDOWN = `---
name: ${WRITE_SKILL_NAME}
description: >-
  Use when about to commit changes or write a git commit message, especially
  if the diff is large or the change is straightforward. Delegates drafting
  to \`garrepa write commit-message\`. Never run git commit or git push via this skill.
---

${WRITE_SKILL_BODY}
`;

export function installSkill(projectRoot: string): void {
  const skillDir = path.join(projectRoot, '.claude', 'skills', WRITE_SKILL_NAME);
  fs.mkdirSync(skillDir, { recursive: true });
  fs.writeFileSync(path.join(skillDir, 'SKILL.md'), WRITE_SKILL_MARKDOWN, 'utf8');
}
