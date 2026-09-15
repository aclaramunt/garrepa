/**
 * Configures when delegation to a cheap model is worth the round-trip cost.
 * Keep thresholds conservative — delegating tiny content wastes latency.
 */
export interface ThresholdConfig {
  /** Character count at or above which delegation is triggered. */
  minChars: number;
}

/**
 * Default: only content that is already a large dump (~32k chars) is worth
 * a cheap-model round-trip. Adapters must still refuse to delegate source code.
 */
export const DEFAULT_THRESHOLD: ThresholdConfig = { minChars: 32_000 };

/** Cap on characters sent to the cheap-model provider. */
export const DEFAULT_MAX_PROVIDER_CHARS = 200_000;

export interface TokenUsage {
  inputTokens: number;
  outputTokens: number;
}

export interface ProviderResult {
  text: string;
  usage?: TokenUsage;
}

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
  summarize(content: string, instruction: string): Promise<ProviderResult>;
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
  usage?: TokenUsage;
}
