import { describe, expect, it } from 'vitest';
import { parseGitDumpCommand } from './parse-git-command';

describe('parseGitDumpCommand', () => {
  it.each([
    ['git diff', 'diff', []],
    ['git diff --staged', 'diff', []],
    ['git diff HEAD -- src/foo.ts', 'diff', ['HEAD', 'src/foo.ts']],
    ['git --no-pager log', 'log', []],
    ['git log -p', 'log', []],
    ['git show abc123', 'show', ['abc123']],
  ] as const)('matches %s', (cmd, subcommand, paths) => {
    expect(parseGitDumpCommand(cmd)).toEqual({ subcommand, paths });
  });

  it.each([
    'git commit -m "msg"',
    'git push origin main',
    'git pull',
    'git rebase main',
    'git reset --hard',
    'git checkout HEAD',
    'git stash',
    'git add src/foo.ts',
    'git status',
    'git',
    'git -C /tmp log',
    'git diff && git status',
    'git diff | head',
    'git log $(cat sha)',
    'echo hi',
    'GIT_DIR=foo git log',
  ])('rejects %s', (cmd) => {
    expect(parseGitDumpCommand(cmd)).toBeNull();
  });
});
