import {
  decideFromCharCount,
  isSecretPath,
  DEFAULT_MAX_PROVIDER_CHARS,
} from '@garrepa/core';
import type { PreToolUsePayload, HookDecisionResponse } from './types';
import type { GarrepaConfig } from './config';
import { isDocumentationPath } from './classify';
import { DOC_MAP_INSTRUCTION } from './instructions';
import { AVG_CHARS_PER_LINE, SUMMARY_MAX_CHARS } from './constants';
import type { ReadWindowOpts } from './read-window';

export interface FileStat {
  size: number;
}

export interface HookDeps {
  stat(filePath: string): FileStat;
  readWindow(filePath: string, opts: ReadWindowOpts): string;
  loadConfig(cwd: string): GarrepaConfig;
  summarize(content: string, instruction: string, config: GarrepaConfig): Promise<string>;
}

export type HookOutput =
  | { type: 'allow' }
  | { type: 'deny'; response: HookDecisionResponse };

function parseLineBound(value: unknown): number | undefined {
  if (typeof value === 'number' && Number.isFinite(value) && value > 0) return value;
  if (typeof value === 'string' && value.trim() !== '') {
    const n = Number(value);
    if (Number.isFinite(n) && n > 0) return n;
  }
  return undefined;
}

function estimateWindowChars(
  statSize: number,
  offset: number | undefined,
  limit: number | undefined,
): number {
  if (limit != null) return limit * AVG_CHARS_PER_LINE;
  if (offset != null) return Math.max(0, statSize);
  return statSize;
}

function denyResponse(charCount: number, threshold: number, map: string): HookDecisionResponse {
  const clipped = map.length > SUMMARY_MAX_CHARS ? map.slice(0, SUMMARY_MAX_CHARS) : map;
  return {
    hookSpecificOutput: {
      hookEventName: 'PreToolUse',
      permissionDecision: 'deny',
      permissionDecisionReason:
        `Documentation is large (${charCount} chars, threshold: ${threshold} chars). ` +
        `Garrepa compressed it into a map. Use Read with offset/limit if you need the exact text of a section.`,
      additionalContext: clipped,
    },
  };
}

/**
 * PreToolUse decision: never intercept source. Compress only very large docs.
 * Fail-open on any error or when compression would not save tokens.
 */
export async function handleHook(payload: PreToolUsePayload, deps: HookDeps): Promise<HookOutput> {
  try {
    return await decideHook(payload, deps);
  } catch {
    return { type: 'allow' };
  }
}

async function decideHook(payload: PreToolUsePayload, deps: HookDeps): Promise<HookOutput> {
  if (payload.tool_name !== 'Read') {
    return { type: 'allow' };
  }

  const filePath = payload.tool_input['file_path'];
  if (typeof filePath !== 'string') {
    return { type: 'allow' };
  }

  if (isSecretPath(filePath)) {
    return { type: 'allow' };
  }

  if (!isDocumentationPath(filePath)) {
    return { type: 'allow' };
  }

  const offset = parseLineBound(payload.tool_input['offset']);
  const limit = parseLineBound(payload.tool_input['limit']);
  const config = deps.loadConfig(payload.cwd);

  if (limit != null && limit * AVG_CHARS_PER_LINE < config.threshold.minChars) {
    return { type: 'allow' };
  }

  let stat: FileStat;
  try {
    stat = deps.stat(filePath);
  } catch {
    return { type: 'allow' };
  }
  const estimated = estimateWindowChars(stat.size, offset, limit);
  if (!decideFromCharCount(estimated, config.threshold).delegate) {
    return { type: 'allow' };
  }

  let content: string;
  try {
    content = deps.readWindow(filePath, {
      offset,
      limit,
      maxChars: DEFAULT_MAX_PROVIDER_CHARS,
    });
  } catch {
    return { type: 'allow' };
  }

  if (!decideFromCharCount(content.length, config.threshold).delegate) {
    return { type: 'allow' };
  }

  let summary: string;
  try {
    summary = await deps.summarize(content, DOC_MAP_INSTRUCTION, config);
  } catch {
    return { type: 'allow' };
  }

  const map = summary.trim();
  if (map.length === 0 || map.length >= content.length) {
    return { type: 'allow' };
  }

  return {
    type: 'deny',
    response: denyResponse(content.length, config.threshold.minChars, map),
  };
}
