import type { ThresholdConfig, DelegationDecision } from './types';

/** Pure function — decide from a size already measured (stat / window estimate). */
export function decideFromCharCount(
  charCount: number,
  config: ThresholdConfig,
): DelegationDecision {
  const delegate = charCount >= config.minChars;
  return {
    delegate,
    reason: delegate ? 'above_threshold' : 'below_threshold',
  };
}

/** Pure function — no side effects, safe to call in any context. */
export function decide(content: string, config: ThresholdConfig): DelegationDecision {
  return decideFromCharCount(content.length, config);
}
