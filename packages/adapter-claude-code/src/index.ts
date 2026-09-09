export { installHook } from './install';
export { loadConfig, DEFAULT_GARREPA_CONFIG } from './config';
export type {
  GarrepaConfig,
  ProviderConfig,
  AnthropicProviderConfig,
  OpenAICompatibleProviderConfig,
} from './config';
export type { PreToolUsePayload, HookDecisionResponse } from './types';
export { handleHook } from './hook';
export type { HookOutput, HookDeps } from './hook';

export const VERSION = '0.0.1';
