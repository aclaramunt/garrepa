/**
 * All types specific to the Claude Code hook protocol live here.
 * Nothing in @garrepa/core or @garrepa/provider-anthropic should import from this file.
 */

/** Exact payload Claude Code sends on stdin for every PreToolUse event. */
export interface PreToolUsePayload {
  session_id: string;
  prompt_id: string;
  transcript_path: string;
  /** Absolute path to the project root at the time of the hook invocation. */
  cwd: string;
  permission_mode: string;
  hook_event_name: 'PreToolUse';
  tool_name: string;
  /** Tool-specific fields; shape varies per tool. */
  tool_input: Record<string, unknown>;
  tool_use_id: string;
  /** Only present inside subagents. */
  agent_id?: string;
  agent_type?: string;
}

/** Structured output the hook writes to stdout when denying a tool call. */
export interface HookDecisionResponse {
  hookSpecificOutput: {
    hookEventName: 'PreToolUse';
    permissionDecision: 'allow' | 'deny';
    /** Shown to the user (and to Claude) explaining why the tool was blocked. */
    permissionDecisionReason?: string;
    /** Additional guidance injected into Claude's context. */
    additionalContext?: string;
  };
}
