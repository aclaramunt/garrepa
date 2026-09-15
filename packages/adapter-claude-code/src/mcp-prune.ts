const PLUMBING_KEYS = new Set([
  'requestId',
  'request_id',
  'etag',
  '_etag',
  '_rev',
  'avatar_url',
  'avatarUrl',
  'expiry_time',
  'expiryTime',
  'expires_at',
  'expiresAt',
]);

const MAX_VISITS = 1_000;
const MAX_DEPTH = 8;

function isObjectOrArray(value: unknown): value is object {
  return typeof value === 'object' && value !== null;
}

/**
 * Drops well-known plumbing keys. Does not remove tool handles (`id`, `url`, …).
 * Walk is bounded so a cyclic or huge payload cannot hang the hook.
 */
export function prunePlumbing(value: unknown): unknown {
  const seen = new Map<object, unknown>();
  let visited = 0;

  function walk(input: unknown, depth: number): unknown {
    if (visited++ > MAX_VISITS || depth > MAX_DEPTH) return input;
    if (!isObjectOrArray(input)) return input;

    const cached = seen.get(input);
    if (cached !== undefined) return cached;

    if (Array.isArray(input)) {
      const next: unknown[] = [];
      seen.set(input, next);
      for (const item of input) {
        next.push(walk(item, depth + 1));
      }
      return next;
    }

    const next: Record<string, unknown> = {};
    seen.set(input, next);
    for (const [key, child] of Object.entries(input)) {
      if (PLUMBING_KEYS.has(key)) continue;
      next[key] = walk(child, depth + 1);
    }
    return next;
  }

  return walk(value, 0);
}

/**
 * Compacts JSON text after dropping plumbing. Non-JSON and scalar JSON are left intact.
 */
export function pruneJsonTextIfPossible(text: string): string {
  const trimmed = text.trim();
  if (!trimmed.startsWith('{') && !trimmed.startsWith('[')) return text;
  try {
    const parsed: unknown = JSON.parse(text);
    if (!isObjectOrArray(parsed)) return text;
    return JSON.stringify(prunePlumbing(parsed));
  } catch {
    return text;
  }
}
