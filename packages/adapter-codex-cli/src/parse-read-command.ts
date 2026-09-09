/**
 * Best-effort pattern matching for file-read commands in Codex CLI's exec_command tool.
 *
 * Codex CLI has no dedicated file-read tool — the model reads files via the shell
 * (exec_command). This module recognises simple, unambiguous read invocations and
 * extracts the target path so garrepa can inspect the file size before the tool runs.
 *
 * Safety contract:
 *   - False negatives (missed reads) are acceptable.
 *   - False positives (intercepting a non-read command) are NOT acceptable.
 *
 * Any command containing shell metacharacters (pipes, redirects, chaining, subshells)
 * is passed through unchanged. Only single-file, single-command invocations match.
 *
 * Source reference: openai/codex codex-rs/hooks/src/schema.rs — PreToolUseCommandInput
 * has `tool_name: "exec_command"` and `tool_input: { cmd: "..." }`.
 */

export interface ReadCommandMatch {
  filePath: string;
}

/**
 * Commands recognised as file-read operations.
 * Configurable via garrepa.config.json `readCommands` field.
 */
export const DEFAULT_READ_COMMANDS: string[] = [
  'cat',
  'head',
  'tail',
  'less',
  'more',
  'bat',
];

const SHELL_METACHARACTERS = /[|><;&`$()]/;

/**
 * Parses a shell command string and returns the target file path if the command
 * is an unambiguous single-file read. Returns null for anything else.
 *
 * Matched form: `<cmd> [-flag]* <filepath>`
 *   - All intermediate tokens must be flags (start with `-`).
 *   - Exactly one non-flag token (the file path).
 *   - No shell metacharacters anywhere.
 *   - No quoted paths (false negative — acceptable).
 *
 * @param cmd - Raw `cmd` value from a Codex CLI exec_command tool_input.
 * @param readCommands - Allowlist of command names to treat as reads.
 */
export function parseReadCommand(
  cmd: string,
  readCommands: string[] = DEFAULT_READ_COMMANDS,
): ReadCommandMatch | null {
  if (SHELL_METACHARACTERS.test(cmd)) return null;

  const tokens = cmd.trim().split(/\s+/);
  if (tokens.length < 2) return null;

  const command = tokens[0];
  if (!readCommands.includes(command)) return null;

  const args = tokens.slice(1);
  const nonFlagArgs = args.filter((a) => !a.startsWith('-'));

  if (nonFlagArgs.length !== 1) return null;

  return { filePath: nonFlagArgs[0] };
}
