import { DEFAULT_MAX_PROVIDER_CHARS } from './types';

/**
 * Caps text sent to the cheap-model provider. Oversized content keeps a head
 * and a tail so the model still sees structure at both ends.
 */
export function capForProvider(
  content: string,
  maxChars: number = DEFAULT_MAX_PROVIDER_CHARS,
): string {
  if (content.length <= maxChars) return content;
  const markerBudget = 80;
  const keep = Math.max(1, Math.floor((maxChars - markerBudget) / 2));
  const omitted = content.length - keep * 2;
  return (
    content.slice(0, keep) +
    `\n\n[...truncated ${omitted} chars...]\n\n` +
    content.slice(-keep)
  );
}
