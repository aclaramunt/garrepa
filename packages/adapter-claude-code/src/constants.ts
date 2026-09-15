/** Average characters per line used to estimate a Read offset/limit window. */
export const AVG_CHARS_PER_LINE = 120;

/** Seconds Claude Code should wait before cancelling the hook command. */
export const HOOK_TIMEOUT_SECONDS = 20;

/** Cheap-model round-trip budget inside the hook. */
export const PROVIDER_TIMEOUT_MS = 15_000;

/** Keep additionalContext under Claude Code's 10k hook-output cap. */
export const SUMMARY_MAX_CHARS = 8_000;

/** Fail-open if a hook payload (including inline MCP images) exceeds this. */
export const MAX_STDIN_BYTES = 8_000_000;

/** maxTokens for in-hook documentation maps. */
export const HOOK_MAX_TOKENS = 2_048;

/** Matches every regular and plugin-provided Claude Code MCP tool. */
export const MCP_POST_TOOL_MATCHER = 'mcp__.*';

/** Claude Code Bash tool name for PostToolUse git dumps. */
export const BASH_POST_TOOL_MATCHER = 'Bash';

/** Harness `if` filter: spawn the hook only for git subcommands (best-effort). */
export const BASH_GIT_HOOK_IF = 'Bash(git *)';

export const LAUNCHER_RELATIVE_PATH = '.claude/hooks/garrepa-hook.js';

export const CLAUDE_HOOK_LAUNCHER_ARG = `\${CLAUDE_PROJECT_DIR}/${LAUNCHER_RELATIVE_PATH}`;
