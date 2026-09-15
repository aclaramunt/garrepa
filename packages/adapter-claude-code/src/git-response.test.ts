import { describe, expect, it } from 'vitest';
import { bashCommandFromInput, extractGitDump } from './git-response';

describe('extractGitDump', () => {
  it('extracts stdout and rebuilds the Bash output shape', () => {
    const original = {
      stdout: 'diff --git a/a b/a',
      stderr: 'warning',
      interrupted: false,
      isImage: false,
      extra: 1,
    };
    const extracted = extractGitDump(original);

    expect(extracted?.stdout).toBe('diff --git a/a b/a');
    expect(extracted?.rebuild('summary')).toEqual({
      stdout: 'summary',
      stderr: 'warning',
      interrupted: false,
      isImage: false,
      extra: 1,
    });
    expect(original.stdout).toBe('diff --git a/a b/a');
  });

  it.each([
    null,
    {},
    { stdout: '' },
    { stdout: 'x', interrupted: true },
    { stdout: 'x', isImage: true },
    { stdout: 1 },
  ])('passes through unsupported response %#', (response) => {
    expect(extractGitDump(response)).toBeNull();
  });
});

describe('bashCommandFromInput', () => {
  it('reads tool_input.command', () => {
    expect(bashCommandFromInput({ command: 'git diff' })).toBe('git diff');
    expect(bashCommandFromInput({ cmd: 'git diff' })).toBeNull();
    expect(bashCommandFromInput('git diff')).toBeNull();
  });
});
