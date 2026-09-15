/**
 * All types specific to the Claude Code hook protocol live here.
 * Nothing in @garrepa/core or @garrepa/provider-anthropic should import from this file.
 */

interface BaseHookPayload {
  session_id: string;
  transcript_path: string;
  /** Absolute path to the project root at the time of the hook invocation. */
  cwd: string;
  permission_mode: string;
  tool_name: string;
  tool_use_id: string;
  /** Only present inside subagents. */
  agent_id?: string;
  agent_type?: string;
}

/** Exact payload Claude Code sends on stdin for every PreToolUse event. */
export interface PreToolUsePayload extends BaseHookPayload {
  prompt_id: string;
  hook_event_name: 'PreToolUse';
  /** Tool-specific fields; shape varies per tool. */
  tool_input: Record<string, unknown>;
}

/** Exact payload Claude Code sends after a successful tool invocation. */
export interface PostToolUsePayload extends BaseHookPayload {
  prompt_id?: string;
  hook_event_name: 'PostToolUse';
  tool_input: unknown;
  tool_response: unknown;
  duration_ms?: number;
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

/** Structured output that replaces a successful tool result before Claude sees it. */
export interface PostToolUseHookResponse {
  hookSpecificOutput: {
    hookEventName: 'PostToolUse';
    /** Must retain the original tool response shape. */
    updatedToolOutput: unknown;
  };
}
