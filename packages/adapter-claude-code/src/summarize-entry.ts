import * as fs from 'fs';
import * as path from 'path';
import { route } from '@garrepa/core';
import { AnthropicProvider } from '@garrepa/provider-anthropic';
import { loadConfig } from './config';

const INSTRUCTION =
  "Summarize this file's key content concisely, capturing the most important information for a developer reading the codebase.";

export async function main(): Promise<void> {
  const rawPath = process.argv[2];
  if (!rawPath) {
    process.stderr.write('Usage: garrepa-summarize <file-path>\n');
    process.exit(1);
  }

  const filePath = path.resolve(rawPath);

  let content!: string;
  try {
    content = fs.readFileSync(filePath, 'utf8');
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    process.stderr.write(`garrepa summarize: cannot read file: ${msg}\n`);
    process.exit(1);
  }

  const config = loadConfig(process.cwd());
  const provider = new AnthropicProvider({
    model: config.provider.model,
    maxTokens: config.provider.maxTokens,
  });

  try {
    const result = await route(content, INSTRUCTION, config.threshold, provider);
    process.stdout.write(result.output);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    process.stderr.write(`garrepa summarize: summarization failed: ${msg}\n`);
    process.exit(1);
  }
}
