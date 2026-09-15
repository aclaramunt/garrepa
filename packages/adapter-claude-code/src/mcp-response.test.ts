import { describe, expect, it } from 'vitest';
import {
  containsLikelySecret,
  containsSecretPathInput,
  extractCompressibleMcp,
  isMcpToolName,
  isSensitiveMcpToolName,
} from './mcp-response';

describe('MCP tool classification', () => {
  it('recognizes normal and plugin-provided MCP tools', () => {
    expect(isMcpToolName('mcp__notion__fetch')).toBe(true);
    expect(isMcpToolName('mcp__plugin_acme_db__query')).toBe(true);
    expect(isMcpToolName('Read')).toBe(false);
  });

  it('rejects tools whose names indicate secret access', () => {
    expect(isSensitiveMcpToolName('mcp__vault__read_secret')).toBe(true);
    expect(isSensitiveMcpToolName('mcp__auth__get_access_token')).toBe(true);
    expect(isSensitiveMcpToolName('mcp__notion__fetch')).toBe(false);
  });
});

describe('extractCompressibleMcp', () => {
  it('extracts one text block and preserves response and block metadata', () => {
    const original = {
      content: [{ type: 'text', text: 'long page', audience: 'agent' }],
      requestId: 'req-1',
    };
    const extracted = extractCompressibleMcp(original);

    expect(extracted?.text).toBe('long page');
    expect(extracted?.rebuild('summary')).toEqual({
      content: [{ type: 'text', text: 'summary', audience: 'agent' }],
      requestId: 'req-1',
    });
    expect(original.content[0]?.text).toBe('long page');
  });

  it('concatenates multiple text blocks and rebuilds a single block', () => {
    const original = {
      content: [
        { type: 'text', text: 'first', annotations: { audience: ['assistant'] } },
        { type: 'text', text: 'second' },
      ],
      requestId: 'req-2',
    };
    const extracted = extractCompressibleMcp(original);

    expect(extracted?.text).toBe('first\n\nsecond');
    expect(extracted?.rebuild('briefing')).toEqual({
      content: [
        {
          type: 'text',
          text: 'briefing',
          annotations: { audience: ['assistant'] },
        },
      ],
      requestId: 'req-2',
    });
  });

  it('flattens structuredContent and drops it on rebuild', () => {
    const original = {
      content: [{ type: 'text', text: 'intro' }],
      structuredContent: { id: 'page-1', status: 'open' },
      requestId: 'req-3',
    };
    const extracted = extractCompressibleMcp(original);

    expect(extracted?.text).toBe(
      'intro\n\n--- structuredContent ---\n{"id":"page-1","status":"open"}',
    );
    expect(extracted?.rebuild('briefing')).toEqual({
      content: [{ type: 'text', text: 'briefing' }],
      requestId: 'req-3',
    });
  });

  it('extracts structuredContent-only responses', () => {
    const extracted = extractCompressibleMcp({
      structuredContent: { id: 'ds-1', title: 'Specs' },
    });

    expect(extracted?.text).toBe('--- structuredContent ---\n{"id":"ds-1","title":"Specs"}');
    expect(extracted?.rebuild('briefing')).toEqual({
      content: [{ type: 'text', text: 'briefing' }],
    });
  });

  it('prunes plumbing in the provider copy, not the original flatten', () => {
    const extracted = extractCompressibleMcp({
      content: [{ type: 'text', text: '{"id":"abc","etag":"1"}' }],
      structuredContent: { id: 'page-1', avatar_url: 'https://cdn/a.png' },
    });

    expect(extracted?.text).toContain('"etag":"1"');
    expect(extracted?.text).toContain('avatar_url');
    expect(extracted?.prunedText).toBe(
      '{"id":"abc"}\n\n--- structuredContent ---\n{"id":"page-1"}',
    );
  });

  it.each([
    null,
    {},
    { isError: true, content: [{ type: 'text', text: 'failure' }] },
    { content: [] },
    { content: [{ type: 'image', data: 'abc' }] },
    { content: [{ type: 'resource_link', uri: 'file://x' }] },
    { content: [{ type: 'text' }] },
    { content: [null] },
    { content: [{ type: 1, text: 'x' }] },
    { structuredContent: 'not-an-object' },
  ])('passes through unsupported response %#', (response) => {
    expect(extractCompressibleMcp(response)).toBeNull();
  });

  it('extracts a plain-string content payload', () => {
    const original = { content: 'plain string', requestId: 'req-str' };
    const extracted = extractCompressibleMcp(original);

    expect(extracted?.text).toBe('plain string');
    expect(extracted?.rebuild('briefing')).toEqual({
      content: [{ type: 'text', text: 'briefing' }],
      requestId: 'req-str',
    });
  });

  it('extracts a bare content-block array', () => {
    const extracted = extractCompressibleMcp([{ type: 'text', text: 'page body' }]);

    expect(extracted?.text).toBe('page body');
    expect(extracted?.rebuild('briefing')).toEqual({
      content: [{ type: 'text', text: 'briefing' }],
    });
  });

  it('skips malformed siblings and still extracts valid text', () => {
    const image = { type: 'image', data: 'abc' };
    const extracted = extractCompressibleMcp({
      content: [image, null, { type: 'text' }, { type: 'text', text: 'keep me' }],
    });

    expect(extracted?.text).toBe('keep me');
    expect(extracted?.rebuild('briefing')).toEqual({
      content: [image, { type: 'text', text: 'briefing' }],
    });
  });

  it('flattens resource.resource.text and keeps the resource block', () => {
    const resource = {
      type: 'resource',
      resource: { uri: 'file://spec.md', mimeType: 'text/plain', text: 'spec body' },
    };
    const extracted = extractCompressibleMcp({ content: [resource] });

    expect(extracted?.text).toBe('spec body');
    expect(extracted?.rebuild('briefing')).toEqual({
      content: [resource, { type: 'text', text: 'briefing' }],
    });
  });

  it('parses structuredContent JSON strings', () => {
    const extracted = extractCompressibleMcp({
      structuredContent: '{"id":"page-1","title":"Specs"}',
    });

    expect(extracted?.text).toBe(
      '--- structuredContent ---\n{"id":"page-1","title":"Specs"}',
    );
  });

  it('keeps opaque image blocks and collapses text on rebuild', () => {
    const image = { type: 'image', data: 'abc', mimeType: 'image/png' };
    const original = {
      content: [
        image,
        { type: 'text', text: 'first', annotations: { audience: ['assistant'] } },
        { type: 'text', text: 'second' },
      ],
      requestId: 'req-figma',
    };
    const extracted = extractCompressibleMcp(original);

    expect(extracted?.text).toBe('first\n\nsecond');
    expect(extracted?.prunedText).not.toContain('abc');
    const rebuilt = extracted?.rebuild('briefing');
    expect(rebuilt).toEqual({
      content: [
        image,
        {
          type: 'text',
          text: 'briefing',
          annotations: { audience: ['assistant'] },
        },
      ],
      requestId: 'req-figma',
    });
    expect(rebuilt?.content?.[0]).toBe(image);
  });

  it('flattens text plus structuredContent without sending image bytes', () => {
    const image = { type: 'image', data: 'png-bytes' };
    const extracted = extractCompressibleMcp({
      content: [image, { type: 'text', text: 'jsx tree' }],
      structuredContent: { nodeId: '1:2', etag: 'x' },
    });

    expect(extracted?.text).toBe(
      'jsx tree\n\n--- structuredContent ---\n{"nodeId":"1:2","etag":"x"}',
    );
    expect(extracted?.prunedText).toBe(
      'jsx tree\n\n--- structuredContent ---\n{"nodeId":"1:2"}',
    );
    expect(extracted?.prunedText).not.toContain('png-bytes');
    expect(extracted?.rebuild('map')).toEqual({
      content: [image, { type: 'text', text: 'map' }],
    });
  });

  it('passes through cyclic structuredContent that cannot be serialized', () => {
    const structuredContent: { id: string; self?: unknown } = { id: 'loop' };
    structuredContent.self = structuredContent;
    expect(extractCompressibleMcp({ structuredContent })).toBeNull();
  });
});

describe('MCP secret guards', () => {
  it('detects well-known credentials and private keys in text', () => {
    expect(containsLikelySecret('Authorization: Bearer abcdefghijklmnop')).toBe(true);
    expect(containsLikelySecret('-----BEGIN PRIVATE KEY-----')).toBe(true);
    expect(containsLikelySecret('API requirements and authentication overview')).toBe(false);
  });

  it('detects secret filesystem paths in nested tool input', () => {
    expect(containsSecretPathInput({ options: { file_path: '/project/.env.local' } })).toBe(
      true,
    );
    expect(containsSecretPathInput({ path: '/project/docs/spec.md' })).toBe(false);
  });
});
