import { isSecretPath } from '@garrepa/core';
import { pruneJsonTextIfPossible, prunePlumbing } from './mcp-prune';

interface McpTextBlock {
  type: 'text';
  text: string;
  [key: string]: unknown;
}

interface McpCompressibleResponse {
  content?: Record<string, unknown>[];
  isError?: boolean;
  structuredContent?: unknown;
  [key: string]: unknown;
}

export interface ExtractedMcpText {
  /** Original flatten: threshold and secret checks. */
  text: string;
  /** Plumbing-pruned flatten sent to the cheap model. */
  prunedText: string;
  rebuild(replacement: string): McpCompressibleResponse;
}

const SENSITIVE_TOOL_SEGMENT =
  /(?:^|__|[_-])(?:secret|secrets|credential|credentials|password|passwords|private[_-]?key|api[_-]?key|access[_-]?token)(?:$|__|[_-])/i;

const SECRET_CONTENT_PATTERNS = [
  /-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/,
  /\b(?:sk-ant-|sk-proj-|gh[pousr]_|AKIA)[A-Za-z0-9_-]{12,}/,
  /\b(?:authorization|api[_ -]?key|access[_ -]?token|password)\s*[:=]\s*(?:Bearer\s+)?["']?[A-Za-z0-9_./+=-]{12,}/i,
];

const PATH_LIKE_KEY = /(?:^|_)(?:file_?)?path$|filename$|uri$/i;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isStructuredPayload(value: unknown): value is object {
  return typeof value === 'object' && value !== null;
}

export function isMcpToolName(toolName: string): boolean {
  return toolName.startsWith('mcp__');
}

export function isSensitiveMcpToolName(toolName: string): boolean {
  return SENSITIVE_TOOL_SEGMENT.test(toolName);
}

export function containsLikelySecret(content: string): boolean {
  return SECRET_CONTENT_PATTERNS.some((pattern) => pattern.test(content));
}

/**
 * Checks path-like tool inputs without walking an unbounded or cyclic payload.
 * This catches filesystem MCP reads of known secret paths before delegation.
 */
export function containsSecretPathInput(input: unknown): boolean {
  const seen = new Set<object>();
  let visited = 0;

  function walk(value: unknown, key: string | undefined, depth: number): boolean {
    if (visited++ > 1_000 || depth > 8) return false;
    if (typeof value === 'string') {
      return key != null && PATH_LIKE_KEY.test(key) && isSecretPath(value);
    }
    if (typeof value !== 'object' || value === null || seen.has(value)) return false;
    seen.add(value);
    if (Array.isArray(value)) {
      return value.some((item) => walk(item, key, depth + 1));
    }
    return Object.entries(value).some(([childKey, child]) =>
      walk(child, childKey, depth + 1),
    );
  }

  return walk(input, undefined, 0);
}

function flattenMcp(texts: string[], structured: unknown | undefined): string | null {
  const textPart = texts.join('\n\n');
  if (structured === undefined) return textPart;
  try {
    const json = JSON.stringify(structured);
    return textPart.length === 0
      ? `--- structuredContent ---\n${json}`
      : `${textPart}\n\n--- structuredContent ---\n${json}`;
  } catch {
    return null;
  }
}

function briefingBlock(firstBlock: McpTextBlock | undefined, replacement: string): McpTextBlock {
  return firstBlock == null
    ? { type: 'text', text: replacement }
    : { ...firstBlock, type: 'text', text: replacement };
}

function rebuildContent(
  originalContent: unknown[] | undefined,
  firstBlock: McpTextBlock | undefined,
  replacement: string,
): Record<string, unknown>[] {
  const briefing = briefingBlock(firstBlock, replacement);
  if (originalContent == null || originalContent.length === 0) {
    return [briefing];
  }

  const next: Record<string, unknown>[] = [];
  let inserted = false;
  for (const block of originalContent) {
    if (!isRecord(block)) continue;
    if (block['type'] === 'text') {
      if (!inserted) {
        next.push(briefing);
        inserted = true;
      }
    } else {
      next.push(block);
    }
  }
  if (!inserted) next.push(briefing);
  return next;
}

function rebuildWithoutStructuredContent(
  original: Record<string, unknown>,
  originalContent: unknown[] | undefined,
  firstBlock: McpTextBlock | undefined,
  replacement: string,
): McpCompressibleResponse {
  const rest: Record<string, unknown> = { ...original };
  delete rest['structuredContent'];
  return {
    ...rest,
    content: rebuildContent(originalContent, firstBlock, replacement),
  };
}

function parseStructuredContent(raw: unknown): unknown | undefined {
  if (raw === undefined) return undefined;
  if (isStructuredPayload(raw)) return raw;
  if (typeof raw !== 'string') return undefined;
  try {
    const parsed: unknown = JSON.parse(raw);
    return isStructuredPayload(parsed) ? parsed : undefined;
  } catch {
    return undefined;
  }
}

function resourceText(block: Record<string, unknown>): string | undefined {
  if (block['type'] !== 'resource') return undefined;
  const resource = block['resource'];
  if (!isRecord(resource) || typeof resource['text'] !== 'string') return undefined;
  return resource['text'].length > 0 ? resource['text'] : undefined;
}

/**
 * Accepts text blocks and/or structuredContent, including mixed image/resource
 * payloads. Opaque blocks are kept as-is; only text is flattened for the model.
 * Malformed blocks are skipped. Errors, empty text, and screenshot-only results
 * pass through.
 */
export function extractCompressibleMcp(response: unknown): ExtractedMcpText | null {
  if (Array.isArray(response)) {
    return extractCompressibleMcp({ content: response });
  }
  if (!isRecord(response) || response['isError'] === true) return null;

  const rawContent = response['content'];
  const structured = parseStructuredContent(response['structuredContent']);

  const texts: string[] = [];
  const textBlocks: McpTextBlock[] = [];
  let originalContent: unknown[] | undefined;

  if (typeof rawContent === 'string') {
    if (rawContent.length > 0) texts.push(rawContent);
  } else if (Array.isArray(rawContent)) {
    originalContent = rawContent;
    for (const block of rawContent) {
      if (!isRecord(block) || typeof block['type'] !== 'string') continue;
      if (block['type'] === 'text') {
        if (typeof block['text'] !== 'string') continue;
        textBlocks.push(block as McpTextBlock);
        texts.push(block['text']);
        continue;
      }
      const embedded = resourceText(block);
      if (embedded != null) texts.push(embedded);
    }
  }

  if (texts.length === 0 && structured === undefined) return null;

  const text = flattenMcp(texts, structured);
  if (text == null || text.length === 0) return null;

  const prunedTexts = texts.map(pruneJsonTextIfPossible);
  const prunedStructured =
    structured === undefined ? undefined : prunePlumbing(structured);
  const prunedText = flattenMcp(prunedTexts, prunedStructured);
  if (prunedText == null || prunedText.trim().length === 0) return null;

  const original = response as McpCompressibleResponse;
  const firstBlock = textBlocks[0];
  return {
    text,
    prunedText,
    rebuild: (replacement) =>
      rebuildWithoutStructuredContent(original, originalContent, firstBlock, replacement),
  };
}
