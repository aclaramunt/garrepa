import { decide } from '@garrepa/core';
import type { PreToolUsePayload, HookDecisionResponse } from './types';
import type { GarrepaConfig } from './config';

/** Injected I/O so the hook logic is testable without touching real files. */
export interface HookDeps {
  readFile(filePath: string): string;
  loadConfig(cwd: string): GarrepaConfig;
}

export type HookOutput =
  | { type: 'allow' }
  | { type: 'deny'; response: HookDecisionResponse };

/**
 * Pure decision function: given a PreToolUse payload and injected deps,
 * returns whether to allow or deny the tool call.
 *
 * Only Read tool calls are ever inspected; everything else passes through.
 */
export function handleHook(payload: PreToolUsePayload, deps: HookDeps): HookOutput {
  if (payload.tool_name !== 'Read') {
    return { type: 'allow' };
  }

  const filePath = payload.tool_input['file_path'];
  if (typeof filePath !== 'string') {
    return { type: 'allow' };
  }

  let content: string;
  try {
    content = deps.readFile(filePath);
  } catch {
    // Unreadable file — let Claude Code surface its own error.
    return { type: 'allow' };
  }

  const config = deps.loadConfig(payload.cwd);
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
          `Run \`garrepa summarize ${filePath}\` via Bash to get a concise summary of this file. ` +
          `Use the summary output as the file content instead of reading the file directly.`,
      },
    },
  };
}
