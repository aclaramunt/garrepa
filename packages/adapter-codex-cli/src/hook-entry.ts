import * as fs from 'fs';
import { handleHook } from './hook';
import { loadCodexCliConfig } from './config';
import type { PreToolUsePayload } from './types';

export async function main(): Promise<void> {
  const chunks: Buffer[] = [];
  for await (const chunk of process.stdin as AsyncIterable<Buffer>) {
    chunks.push(chunk);
  }

  let payload!: PreToolUsePayload;
  try {
    payload = JSON.parse(Buffer.concat(chunks).toString('utf8')) as PreToolUsePayload;
  } catch {
    // Unparseable stdin — allow and exit cleanly.
    process.exit(0);
  }

  const output = handleHook(payload, {
    readFile: (filePath) => fs.readFileSync(filePath, 'utf8'),
    loadConfig: loadCodexCliConfig,
  });

  if (output.type === 'deny') {
    process.stdout.write(JSON.stringify(output.response));
  }
  process.exit(0);
}
