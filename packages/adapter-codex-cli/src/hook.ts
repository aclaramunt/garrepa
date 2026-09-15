import { decide } from '@garrepa/core';
import { parseReadCommand, DEFAULT_READ_COMMANDS } from './parse-read-command';
import type { CodexCliConfig } from './config';
import type { PreToolUsePayload, HookDecisionResponse } from './types';

/** Injected I/O so the hook logic is testable without touching real files. */
export interface HookDeps {
  readFile(filePath: string): string;
  loadConfig(cwd: string): CodexCliConfig;
}

export type HookOutput =
  | { type: 'allow' }
  | { type: 'deny'; response: HookDecisionResponse };

/** Canonical Codex hook name for shell, plus the older unified-exec identifier. */
const SHELL_TOOL_NAMES = new Set(['Bash', 'exec_command']);

/**
 * Codex currently sends `tool_input.command`; older payloads used `tool_input.cmd`.
 */
function extractShellCommand(toolInput: Record<string, unknown>): string | null {
  const command = toolInput['command'];
  if (typeof command === 'string') return command;
  const cmd = toolInput['cmd'];
  if (typeof cmd === 'string') return cmd;
  return null;
}

/**
 * Pure decision function: given a PreToolUse payload and injected deps,
 * returns whether to allow or deny the tool call.
 *
 * Only shell tool calls (`Bash` / legacy `exec_command`) that match a simple,
 * unambiguous read pattern are ever inspected; everything else passes through.
 *
 * See parse-read-command.ts for the matching rules and their rationale.
 */
export function handleHook(payload: PreToolUsePayload, deps: HookDeps): HookOutput {
  // Codex CLI file reads go through the shell — there is no dedicated read tool.
  if (!SHELL_TOOL_NAMES.has(payload.tool_name)) {
    return { type: 'allow' };
  }

  const cmd = extractShellCommand(payload.tool_input);
  if (cmd === null) {
    return { type: 'allow' };
  }

  const config = deps.loadConfig(payload.cwd);
  const readCommands = config.readCommands ?? DEFAULT_READ_COMMANDS;

  const match = parseReadCommand(cmd, readCommands);
  if (!match) {
    // Not a recognised read pattern — pass through to avoid false positives.
    return { type: 'allow' };
  }

  let content: string;
  try {
    content = deps.readFile(match.filePath);
  } catch {
    // Unreadable file — let Codex CLI surface its own error.
    return { type: 'allow' };
  }

  const decision = decide(content, config.threshold);

  if (!decision.delegate) {
    return { type: 'allow' };
  }

  return {
    type: 'deny',
    response: {
      hookSpecificOutput: {
        hookEventName: 'PreToolUse',
        permissionDecision: 'deny',
        permissionDecisionReason:
          `File is large (${content.length} chars, threshold: ${config.threshold.minChars} chars). ` +
          `Use \`garrepa summarize\` to get a compressed summary instead.`,
        additionalContext:
          `Run \`garrepa summarize ${match.filePath}\` via Bash to get a concise ` +
          `summary of this file. Use the summary output as the file content instead of ` +
          `reading the file directly.`,
      },
    },
  };
}
