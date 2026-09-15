/**
 * All types specific to the Codex CLI hook protocol live here.
 * Nothing in @garrepa/core or any provider package should import from this file.
 *
 * Current protocol: https://developers.openai.com/codex/hooks
 *   tool_name is the canonical hook name (`Bash` for shell / unified exec).
 *   Bash tool_input uses `{ command: string }`.
 *
 * Legacy (older unified exec): tool_name `exec_command`, tool_input `{ cmd: string }`.
 * The adapter accepts both so older Codex builds keep working.
 */

/** Exact payload Codex CLI sends on stdin for every PreToolUse event. */
export interface PreToolUsePayload {
  session_id: string;
  turn_id: string;
  transcript_path: string | null;
  /** Absolute path to the working directory at the time of the hook invocation. */
  cwd: string;
  hook_event_name: 'PreToolUse';
  model: string;
  permission_mode: 'default' | 'acceptEdits' | 'plan' | 'dontAsk' | 'bypassPermissions';
  tool_name: string;
  /** Tool-specific fields; shape varies per tool. */
  tool_input: Record<string, unknown>;
  tool_use_id: string;
  /** Only present inside subagents. */
  agent_id?: string;
  agent_type?: string;
}

/**
 * Structured output the hook writes to stdout to deny a tool call.
 *
 * Source: openai/codex codex-rs/hooks/src/schema.rs — PreToolUseCommandOutputWire /
 * PreToolUseHookSpecificOutputWire (permissionDecision: "deny")
 */
export interface HookDecisionResponse {
  hookSpecificOutput: {
    hookEventName: 'PreToolUse';
    permissionDecision: 'deny';
    permissionDecisionReason: string;
    additionalContext?: string;
  };
}
