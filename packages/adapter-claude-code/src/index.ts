export { installHook } from './install';
export { installSkill, WRITE_SKILL_NAME } from './skill';
export { loadConfig, DEFAULT_GARREPA_CONFIG } from './config';
export type {
  GarrepaConfig,
  McpCompressionConfig,
  ProviderConfig,
  AnthropicProviderConfig,
  OpenAICompatibleProviderConfig,
} from './config';
export type {
  PreToolUsePayload,
  PostToolUsePayload,
  HookDecisionResponse,
  PostToolUseHookResponse,
} from './types';
export { handleHook } from './hook';
export type { HookOutput, HookDeps } from './hook';
export { handlePostToolUse } from './post-hook';
export type { PostHookOutput, PostHookDeps } from './post-hook';

export const VERSION = '0.0.1';
