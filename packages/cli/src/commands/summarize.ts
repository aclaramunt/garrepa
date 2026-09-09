import * as path from 'path';
import { route } from '@garrepa/core';
import type { Provider, ThresholdConfig, RouterResult } from '@garrepa/core';
import type { GarrepaConfig } from '@garrepa/adapter-claude-code';
import { createProvider } from '../provider-factory';

const SUMMARIZE_INSTRUCTION =
  "Summarize this file's key content concisely, capturing the most important information for a developer reading the codebase.";

export interface SummarizeDeps {
  readFile(filePath: string): string;
  readConfig(cwd: string): GarrepaConfig | null;
  createProvider(config: GarrepaConfig): Provider;
  route(
    content: string,
    instruction: string,
    threshold: ThresholdConfig,
    provider: Provider,
  ): Promise<RouterResult>;
  writeOutput(text: string): void;
  writeError(text: string): void;
  exit(code: number): never;
}

export function makeSummarizeDeps(cwd: string, readConfig: (cwd: string) => GarrepaConfig | null): SummarizeDeps {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const fs = require('fs') as typeof import('fs');
  return {
    readFile: (p) => fs.readFileSync(p, 'utf8'),
    readConfig,
    createProvider,
    route,
    writeOutput: (t) => process.stdout.write(t),
    writeError: (t) => process.stderr.write(t),
    exit: (c) => process.exit(c),
  };
}

export async function runSummarize(
  rawPath: string,
  cwd: string,
  deps: SummarizeDeps,
): Promise<void> {
  const config = deps.readConfig(cwd);
  if (!config) {
    deps.writeError(
      'garrepa: no garrepa.config.json found in the current directory.\n' +
        'Run `garrepa init` first to set up garrepa for this project.\n',
    );
    deps.exit(1);
  }

  const filePath = path.resolve(cwd, rawPath);
  let content: string;
  try {
    content = deps.readFile(filePath);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    deps.writeError(`garrepa summarize: cannot read file: ${msg}\n`);
    deps.exit(1);
  }

  const provider = deps.createProvider(config);
  try {
    const result = await deps.route(content, SUMMARIZE_INSTRUCTION, config.threshold, provider);
    deps.writeOutput(result.output);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    deps.writeError(`garrepa summarize: summarization failed: ${msg}\n`);
    deps.exit(1);
  }
}
