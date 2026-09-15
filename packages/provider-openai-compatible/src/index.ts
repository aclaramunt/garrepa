import type { Provider, ProviderResult } from '@garrepa/core';

export const DEFAULT_MAX_TOKENS = 1024;
const CHAT_COMPLETIONS_PATH = '/chat/completions';

export interface OpenAICompatibleProviderConfig {
  /** Base URL of the endpoint, e.g. "https://api.openai.com/v1". Required. */
  baseUrl: string;
  /** Model identifier. Required — no default since sensible values vary by provider. */
  model: string;
  /** API key. Falls back to the env var named by apiKeyEnvVar. */
  apiKey?: string;
  /**
   * Name of the env var to check for the API key when apiKey is not set.
   * Defaults to "OPENAI_API_KEY".
   */
  apiKeyEnvVar?: string;
  /** Maximum tokens in the response. Defaults to DEFAULT_MAX_TOKENS. */
  maxTokens?: number;
}

export class OpenAICompatibleProviderError extends Error {
  readonly statusCode: number | undefined;
  readonly isNetworkError: boolean;

  constructor(message: string, statusCode?: number, isNetworkError = false) {
    super(message);
    this.name = 'OpenAICompatibleProviderError';
    this.statusCode = statusCode;
    this.isNetworkError = isNetworkError;
  }
}

interface ChatCompletionsRequestBody {
  model: string;
  max_tokens: number;
  messages: Array<{ role: 'user'; content: string }>;
}

interface ChatCompletionsResponseBody {
  choices: Array<{ message: { content: string } }>;
  usage?: { prompt_tokens?: number; completion_tokens?: number };
}

async function callChatCompletionsApi(
  endpoint: string,
  apiKey: string,
  body: ChatCompletionsRequestBody,
): Promise<ProviderResult> {
  let response: Response;

  try {
    response = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
      },
      body: JSON.stringify(body),
    });
  } catch (err) {
    const detail = err instanceof Error ? err.message : String(err);
    throw new OpenAICompatibleProviderError(
      `Network error calling chat completions endpoint: ${detail}`,
      undefined,
      true,
    );
  }

  if (!response.ok) {
    throw new OpenAICompatibleProviderError(
      `Chat completions error: HTTP ${response.status}`,
      response.status,
      false,
    );
  }

  const data = (await response.json()) as ChatCompletionsResponseBody;
  const content = data.choices[0]?.message?.content;
  if (!content) {
    throw new OpenAICompatibleProviderError('API returned no text content');
  }

  const usage =
    data.usage?.prompt_tokens != null && data.usage?.completion_tokens != null
      ? { inputTokens: data.usage.prompt_tokens, outputTokens: data.usage.completion_tokens }
      : undefined;

  return { text: content, usage };
}

export class OpenAICompatibleProvider implements Provider {
  private readonly apiKey: string;
  private readonly endpoint: string;
  private readonly model: string;
  private readonly maxTokens: number;

  constructor(config: OpenAICompatibleProviderConfig) {
    if (!config.baseUrl) {
      throw new OpenAICompatibleProviderError(
        'Missing required config: baseUrl must be provided',
      );
    }
    if (!config.model) {
      throw new OpenAICompatibleProviderError(
        'Missing required config: model must be provided',
      );
    }

    const envVarName = config.apiKeyEnvVar ?? 'OPENAI_API_KEY';
    const apiKey = config.apiKey ?? process.env[envVarName];
    if (!apiKey) {
      throw new OpenAICompatibleProviderError(
        `Missing API key: pass apiKey in config or set the ${envVarName} environment variable`,
      );
    }

    this.apiKey = apiKey;
    this.endpoint = `${config.baseUrl}${CHAT_COMPLETIONS_PATH}`;
    this.model = config.model;
    this.maxTokens = config.maxTokens ?? DEFAULT_MAX_TOKENS;
  }

  async summarize(content: string, instruction: string): Promise<ProviderResult> {
    return callChatCompletionsApi(this.endpoint, this.apiKey, {
      model: this.model,
      max_tokens: this.maxTokens,
      messages: [{ role: 'user', content: `${instruction}\n\n${content}` }],
    });
  }
}
