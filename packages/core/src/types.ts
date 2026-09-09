/**
 * Configures when delegation to a cheap model is worth the round-trip cost.
 * Keep thresholds conservative — delegating tiny content wastes latency.
 */
export interface ThresholdConfig {
  /** Character count at or above which delegation is triggered. */
  minChars: number;
}

/** Sensible default: delegate content longer than ~500 words. */
export const DEFAULT_THRESHOLD: ThresholdConfig = { minChars: 2000 };

/**
 * The only contract a cheap model provider must fulfil.
 *
 * Text-in, text-out. No tool-calling, no MCP awareness, no knowledge of
 * external systems. Any fetching (Jira, Notion, files) must happen before
 * this interface is called.
 */
export interface Provider {
  /**
   * Summarizes `content` following `instruction`.
   * Returns plain text — never structured data or tool calls.
   */
  summarize(content: string, instruction: string): Promise<string>;
}

export type DelegationReason = 'above_threshold' | 'below_threshold';

export interface DelegationDecision {
  delegate: boolean;
  reason: DelegationReason;
}

export interface RouterResult {
  output: string;
  /** False when content was below threshold and returned untouched. */
  delegated: boolean;
}
