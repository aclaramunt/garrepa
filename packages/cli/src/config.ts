import * as fs from 'fs';
import * as path from 'path';
import type { GarrepaConfig } from '@garrepa/core';

export type { GarrepaConfig };
export { DEFAULT_GARREPA_CONFIG } from '@garrepa/core';

const CONFIG_FILENAME = 'garrepa.config.json';

export function configPath(cwd: string): string {
  return path.join(cwd, CONFIG_FILENAME);
}

export function readConfig(cwd: string): GarrepaConfig | null {
  try {
    const raw = fs.readFileSync(configPath(cwd), 'utf8');
    return JSON.parse(raw) as GarrepaConfig;
  } catch {
    return null;
  }
}

export function writeConfig(cwd: string, config: GarrepaConfig): void {
  fs.writeFileSync(configPath(cwd), JSON.stringify(config, null, 2) + '\n', 'utf8');
}
