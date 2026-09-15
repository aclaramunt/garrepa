import type { Provider, GarrepaConfig } from '@garrepa/core';
import { AnthropicProvider } from '@garrepa/provider-anthropic';
import { OpenAICompatibleProvider } from '@garrepa/provider-openai-compatible';
import { HOOK_MAX_TOKENS } from './constants';

export function createProvider(config: GarrepaConfig): Provider {
  const pc = config.provider;
  const maxTokens = pc.maxTokens ?? HOOK_MAX_TOKENS;

  if (pc.type === 'anthropic') {
    const apiKey = pc.apiKeyEnvVar ? process.env[pc.apiKeyEnvVar] : undefined;
    return new AnthropicProvider({ apiKey, model: pc.model, maxTokens });
  }

  if (pc.type === 'openai-compatible') {
    const apiKey = pc.apiKeyEnvVar ? process.env[pc.apiKeyEnvVar] : undefined;
    return new OpenAICompatibleProvider({
      baseUrl: pc.baseUrl,
      model: pc.model,
      apiKey,
      apiKeyEnvVar: pc.apiKeyEnvVar,
      maxTokens,
    });
  }

  const _exhaustive: never = pc;
  throw new Error(`Unknown provider type: ${JSON.stringify(_exhaustive)}`);
}

export function withTimeout<T>(promise: Promise<T>, ms: number, label: string): Promise<T> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      reject(new Error(`${label} timed out after ${ms}ms`));
    }, ms);
    promise.then(
      (value) => {
        clearTimeout(timer);
        resolve(value);
      },
      (err: unknown) => {
        clearTimeout(timer);
        reject(err);
      },
    );
  });
}
