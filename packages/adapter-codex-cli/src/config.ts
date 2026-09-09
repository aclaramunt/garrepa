import * as fs from 'fs';
import * as path from 'path';
import { DEFAULT_THRESHOLD, DEFAULT_GARREPA_CONFIG } from '@garrepa/core';
import type { GarrepaConfig } from '@garrepa/core';
import { DEFAULT_READ_COMMANDS } from './parse-read-command';

/**
 * Extends the shared GarrepaConfig with Codex CLI-specific settings.
 * All base fields are loaded from garrepa.config.json, same file and format
 * as the Claude Code adapter.
 */
export interface CodexCliConfig extends GarrepaConfig {
  /**
   * Shell commands treated as file reads for interception purposes.
   * Defaults to DEFAULT_READ_COMMANDS when absent from config.
   * Add entries here to extend pattern coverage without touching core logic.
   *
   * Example: ["cat", "head", "tail", "less", "more", "bat", "rg"]
   */
  readCommands?: string[];
}

export { DEFAULT_READ_COMMANDS };

export const DEFAULT_CODEX_CLI_CONFIG: CodexCliConfig = {
  ...DEFAULT_GARREPA_CONFIG,
};

/**
 * Loads garrepa.config.json from `cwd`, including the optional `readCommands`
 * field specific to the Codex CLI adapter.
 *
 * Falls back to DEFAULT_CODEX_CLI_CONFIG on any read or parse failure.
 *
 * @param readFile - Override to inject a fake filesystem in tests.
 */
export function loadCodexCliConfig(
  cwd: string,
  readFile?: (filePath: string) => string,
): CodexCliConfig {
  const configPath = path.join(cwd, 'garrepa.config.json');
  const reader = readFile ?? ((p: string) => fs.readFileSync(p, 'utf8'));

  try {
    const raw = reader(configPath);
    const parsed = JSON.parse(raw) as Partial<GarrepaConfig> & { readCommands?: unknown };
    return {
      threshold: parsed.threshold ?? DEFAULT_THRESHOLD,
      provider: parsed.provider ?? DEFAULT_GARREPA_CONFIG.provider,
      readCommands: Array.isArray(parsed.readCommands)
        ? (parsed.readCommands as string[])
        : undefined,
    };
  } catch {
    return DEFAULT_CODEX_CLI_CONFIG;
  }
}
