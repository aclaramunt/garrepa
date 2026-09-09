import type { Provider, GarrepaConfig } from '@garrepa/core';
import { AnthropicProvider } from '@garrepa/provider-anthropic';
import { OpenAICompatibleProvider } from '@garrepa/provider-openai-compatible';

export function createProvider(config: GarrepaConfig): Provider {
  const pc = config.provider;

  if (pc.type === 'anthropic') {
    const apiKey = pc.apiKeyEnvVar ? process.env[pc.apiKeyEnvVar] : undefined;
    return new AnthropicProvider({ apiKey, model: pc.model, maxTokens: pc.maxTokens });
  }

  if (pc.type === 'openai-compatible') {
    const apiKey = pc.apiKeyEnvVar ? process.env[pc.apiKeyEnvVar] : undefined;
    return new OpenAICompatibleProvider({
      baseUrl: pc.baseUrl,
      model: pc.model,
      apiKey,
      apiKeyEnvVar: pc.apiKeyEnvVar,
      maxTokens: pc.maxTokens,
    });
  }

  const _exhaustive: never = pc;
  throw new Error(`Unknown provider type: ${JSON.stringify(_exhaustive)}`);
}
