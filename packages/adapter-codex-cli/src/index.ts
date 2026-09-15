/**
 * Community scaffold for Codex CLI. First-party product work belongs in
 * `@garrepa/adapter-claude-code`. Keep this package compiling; do not expand it
 * unless you are a community contribution that stays inside this adapter.
 */
export { installHook, BASH_HOOK_MATCHER } from './install';
export { installSkill, WRITE_SKILL_NAME } from './skill';
export { loadCodexCliConfig, DEFAULT_CODEX_CLI_CONFIG, DEFAULT_READ_COMMANDS } from './config';
export type { CodexCliConfig } from './config';
export type { PreToolUsePayload, HookDecisionResponse } from './types';
export { handleHook } from './hook';
export type { HookOutput, HookDeps } from './hook';
export { parseReadCommand } from './parse-read-command';

export const VERSION = '0.0.1';
