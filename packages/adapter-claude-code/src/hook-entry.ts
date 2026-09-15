import { handleHook } from './hook';
import { handlePostToolUse } from './post-hook';
import type { HookDeps } from './hook';
import type { PostHookDeps } from './post-hook';
import { loadConfig } from './config';
import { createProvider, withTimeout } from './provider-factory';
import { readTextWindow, statSize } from './read-window';
import { MAX_STDIN_BYTES, PROVIDER_TIMEOUT_MS } from './constants';
import { route } from '@garrepa/core';
import type { TokenUsage, GarrepaConfig } from '@garrepa/core';
import type { PostToolUsePayload, PreToolUsePayload } from './types';

interface CompressionStats {
  originalChars: number;
  compressedChars: number;
  usage?: TokenUsage;
}

function formatStats(stats: CompressionStats): string {
  const savedChars = stats.originalChars - stats.compressedChars;
  const savedPct = Math.round((savedChars / stats.originalChars) * 100);
  const savedTokensEst = Math.round(savedChars / 4);

  const parts: string[] = [
    `[garrepa] compressed ${stats.originalChars.toLocaleString()} → ${stats.compressedChars.toLocaleString()} chars`,
    `saved ~${savedPct}% (~${savedTokensEst.toLocaleString()} orchestrator tokens)`,
  ];

  if (stats.usage) {
    const cheapTotal = stats.usage.inputTokens + stats.usage.outputTokens;
    parts.push(`cheap model used ${cheapTotal.toLocaleString()} tokens (${stats.usage.inputTokens.toLocaleString()} in / ${stats.usage.outputTokens.toLocaleString()} out)`);
  }

  return parts.join(' | ') + '\n';
}

export type HookEntryDeps = HookDeps & PostHookDeps;

export async function dispatchHookPayload(
  payload: unknown,
  deps: HookEntryDeps,
): Promise<object | undefined> {
  if (typeof payload !== 'object' || payload === null) return undefined;

  const eventName = (payload as { hook_event_name?: unknown }).hook_event_name;
  if (eventName === 'PreToolUse') {
    const output = await handleHook(payload as PreToolUsePayload, deps);
    return output.type === 'deny' ? output.response : undefined;
  }
  if (eventName === 'PostToolUse') {
    const output = await handlePostToolUse(payload as PostToolUsePayload, deps);
    return output.type === 'replace' ? output.response : undefined;
  }
  return undefined;
}

async function readStdinCapped(): Promise<string> {
  const chunks: Buffer[] = [];
  let total = 0;
  for await (const chunk of process.stdin as AsyncIterable<Buffer>) {
    total += chunk.length;
    if (total > MAX_STDIN_BYTES) {
      return '';
    }
    chunks.push(chunk);
  }
  return Buffer.concat(chunks).toString('utf8');
}

export async function main(): Promise<void> {
  try {
    const raw = await readStdinCapped();
    if (!raw) {
      process.exit(0);
      return;
    }

    let payload: unknown;
    try {
      payload = JSON.parse(raw) as unknown;
    } catch {
      process.exit(0);
      return;
    }

    let compressionStats: CompressionStats | null = null;

    const summarize = async (
      content: string,
      instruction: string,
      config: GarrepaConfig,
    ): Promise<string> => {
      const provider = createProvider(config);
      const result = await withTimeout(
        route(content, instruction, { minChars: 0 }, provider),
        PROVIDER_TIMEOUT_MS,
        'garrepa provider',
      );
      compressionStats = {
        originalChars: content.length,
        compressedChars: result.output.length,
        usage: result.usage,
      };
      return result.output;
    };

    const output = await dispatchHookPayload(payload, {
      stat: (filePath) => ({ size: statSize(filePath) }),
      readWindow: readTextWindow,
      loadConfig,
      summarize,
    });
    if (compressionStats !== null) {
      process.stderr.write(formatStats(compressionStats));
    }
    if (output != null) {
      process.stdout.write(JSON.stringify(output));
    }
    process.exit(0);
  } catch {
    process.exit(0);
  }
}
