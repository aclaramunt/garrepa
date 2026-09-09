import type { ThresholdConfig, DelegationDecision } from './types';

/** Pure function — no side effects, safe to call in any context. */
export function decide(content: string, config: ThresholdConfig): DelegationDecision {
  const delegate = content.length >= config.minChars;
  return {
    delegate,
    reason: delegate ? 'above_threshold' : 'below_threshold',
  };
}
