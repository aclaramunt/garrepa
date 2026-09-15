import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  OpenAICompatibleProvider,
  OpenAICompatibleProviderError,
  DEFAULT_MAX_TOKENS,
} from './index';

const DUMMY_KEY = 'sk-test-key';
const BASE_URL = 'https://api.openai.com/v1';
const GROQ_BASE_URL = 'https://api.groq.com/openai/v1';
const MODEL = 'gpt-4o-mini';

function okResponse(content: string, usage?: { prompt_tokens: number; completion_tokens: number }): Response {
  return {
    ok: true,
    status: 200,
    json: async () => ({
      choices: [{ message: { content } }],
      ...(usage ? { usage } : {}),
    }),
  } as unknown as Response;
}

function errorResponse(status: number): Response {
  return {
    ok: false,
    status,
    json: async () => ({
      error: { message: 'API error', code: 'error_code' },
    }),
  } as unknown as Response;
}

// ---------------------------------------------------------------------------
// Unit tests — fetch is always mocked
// ---------------------------------------------------------------------------
describe('OpenAICompatibleProvider', () => {
  let fetchMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    delete process.env['OPENAI_API_KEY'];
    delete process.env['GROQ_API_KEY'];
  });

  // -------------------------------------------------------------------------
  // Construction
  // -------------------------------------------------------------------------
  describe('construction', () => {
    it('throws OpenAICompatibleProviderError when no API key is available', () => {
      expect(
        () => new OpenAICompatibleProvider({ baseUrl: BASE_URL, model: MODEL }),
      ).toThrow(OpenAICompatibleProviderError);
    });

    it('error message explains where to provide the key', () => {
      expect(
        () => new OpenAICompatibleProvider({ baseUrl: BASE_URL, model: MODEL }),
      ).toThrow(/OPENAI_API_KEY/);
    });

    it('throws when baseUrl is missing', () => {
      expect(
        // @ts-expect-error — intentionally omitting required field
        () => new OpenAICompatibleProvider({ model: MODEL, apiKey: DUMMY_KEY }),
      ).toThrow(OpenAICompatibleProviderError);
    });

    it('throws when model is missing', () => {
      expect(
        // @ts-expect-error — intentionally omitting required field
        () => new OpenAICompatibleProvider({ baseUrl: BASE_URL, apiKey: DUMMY_KEY }),
      ).toThrow(OpenAICompatibleProviderError);
    });

    it('accepts explicit apiKey in config', () => {
      expect(
        () =>
          new OpenAICompatibleProvider({
            baseUrl: BASE_URL,
            model: MODEL,
            apiKey: DUMMY_KEY,
          }),
      ).not.toThrow();
    });

    it('reads apiKey from OPENAI_API_KEY env var by default', () => {
      process.env['OPENAI_API_KEY'] = DUMMY_KEY;
      expect(
        () => new OpenAICompatibleProvider({ baseUrl: BASE_URL, model: MODEL }),
      ).not.toThrow();
    });

    it('reads apiKey from a custom env var name when specified', () => {
      process.env['GROQ_API_KEY'] = DUMMY_KEY;
      expect(
        () =>
          new OpenAICompatibleProvider({
            baseUrl: GROQ_BASE_URL,
            model: 'llama3-8b-8192',
            apiKeyEnvVar: 'GROQ_API_KEY',
          }),
      ).not.toThrow();
    });

    it('error message mentions the configured env var name', () => {
      expect(
        () =>
          new OpenAICompatibleProvider({
            baseUrl: GROQ_BASE_URL,
            model: 'llama3-8b-8192',
            apiKeyEnvVar: 'GROQ_API_KEY',
          }),
      ).toThrow(/GROQ_API_KEY/);
    });

    it('explicit apiKey takes precedence over env var', async () => {
      process.env['OPENAI_API_KEY'] = 'env-key';
      fetchMock.mockResolvedValue(okResponse('ok'));
      const provider = new OpenAICompatibleProvider({
        baseUrl: BASE_URL,
        model: MODEL,
        apiKey: 'explicit-key',
      });
      await provider.summarize('content', 'instruction');

      const [, init] = fetchMock.mock.calls[0] as [string, RequestInit];
      const headers = init.headers as Record<string, string>;
      expect(headers['Authorization']).toBe('Bearer explicit-key');
    });
  });

  // -------------------------------------------------------------------------
  // Request shape
  // -------------------------------------------------------------------------
  describe('request shape', () => {
    let provider: OpenAICompatibleProvider;

    beforeEach(() => {
      provider = new OpenAICompatibleProvider({
        baseUrl: BASE_URL,
        model: MODEL,
        apiKey: DUMMY_KEY,
      });
      fetchMock.mockResolvedValue(okResponse('summary'));
    });

    it('POSTs to {baseUrl}/chat/completions', async () => {
      await provider.summarize('content', 'instruction');
      const [url] = fetchMock.mock.calls[0] as [string, RequestInit];
      expect(url).toBe(`${BASE_URL}/chat/completions`);
    });

    it('uses POST method', async () => {
      await provider.summarize('content', 'instruction');
      const [, init] = fetchMock.mock.calls[0] as [string, RequestInit];
      expect(init.method).toBe('POST');
    });

    it('sends Authorization: Bearer header', async () => {
      await provider.summarize('content', 'instruction');
      const [, init] = fetchMock.mock.calls[0] as [string, RequestInit];
      const headers = init.headers as Record<string, string>;
      expect(headers['Authorization']).toBe(`Bearer ${DUMMY_KEY}`);
    });

    it('sends Content-Type: application/json', async () => {
      await provider.summarize('content', 'instruction');
      const [, init] = fetchMock.mock.calls[0] as [string, RequestInit];
      const headers = init.headers as Record<string, string>;
      expect(headers['Content-Type']).toBe('application/json');
    });

    it('sends the configured model in the request body', async () => {
      await provider.summarize('content', 'instruction');
      const [, init] = fetchMock.mock.calls[0] as [string, RequestInit];
      const body = JSON.parse(init.body as string) as { model: string };
      expect(body.model).toBe(MODEL);
    });

    it('sends DEFAULT_MAX_TOKENS when maxTokens not overridden', async () => {
      await provider.summarize('content', 'instruction');
      const [, init] = fetchMock.mock.calls[0] as [string, RequestInit];
      const body = JSON.parse(init.body as string) as { max_tokens: number };
      expect(body.max_tokens).toBe(DEFAULT_MAX_TOKENS);
    });

    it('respects a custom maxTokens', async () => {
      const custom = new OpenAICompatibleProvider({
        baseUrl: BASE_URL,
        model: MODEL,
        apiKey: DUMMY_KEY,
        maxTokens: 256,
      });
      fetchMock.mockResolvedValue(okResponse('ok'));
      await custom.summarize('content', 'instruction');
      const [, init] = fetchMock.mock.calls[0] as [string, RequestInit];
      const body = JSON.parse(init.body as string) as { max_tokens: number };
      expect(body.max_tokens).toBe(256);
    });

    it('composes instruction and content into a single user message', async () => {
      await provider.summarize('the article text', 'summarize briefly');
      const [, init] = fetchMock.mock.calls[0] as [string, RequestInit];
      const body = JSON.parse(init.body as string) as {
        messages: Array<{ role: string; content: string }>;
      };
      expect(body.messages).toHaveLength(1);
      expect(body.messages[0].role).toBe('user');
      expect(body.messages[0].content).toContain('summarize briefly');
      expect(body.messages[0].content).toContain('the article text');
    });

    it('respects a custom baseUrl (e.g. Groq endpoint)', async () => {
      const groq = new OpenAICompatibleProvider({
        baseUrl: GROQ_BASE_URL,
        model: 'llama3-8b-8192',
        apiKey: DUMMY_KEY,
      });
      fetchMock.mockResolvedValue(okResponse('ok'));
      await groq.summarize('content', 'instruction');
      const [url] = fetchMock.mock.calls[0] as [string, RequestInit];
      expect(url).toBe(`${GROQ_BASE_URL}/chat/completions`);
      expect(url).not.toContain('openai.com');
    });
  });

  // -------------------------------------------------------------------------
  // Successful response handling
  // -------------------------------------------------------------------------
  describe('successful response', () => {
    it('returns the text from choices[0].message.content', async () => {
      fetchMock.mockResolvedValue(okResponse('here is the summary'));
      const provider = new OpenAICompatibleProvider({
        baseUrl: BASE_URL,
        model: MODEL,
        apiKey: DUMMY_KEY,
      });
      const result = await provider.summarize('content', 'instruction');
      expect(result.text).toBe('here is the summary');
    });

    it('returns usage when the API response includes it', async () => {
      fetchMock.mockResolvedValue(okResponse('summary', { prompt_tokens: 200, completion_tokens: 80 }));
      const provider = new OpenAICompatibleProvider({
        baseUrl: BASE_URL,
        model: MODEL,
        apiKey: DUMMY_KEY,
      });
      const result = await provider.summarize('content', 'instruction');
      expect(result.usage).toEqual({ inputTokens: 200, outputTokens: 80 });
    });

    it('returns undefined usage when the API response omits it', async () => {
      fetchMock.mockResolvedValue(okResponse('summary'));
      const provider = new OpenAICompatibleProvider({
        baseUrl: BASE_URL,
        model: MODEL,
        apiKey: DUMMY_KEY,
      });
      const result = await provider.summarize('content', 'instruction');
      expect(result.usage).toBeUndefined();
    });
  });

  // -------------------------------------------------------------------------
  // Error handling
  // -------------------------------------------------------------------------
  describe('error handling', () => {
    it('throws OpenAICompatibleProviderError on a non-2xx response', async () => {
      fetchMock.mockResolvedValue(errorResponse(429));
      const provider = new OpenAICompatibleProvider({
        baseUrl: BASE_URL,
        model: MODEL,
        apiKey: DUMMY_KEY,
      });
      await expect(provider.summarize('content', 'instruction')).rejects.toThrow(
        OpenAICompatibleProviderError,
      );
    });

    it('includes the HTTP status code in the error', async () => {
      fetchMock.mockResolvedValue(errorResponse(429));
      const provider = new OpenAICompatibleProvider({
        baseUrl: BASE_URL,
        model: MODEL,
        apiKey: DUMMY_KEY,
      });
      await expect(provider.summarize('content', 'instruction')).rejects.toMatchObject({
        statusCode: 429,
      });
    });

    it('error message contains the HTTP status code', async () => {
      fetchMock.mockResolvedValue(errorResponse(403));
      const provider = new OpenAICompatibleProvider({
        baseUrl: BASE_URL,
        model: MODEL,
        apiKey: DUMMY_KEY,
      });
      await expect(provider.summarize('content', 'instruction')).rejects.toThrow(/403/);
    });

    it('marks API errors with isNetworkError = false', async () => {
      fetchMock.mockResolvedValue(errorResponse(500));
      const provider = new OpenAICompatibleProvider({
        baseUrl: BASE_URL,
        model: MODEL,
        apiKey: DUMMY_KEY,
      });
      await expect(provider.summarize('content', 'instruction')).rejects.toMatchObject({
        isNetworkError: false,
      });
    });

    it('throws OpenAICompatibleProviderError when fetch itself throws (network failure)', async () => {
      fetchMock.mockRejectedValue(new Error('ECONNREFUSED'));
      const provider = new OpenAICompatibleProvider({
        baseUrl: BASE_URL,
        model: MODEL,
        apiKey: DUMMY_KEY,
      });
      await expect(provider.summarize('content', 'instruction')).rejects.toThrow(
        OpenAICompatibleProviderError,
      );
    });

    it('marks network failures with isNetworkError = true', async () => {
      fetchMock.mockRejectedValue(new Error('ECONNREFUSED'));
      const provider = new OpenAICompatibleProvider({
        baseUrl: BASE_URL,
        model: MODEL,
        apiKey: DUMMY_KEY,
      });
      await expect(provider.summarize('content', 'instruction')).rejects.toMatchObject({
        isNetworkError: true,
      });
    });

    it('network error message includes the original error detail', async () => {
      fetchMock.mockRejectedValue(new Error('DNS lookup failed'));
      const provider = new OpenAICompatibleProvider({
        baseUrl: BASE_URL,
        model: MODEL,
        apiKey: DUMMY_KEY,
      });
      await expect(provider.summarize('content', 'instruction')).rejects.toThrow(
        /DNS lookup failed/,
      );
    });
  });
});

// ---------------------------------------------------------------------------
// Integration test — only runs when the env var is set
// ---------------------------------------------------------------------------
describe('OpenAICompatibleProvider (integration)', () => {
  const realKey = process.env['OPENAI_API_KEY'];

  it.skipIf(!realKey)(
    'calls a real OpenAI-compatible API and returns a non-empty string',
    async () => {
      const provider = new OpenAICompatibleProvider({
        baseUrl: 'https://api.openai.com/v1',
        model: 'gpt-4o-mini',
      });
      const result = await provider.summarize(
        'The quick brown fox jumps over the lazy dog. ' +
          'This sentence is commonly used to test typefaces because it contains every letter of the alphabet.',
        'Summarize in five words or fewer.',
      );
      expect(typeof result.text).toBe('string');
      expect(result.text.trim().length).toBeGreaterThan(0);
    },
    30_000,
  );
});
