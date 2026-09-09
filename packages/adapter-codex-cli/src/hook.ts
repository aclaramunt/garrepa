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

/**
 * Pure decision function: given a PreToolUse payload and injected deps,
 * returns whether to allow or deny the tool call.
 *
 * Only exec_command calls that match a simple, unambiguous read pattern are
 * ever inspected; everything else passes through unchanged.
 *
 * See parse-read-command.ts for the matching rules and their rationale.
 */
export function handleHook(payload: PreToolUsePayload, deps: HookDeps): HookOutput {
  // Codex CLI file reads go through exec_command — there is no dedicated read tool.
  if (payload.tool_name !== 'exec_command') {
    return { type: 'allow' };
  }

  const cmd = payload.tool_input['cmd'];
  if (typeof cmd !== 'string') {
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
          `Run \`garrepa summarize ${match.filePath}\` via exec_command to get a concise ` +
          `summary of this file. Use the summary output as the file content instead of ` +
          `reading the file directly.`,
      },
    },
  };
}
