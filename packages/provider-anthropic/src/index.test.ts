import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  AnthropicProvider,
  AnthropicProviderError,
  DEFAULT_MODEL,
  DEFAULT_MAX_TOKENS,
} from './index';

const DUMMY_KEY = 'sk-ant-test-key';
const MESSAGES_ENDPOINT = 'https://api.anthropic.com/v1/messages';

function okResponse(text: string, usage?: { input_tokens: number; output_tokens: number }): Response {
  return {
    ok: true,
    status: 200,
    json: async () => ({
      content: [{ type: 'text', text }],
      ...(usage ? { usage } : {}),
    }),
  } as unknown as Response;
}

function errorResponse(status: number): Response {
  return {
    ok: false,
    status,
    json: async () => ({
      error: { type: 'rate_limit_error', message: 'rate limited' },
    }),
  } as unknown as Response;
}

// ---------------------------------------------------------------------------
// Unit tests — fetch is always mocked
// ---------------------------------------------------------------------------
describe('AnthropicProvider', () => {
  let fetchMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    delete process.env['ANTHROPIC_API_KEY'];
  });

  // -------------------------------------------------------------------------
  // Construction
  // -------------------------------------------------------------------------
  describe('construction', () => {
    it('throws AnthropicProviderError when no API key is available', () => {
      expect(() => new AnthropicProvider()).toThrow(AnthropicProviderError);
    });

    it('error message explains where to provide the key', () => {
      expect(() => new AnthropicProvider()).toThrow(/ANTHROPIC_API_KEY/);
    });

    it('accepts an explicit apiKey in config', () => {
      expect(() => new AnthropicProvider({ apiKey: DUMMY_KEY })).not.toThrow();
    });

    it('reads the API key from ANTHROPIC_API_KEY env var', () => {
      process.env['ANTHROPIC_API_KEY'] = DUMMY_KEY;
      expect(() => new AnthropicProvider()).not.toThrow();
    });

    it('explicit apiKey takes precedence over env var', async () => {
      process.env['ANTHROPIC_API_KEY'] = 'env-key';
      fetchMock.mockResolvedValue(okResponse('ok'));
      const provider = new AnthropicProvider({ apiKey: 'explicit-key' });
      await provider.summarize('content', 'instruction');

      const [, init] = fetchMock.mock.calls[0] as [string, RequestInit];
      const headers = init.headers as Record<string, string>;
      expect(headers['x-api-key']).toBe('explicit-key');
    });
  });

  // -------------------------------------------------------------------------
  // Request shape
  // -------------------------------------------------------------------------
  describe('request shape', () => {
    let provider: AnthropicProvider;

    beforeEach(() => {
      provider = new AnthropicProvider({ apiKey: DUMMY_KEY });
      fetchMock.mockResolvedValue(okResponse('summary'));
    });

    it('POSTs to the correct Anthropic Messages endpoint', async () => {
      await provider.summarize('content', 'instruction');
      const [url] = fetchMock.mock.calls[0] as [string, RequestInit];
      expect(url).toBe(MESSAGES_ENDPOINT);
    });

    it('uses POST method', async () => {
      await provider.summarize('content', 'instruction');
      const [, init] = fetchMock.mock.calls[0] as [string, RequestInit];
      expect(init.method).toBe('POST');
    });

    it('sends x-api-key header', async () => {
      await provider.summarize('content', 'instruction');
      const [, init] = fetchMock.mock.calls[0] as [string, RequestInit];
      const headers = init.headers as Record<string, string>;
      expect(headers['x-api-key']).toBe(DUMMY_KEY);
    });

    it('sends anthropic-version header', async () => {
      await provider.summarize('content', 'instruction');
      const [, init] = fetchMock.mock.calls[0] as [string, RequestInit];
      const headers = init.headers as Record<string, string>;
      expect(headers['anthropic-version']).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    });

    it('sends Content-Type: application/json', async () => {
      await provider.summarize('content', 'instruction');
      const [, init] = fetchMock.mock.calls[0] as [string, RequestInit];
      const headers = init.headers as Record<string, string>;
      expect(headers['Content-Type']).toBe('application/json');
    });

    it('sends the default model in the request body', async () => {
      await provider.summarize('content', 'instruction');
      const [, init] = fetchMock.mock.calls[0] as [string, RequestInit];
      const body = JSON.parse(init.body as string) as { model: string };
      expect(body.model).toBe(DEFAULT_MODEL);
    });

    it('uses a custom model when configured', async () => {
      const custom = new AnthropicProvider({
        apiKey: DUMMY_KEY,
        model: 'claude-opus-4-8',
      });
      fetchMock.mockResolvedValue(okResponse('ok'));
      await custom.summarize('content', 'instruction');
      const [, init] = fetchMock.mock.calls[0] as [string, RequestInit];
      const body = JSON.parse(init.body as string) as { model: string };
      expect(body.model).toBe('claude-opus-4-8');
    });

    it('sends DEFAULT_MAX_TOKENS when not overridden', async () => {
      await provider.summarize('content', 'instruction');
      const [, init] = fetchMock.mock.calls[0] as [string, RequestInit];
      const body = JSON.parse(init.body as string) as { max_tokens: number };
      expect(body.max_tokens).toBe(DEFAULT_MAX_TOKENS);
    });

    it('respects a custom maxTokens', async () => {
      const custom = new AnthropicProvider({ apiKey: DUMMY_KEY, maxTokens: 512 });
      fetchMock.mockResolvedValue(okResponse('ok'));
      await custom.summarize('content', 'instruction');
      const [, init] = fetchMock.mock.calls[0] as [string, RequestInit];
      const body = JSON.parse(init.body as string) as { max_tokens: number };
      expect(body.max_tokens).toBe(512);
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
  });

  // -------------------------------------------------------------------------
  // Successful response handling
  // -------------------------------------------------------------------------
  describe('successful response', () => {
    it('returns the text from the first text content block', async () => {
      fetchMock.mockResolvedValue(okResponse('here is the summary'));
      const provider = new AnthropicProvider({ apiKey: DUMMY_KEY });
      const result = await provider.summarize('content', 'instruction');
      expect(result.text).toBe('here is the summary');
    });

    it('returns usage when the API response includes it', async () => {
      fetchMock.mockResolvedValue(okResponse('summary', { input_tokens: 100, output_tokens: 50 }));
      const provider = new AnthropicProvider({ apiKey: DUMMY_KEY });
      const result = await provider.summarize('content', 'instruction');
      expect(result.usage).toEqual({ inputTokens: 100, outputTokens: 50 });
    });

    it('returns undefined usage when the API response omits it', async () => {
      fetchMock.mockResolvedValue(okResponse('summary'));
      const provider = new AnthropicProvider({ apiKey: DUMMY_KEY });
      const result = await provider.summarize('content', 'instruction');
      expect(result.usage).toBeUndefined();
    });
  });

  // -------------------------------------------------------------------------
  // Error handling
  // -------------------------------------------------------------------------
  describe('error handling', () => {
    it('throws AnthropicProviderError on a non-2xx response', async () => {
      fetchMock.mockResolvedValue(errorResponse(429));
      const provider = new AnthropicProvider({ apiKey: DUMMY_KEY });
      await expect(provider.summarize('content', 'instruction')).rejects.toThrow(
        AnthropicProviderError,
      );
    });

    it('includes the HTTP status code in the error', async () => {
      fetchMock.mockResolvedValue(errorResponse(429));
      const provider = new AnthropicProvider({ apiKey: DUMMY_KEY });
      await expect(provider.summarize('content', 'instruction')).rejects.toMatchObject({
        statusCode: 429,
      });
    });

    it('error message contains the HTTP status code', async () => {
      fetchMock.mockResolvedValue(errorResponse(403));
      const provider = new AnthropicProvider({ apiKey: DUMMY_KEY });
      await expect(provider.summarize('content', 'instruction')).rejects.toThrow(/403/);
    });

    it('marks API errors with isNetworkError = false', async () => {
      fetchMock.mockResolvedValue(errorResponse(500));
      const provider = new AnthropicProvider({ apiKey: DUMMY_KEY });
      await expect(provider.summarize('content', 'instruction')).rejects.toMatchObject({
        isNetworkError: false,
      });
    });

    it('throws AnthropicProviderError when fetch itself throws (network failure)', async () => {
      fetchMock.mockRejectedValue(new Error('ECONNREFUSED'));
      const provider = new AnthropicProvider({ apiKey: DUMMY_KEY });
      await expect(provider.summarize('content', 'instruction')).rejects.toThrow(
        AnthropicProviderError,
      );
    });

    it('marks network failures with isNetworkError = true', async () => {
      fetchMock.mockRejectedValue(new Error('ECONNREFUSED'));
      const provider = new AnthropicProvider({ apiKey: DUMMY_KEY });
      await expect(provider.summarize('content', 'instruction')).rejects.toMatchObject({
        isNetworkError: true,
      });
    });

    it('network error message includes the original error detail', async () => {
      fetchMock.mockRejectedValue(new Error('DNS lookup failed'));
      const provider = new AnthropicProvider({ apiKey: DUMMY_KEY });
      await expect(provider.summarize('content', 'instruction')).rejects.toThrow(
        /DNS lookup failed/,
      );
    });
  });
});

// ---------------------------------------------------------------------------
// Integration test — only runs when ANTHROPIC_API_KEY is set in the env
// ---------------------------------------------------------------------------
describe('AnthropicProvider (integration)', () => {
  const realKey = process.env['ANTHROPIC_API_KEY'];

  it.skipIf(!realKey)(
    'calls the real Anthropic API and returns a non-empty string',
    async () => {
      const provider = new AnthropicProvider();
      const result = await provider.summarize(
        'The quick brown fox jumps over the lazy dog. ' +
          'This sentence is commonly used to test typefaces because it contains every letter of the alphabet.',
        'Summarize in five words or fewer.',
      );
      expect(typeof result.text).toBe('string');
      expect(result.text.trim().length).toBeGreaterThan(0);
    },
    30_000, // 30-second timeout for a real API call
  );
});
