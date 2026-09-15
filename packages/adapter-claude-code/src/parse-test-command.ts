/**
 * Conservative parser for Claude Code Bash commands that run test suites.
 *
 * Safety contract:
 *   - False negatives are acceptable (output passes through uncompressed).
 *   - False positives (compressing non-test output) are not.
 *
 * Any command with shell metacharacters is passed through.
 */

export interface TestRunnerMatch {
  runner: string;
}

const SHELL_METACHARACTERS = /[|><;&`$()]/;

const DIRECT_RUNNERS = new Set([
  'jest',
  'vitest',
  'mocha',
  'jasmine',
  'pytest',
  'py.test',
  'phpunit',
]);

const PKG_MANAGER_TEST = /^(?:pnpm|npm|yarn|bun)\s+(?:run\s+)?test(?:\s|$)/;

export function parseTestCommand(cmd: string): TestRunnerMatch | null {
  if (SHELL_METACHARACTERS.test(cmd)) return null;

  const trimmed = cmd.trim();

  if (PKG_MANAGER_TEST.test(trimmed)) {
    const manager = trimmed.split(/\s+/)[0] ?? 'pkg';
    return { runner: `${manager} test` };
  }

  if (/^cargo\s+test(?:\s|$)/.test(trimmed)) return { runner: 'cargo test' };
  if (/^go\s+test(?:\s|$)/.test(trimmed)) return { runner: 'go test' };

  const tokens = trimmed.split(/\s+/);
  const first = tokens[0] ?? '';

  // npx <runner>
  if (first === 'npx') {
    const runnerToken = tokens.slice(1).find((t) => !t.startsWith('-')) ?? '';
    const base = runnerToken.split('/').pop() ?? '';
    if (DIRECT_RUNNERS.has(base)) return { runner: base };
    return null;
  }

  // Direct invocation (also handles ./node_modules/.bin/jest)
  const base = first.split('/').pop() ?? first;
  if (DIRECT_RUNNERS.has(base)) return { runner: base };

  return null;
}
