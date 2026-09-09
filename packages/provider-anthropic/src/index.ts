import type { Provider } from '@garrepa/core';

export const DEFAULT_MODEL = 'claude-haiku-4-5';
export const DEFAULT_MAX_TOKENS = 1024;

const MESSAGES_ENDPOINT = 'https://api.anthropic.com/v1/messages';
const ANTHROPIC_VERSION = '2023-06-01';

export interface AnthropicProviderConfig {
  /** Anthropic API key. Falls back to ANTHROPIC_API_KEY env var. */
  apiKey?: string;
  /** Model to use. Defaults to DEFAULT_MODEL (claude-haiku-4-5). */
  model?: string;
  /** Maximum tokens in the response. Defaults to DEFAULT_MAX_TOKENS. */
  maxTokens?: number;
}

export class AnthropicProviderError extends Error {
  /** HTTP status code from the API, if available. */
  readonly statusCode: number | undefined;
  /** True when the error was a network/transport failure (fetch threw). */
  readonly isNetworkError: boolean;

  constructor(message: string, statusCode?: number, isNetworkError = false) {
    super(message);
    this.name = 'AnthropicProviderError';
    this.statusCode = statusCode;
    this.isNetworkError = isNetworkError;
  }
}

interface MessagesRequestBody {
  model: string;
  max_tokens: number;
  messages: Array<{ role: 'user'; content: string }>;
}

interface MessagesResponseBody {
  content: Array<{ type: string; text?: string }>;
}

// Isolated HTTP call — mock globalThis.fetch in tests to replace this behaviour.
async function callMessagesApi(
  apiKey: string,
  body: MessagesRequestBody,
): Promise<string> {
  let response: Response;

  try {
    response = await fetch(MESSAGES_ENDPOINT, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': ANTHROPIC_VERSION,
      },
      body: JSON.stringify(body),
    });
  } catch (err) {
    const detail = err instanceof Error ? err.message : String(err);
    throw new AnthropicProviderError(
      `Network error calling Anthropic API: ${detail}`,
      undefined,
      true,
    );
  }

  if (!response.ok) {
    throw new AnthropicProviderError(
      `Anthropic API error: HTTP ${response.status}`,
      response.status,
      false,
    );
  }

  const data = (await response.json()) as MessagesResponseBody;
  const textBlock = data.content.find((b) => b.type === 'text');
  if (!textBlock?.text) {
    throw new AnthropicProviderError('Anthropic API returned no text content');
  }
  return textBlock.text;
}

export class AnthropicProvider implements Provider {
  private readonly apiKey: string;
  private readonly model: string;
  private readonly maxTokens: number;

  constructor(config: AnthropicProviderConfig = {}) {
    const apiKey = config.apiKey ?? process.env['ANTHROPIC_API_KEY'];
    if (!apiKey) {
      throw new AnthropicProviderError(
        'Missing API key: pass apiKey in config or set the ANTHROPIC_API_KEY environment variable',
      );
    }
    this.apiKey = apiKey;
    this.model = config.model ?? DEFAULT_MODEL;
    this.maxTokens = config.maxTokens ?? DEFAULT_MAX_TOKENS;
  }

  async summarize(content: string, instruction: string): Promise<string> {
    return callMessagesApi(this.apiKey, {
      model: this.model,
      max_tokens: this.maxTokens,
      messages: [{ role: 'user', content: `${instruction}\n\n${content}` }],
    });
  }
}
