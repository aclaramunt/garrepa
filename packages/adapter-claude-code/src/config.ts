import * as fs from 'fs';
import * as path from 'path';
import {
  loadConfig as loadCoreConfig,
  DEFAULT_GARREPA_CONFIG as DEFAULT_CORE_CONFIG,
} from '@garrepa/core';
import type { GarrepaConfig as CoreGarrepaConfig } from '@garrepa/core';

export interface McpCompressionConfig {
  /** Exact Claude Code MCP tool names that must always pass through. */
  excludeTools?: string[];
}

export interface GarrepaConfig extends CoreGarrepaConfig {
  /** Claude Code-only options. Core and other adapters intentionally ignore this. */
  mcp?: McpCompressionConfig;
}

export const DEFAULT_GARREPA_CONFIG: GarrepaConfig = DEFAULT_CORE_CONFIG;

/**
 * Loads shared provider/threshold settings through core, then reads optional
 * Claude Code-only MCP exclusions from the same file.
 */
export function loadConfig(
  cwd: string,
  readFile?: (filePath: string) => string,
): GarrepaConfig {
  const configPath = path.join(cwd, 'garrepa.config.json');
  const reader = readFile ?? ((filePath: string) => fs.readFileSync(filePath, 'utf8'));
  let raw: string;
  try {
    raw = reader(configPath);
  } catch {
    return DEFAULT_GARREPA_CONFIG;
  }
  const coreConfig = loadCoreConfig(cwd, () => raw);

  try {
    const parsed = JSON.parse(raw) as {
      mcp?: { excludeTools?: unknown };
    };
    const excludeTools = Array.isArray(parsed.mcp?.excludeTools)
      ? parsed.mcp.excludeTools.filter(
          (toolName): toolName is string =>
            typeof toolName === 'string' && toolName.startsWith('mcp__'),
        )
      : undefined;
    return excludeTools == null
      ? coreConfig
      : { ...coreConfig, mcp: { excludeTools } };
  } catch {
    return coreConfig;
  }
}

export type {
  ProviderConfig,
  AnthropicProviderConfig,
  OpenAICompatibleProviderConfig,
} from '@garrepa/core';
