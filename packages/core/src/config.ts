import * as fs from 'fs';
import * as path from 'path';
import { DEFAULT_THRESHOLD } from './types';
import type { ThresholdConfig } from './types';

export interface AnthropicProviderConfig {
  type: 'anthropic';
  model?: string;
  maxTokens?: number;
  /** Name of the env var holding the API key. Never store the key value here. */
  apiKeyEnvVar?: string;
}

export interface OpenAICompatibleProviderConfig {
  type: 'openai-compatible';
  baseUrl: string;
  model: string;
  maxTokens?: number;
  /** Name of the env var holding the API key. Never store the key value here. */
  apiKeyEnvVar?: string;
}

export type ProviderConfig = AnthropicProviderConfig | OpenAICompatibleProviderConfig;

export interface GarrepaConfig {
  threshold: ThresholdConfig;
  provider: ProviderConfig;
}

export const DEFAULT_GARREPA_CONFIG: GarrepaConfig = {
  threshold: DEFAULT_THRESHOLD,
  provider: { type: 'anthropic', apiKeyEnvVar: 'ANTHROPIC_API_KEY' },
};

/**
 * Loads garrepa.config.json from `cwd`.
 *
 * @param readFile - Override to inject a fake filesystem in tests.
 *   Receives the absolute config path, must return its contents or throw.
 */
export function loadConfig(
  cwd: string,
  readFile?: (filePath: string) => string,
): GarrepaConfig {
  const configPath = path.join(cwd, 'garrepa.config.json');
  const reader = readFile ?? ((p: string) => fs.readFileSync(p, 'utf8'));

  try {
    const raw = reader(configPath);
    const parsed = JSON.parse(raw) as Partial<GarrepaConfig>;
    return {
      threshold: parsed.threshold ?? DEFAULT_THRESHOLD,
      provider: parsed.provider ?? DEFAULT_GARREPA_CONFIG.provider,
    };
  } catch {
    return DEFAULT_GARREPA_CONFIG;
  }
}
