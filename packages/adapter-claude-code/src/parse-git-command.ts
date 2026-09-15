/**
 * Conservative parser for Claude Code Bash commands that dump git history/diffs.
 *
 * Safety contract:
 *   - False negatives are acceptable.
 *   - False positives (compressing commit/push/or a compound shell) are not.
 *
 * Any command with shell metacharacters is passed through. Only simple
 * `git diff` / `git log` / `git show` invocations match.
 */

export type GitDumpSubcommand = 'diff' | 'log' | 'show';

export interface GitDumpMatch {
  subcommand: GitDumpSubcommand;
  /** Non-flag tokens after the subcommand (refs and paths). */
  paths: string[];
}

const DUMP_SUBCOMMANDS = new Set<string>(['diff', 'log', 'show']);

const SHELL_METACHARACTERS = /[|><;&`$()]/;

export function parseGitDumpCommand(cmd: string): GitDumpMatch | null {
  if (SHELL_METACHARACTERS.test(cmd)) return null;

  const tokens = cmd.trim().split(/\s+/);
  if (tokens[0] !== 'git' || tokens.length < 2) return null;

  let subcommand: string | undefined;
  const after: string[] = [];
  for (const token of tokens.slice(1)) {
    if (subcommand == null) {
      if (token.startsWith('-')) continue;
      subcommand = token;
      continue;
    }
    after.push(token);
  }
  if (subcommand == null || !DUMP_SUBCOMMANDS.has(subcommand)) return null;

  const paths = after.filter((token) => token !== '--' && !token.startsWith('-'));
  return { subcommand: subcommand as GitDumpSubcommand, paths };
}
