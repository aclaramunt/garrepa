import type { Provider, GarrepaConfig } from '@garrepa/core';
import { getPresetInstruction, listPresetNames } from '../presets';

export interface WriteDeps {
  readStdin(): Promise<string>;
  readConfig(cwd: string): GarrepaConfig | null;
  createProvider(config: GarrepaConfig): Provider;
  writeOutput(text: string): void;
  writeError(text: string): void;
  exit(code: number): never;
}

export async function readStdinFromProcess(): Promise<string> {
  if (process.stdin.isTTY) return '';
  const chunks: Buffer[] = [];
  for await (const chunk of process.stdin) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  }
  return Buffer.concat(chunks).toString('utf8');
}

export async function runWrite(preset: string, cwd: string, deps: WriteDeps): Promise<void> {
  const config = deps.readConfig(cwd);
  if (!config) {
    deps.writeError(
      'garrepa: no garrepa.config.json found in the current directory.\n' +
        'Run `garrepa init` first to set up garrepa for this project.\n',
    );
    deps.exit(1);
  }

  const instruction = getPresetInstruction(preset);
  if (!instruction) {
    const known = listPresetNames().join(', ');
    deps.writeError(`garrepa write: unknown preset "${preset}". Known presets: ${known}\n`);
    deps.exit(1);
  }

  const content = await deps.readStdin();
  if (content.trim().length === 0) {
    deps.writeError(
      'garrepa write: stdin is empty. Pipe content into the command, e.g. `git diff | garrepa write commit-message`.\n',
    );
    deps.exit(1);
  }

  const provider = deps.createProvider(config);
  try {
    const output = await provider.summarize(content, instruction);
    deps.writeOutput(output);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    deps.writeError(`garrepa write: generation failed: ${msg}\n`);
    deps.exit(1);
  }
}
