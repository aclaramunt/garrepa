// Shared config lives in @garrepa/core so both adapters use the same format.
// Re-exported here for backward compatibility with existing imports.
export { loadConfig, DEFAULT_GARREPA_CONFIG } from '@garrepa/core';
export type {
  GarrepaConfig,
  ProviderConfig,
  AnthropicProviderConfig,
  OpenAICompatibleProviderConfig,
} from '@garrepa/core';
