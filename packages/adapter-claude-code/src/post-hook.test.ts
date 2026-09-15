import { describe, expect, it, vi } from 'vitest';
import { DEFAULT_THRESHOLD } from '@garrepa/core';
import type { GarrepaConfig } from './config';
import { SUMMARY_MAX_CHARS } from './constants';
import { handlePostToolUse } from './post-hook';
import type { PostHookDeps } from './post-hook';
import type { PostToolUsePayload } from './types';

const DEFAULT_CONFIG: GarrepaConfig = {
  threshold: DEFAULT_THRESHOLD,
  provider: { type: 'anthropic' },
};
const LARGE_TEXT = 'MCP document paragraph. '.repeat(2_000);

function payload(
  overrides: Partial<PostToolUsePayload> = {},
): PostToolUsePayload {
  return {
    session_id: 'sess_test',
    transcript_path: '/tmp/transcript.json',
    cwd: '/project',
    permission_mode: 'default',
    hook_event_name: 'PostToolUse',
    tool_name: 'mcp__notion__fetch',
    tool_input: { page_id: 'page-1' },
    tool_response: {
      content: [{ type: 'text', text: LARGE_TEXT, annotations: { audience: ['assistant'] } }],
      requestId: 'req-1',
    },
    tool_use_id: 'tu_001',
    ...overrides,
  };
}

function deps(overrides: Partial<PostHookDeps> = {}): PostHookDeps {
  return {
    loadConfig: vi.fn(() => DEFAULT_CONFIG),
    summarize: vi.fn(async () => 'Purpose: project requirements\n- Keep identifier ABC-123'),
    ...overrides,
  };
}

describe('handlePostToolUse', () => {
  it('replaces a large simple MCP text response and preserves its shape', async () => {
    const output = await handlePostToolUse(payload(), deps());

    expect(output.type).toBe('replace');
    if (output.type !== 'replace') throw new Error('expected replacement');
    expect(output.response.hookSpecificOutput.hookEventName).toBe('PostToolUse');
    expect(output.response.hookSpecificOutput.updatedToolOutput).toMatchObject({
      content: [
        {
          type: 'text',
          annotations: { audience: ['assistant'] },
          text: expect.stringContaining('Purpose: project requirements'),
        },
      ],
      requestId: 'req-1',
    });
  });

  it('passes through content below the configured threshold', async () => {
    const d = deps();
    const output = await handlePostToolUse(
      payload({ tool_response: { content: [{ type: 'text', text: 'small' }] } }),
      d,
    );

    expect(output.type).toBe('pass');
    expect(d.summarize).not.toHaveBeenCalled();
  });

  it.each([
    ['a built-in tool', { tool_name: 'Read' }],
    ['an error response', { tool_response: { isError: true, content: [{ type: 'text', text: LARGE_TEXT }] } }],
    ['a sensitive tool', { tool_name: 'mcp__vault__read_secret' }],
    ['a secret path input', { tool_input: { file_path: '/project/.env' } }],
    ['secret-like content', {
      tool_response: {
        content: [
          { type: 'text', text: `${LARGE_TEXT}\nAuthorization: Bearer abcdefghijklmnop` },
        ],
      },
    }],
  ] satisfies Array<[string, Partial<PostToolUsePayload>]>)(
    'passes through %s',
    async (_label, overrides) => {
      const d = deps();
      const output = await handlePostToolUse(payload(overrides), d);
      expect(output.type).toBe('pass');
      expect(d.summarize).not.toHaveBeenCalled();
    },
  );

  it('honors an exact configured tool exclusion', async () => {
    const d = deps({
      loadConfig: vi.fn(() => ({
        ...DEFAULT_CONFIG,
        mcp: { excludeTools: ['mcp__notion__fetch'] },
      })),
    });
    const output = await handlePostToolUse(payload(), d);

    expect(output.type).toBe('pass');
    expect(d.summarize).not.toHaveBeenCalled();
  });

  it('passes through provider failures, empty summaries, and summaries without savings', async () => {
    const failing = deps({ summarize: vi.fn(async () => { throw new Error('offline'); }) });
    const empty = deps({ summarize: vi.fn(async () => '   ') });
    const longer = deps({ summarize: vi.fn(async () => LARGE_TEXT + LARGE_TEXT) });

    await expect(handlePostToolUse(payload(), failing)).resolves.toEqual({ type: 'pass' });
    await expect(handlePostToolUse(payload(), empty)).resolves.toEqual({ type: 'pass' });
    await expect(handlePostToolUse(payload(), longer)).resolves.toEqual({ type: 'pass' });
  });

  it('replaces multiple large text blocks with a single briefing', async () => {
    const d = deps();
    const output = await handlePostToolUse(
      payload({
        tool_response: {
          content: [
            { type: 'text', text: LARGE_TEXT, annotations: { audience: ['assistant'] } },
            { type: 'text', text: LARGE_TEXT },
          ],
          requestId: 'req-multi',
        },
      }),
      d,
    );

    expect(output.type).toBe('replace');
    if (output.type !== 'replace') throw new Error('expected replacement');
    expect(output.response.hookSpecificOutput.updatedToolOutput).toEqual({
      content: [
        {
          type: 'text',
          annotations: { audience: ['assistant'] },
          text: expect.stringContaining('Purpose: project requirements'),
        },
      ],
      requestId: 'req-multi',
    });
    expect(d.summarize).toHaveBeenCalledWith(
      `${LARGE_TEXT}\n\n${LARGE_TEXT}`,
      expect.any(String),
      DEFAULT_CONFIG,
    );
  });

  it('replaces large structuredContent and drops it from the rebuilt output', async () => {
    const structuredContent = {
      id: 'page-1',
      body: LARGE_TEXT,
      avatar_url: 'https://cdn.example/avatar.png',
    };
    const d = deps();
    const output = await handlePostToolUse(
      payload({
        tool_response: { structuredContent, requestId: 'req-sc' },
      }),
      d,
    );

    expect(output.type).toBe('replace');
    if (output.type !== 'replace') throw new Error('expected replacement');
    expect(output.response.hookSpecificOutput.updatedToolOutput).toEqual({
      content: [
        {
          type: 'text',
          text: expect.stringContaining('Purpose: project requirements'),
        },
      ],
      requestId: 'req-sc',
    });
    const sent = (d.summarize as ReturnType<typeof vi.fn>).mock.calls[0]?.[0] as string;
    expect(sent).toContain('"id":"page-1"');
    expect(sent).not.toContain('avatar_url');
  });

  it('replaces mixed Figma text while leaving the screenshot block intact', async () => {
    const image = { type: 'image', data: 'iVBORw0KGgo', mimeType: 'image/png' };
    const d = deps();
    const output = await handlePostToolUse(
      payload({
        tool_name: 'mcp__plugin_figma_figma__get_design_context',
        tool_response: {
          content: [
            image,
            { type: 'text', text: LARGE_TEXT, annotations: { audience: ['assistant'] } },
          ],
        },
      }),
      d,
    );

    expect(output.type).toBe('replace');
    if (output.type !== 'replace') throw new Error('expected replacement');
    expect(output.response.hookSpecificOutput.updatedToolOutput).toEqual({
      content: [
        image,
        {
          type: 'text',
          annotations: { audience: ['assistant'] },
          text: expect.stringContaining('Purpose: project requirements'),
        },
      ],
    });
    expect(d.summarize).toHaveBeenCalledWith(
      LARGE_TEXT,
      expect.stringContaining('Figma node IDs'),
      DEFAULT_CONFIG,
    );
    const sent = (d.summarize as ReturnType<typeof vi.fn>).mock.calls[0]?.[0] as string;
    expect(sent).not.toContain('iVBORw0KGgo');
  });

  it('passes through mixed content below the text threshold', async () => {
    const d = deps();
    const output = await handlePostToolUse(
      payload({
        tool_response: {
          content: [
            { type: 'image', data: 'abc' },
            { type: 'text', text: 'small' },
          ],
        },
      }),
      d,
    );

    expect(output.type).toBe('pass');
    expect(d.summarize).not.toHaveBeenCalled();
  });

  it('passes through screenshot-only MCP results', async () => {
    const d = deps();
    const output = await handlePostToolUse(
      payload({
        tool_response: { content: [{ type: 'image', data: LARGE_TEXT }] },
      }),
      d,
    );

    expect(output.type).toBe('pass');
    expect(d.summarize).not.toHaveBeenCalled();
  });

  it('replaces large text next to a malformed sibling and keeps the screenshot', async () => {
    const image = { type: 'image', data: 'abc' };
    const d = deps();
    const output = await handlePostToolUse(
      payload({
        tool_response: {
          content: [image, null, { type: 'text', text: LARGE_TEXT }],
        },
      }),
      d,
    );

    expect(output.type).toBe('replace');
    if (output.type !== 'replace') throw new Error('expected replacement');
    expect(output.response.hookSpecificOutput.updatedToolOutput).toEqual({
      content: [
        image,
        {
          type: 'text',
          text: expect.stringContaining('Purpose: project requirements'),
        },
      ],
    });
  });

  it('replaces large resource.resource.text and keeps the resource block', async () => {
    const resource = {
      type: 'resource',
      resource: { uri: 'file://spec.md', mimeType: 'text/plain', text: LARGE_TEXT },
    };
    const d = deps();
    const output = await handlePostToolUse(
      payload({ tool_response: { content: [resource] } }),
      d,
    );

    expect(output.type).toBe('replace');
    if (output.type !== 'replace') throw new Error('expected replacement');
    expect(output.response.hookSpecificOutput.updatedToolOutput).toEqual({
      content: [
        resource,
        {
          type: 'text',
          text: expect.stringContaining('Purpose: project requirements'),
        },
      ],
    });
    expect(d.summarize).toHaveBeenCalledWith(LARGE_TEXT, expect.any(String), DEFAULT_CONFIG);
  });

  it('passes through mixed content when the text looks secret', async () => {
    const d = deps();
    const output = await handlePostToolUse(
      payload({
        tool_response: {
          content: [
            { type: 'image', data: 'abc' },
            { type: 'text', text: `${LARGE_TEXT}\nAuthorization: Bearer abcdefghijklmnop` },
          ],
        },
      }),
      d,
    );

    expect(output.type).toBe('pass');
    expect(d.summarize).not.toHaveBeenCalled();
  });

  it('passes through a resource_link block without calling the provider', async () => {
    const d = deps();
    const output = await handlePostToolUse(
      payload({
        tool_response: {
          content: [{ type: 'resource_link', uri: 'file://spec.md' }],
        },
      }),
      d,
    );

    expect(output.type).toBe('pass');
    expect(d.summarize).not.toHaveBeenCalled();
  });

  it('passes through secret-like structuredContent', async () => {
    const d = deps();
    const output = await handlePostToolUse(
      payload({
        tool_response: {
          structuredContent: {
            id: 'page-1',
            body: LARGE_TEXT,
            token: 'sk-ant-abcdefghijklmnop',
          },
        },
      }),
      d,
    );

    expect(output.type).toBe('pass');
    expect(d.summarize).not.toHaveBeenCalled();
  });

  it('caps the complete replacement text', async () => {
    const output = await handlePostToolUse(
      payload(),
      deps({ summarize: vi.fn(async () => 'x'.repeat(SUMMARY_MAX_CHARS * 2)) }),
    );

    expect(output.type).toBe('replace');
    if (output.type !== 'replace') throw new Error('expected replacement');
    const updated = output.response.hookSpecificOutput.updatedToolOutput as {
      content: Array<{ text: string }>;
    };
    expect(updated.content[0]?.text).toHaveLength(SUMMARY_MAX_CHARS);
  });
});

describe('handlePostToolUse — git dumps', () => {
  function gitPayload(overrides: Partial<PostToolUsePayload> = {}): PostToolUsePayload {
    return payload({
      tool_name: 'Bash',
      tool_input: { command: 'git diff' },
      tool_response: {
        stdout: LARGE_TEXT,
        stderr: '',
        interrupted: false,
        isImage: false,
      },
      ...overrides,
    });
  }

  it('replaces a large git diff stdout and keeps the Bash output shape', async () => {
    const d = deps();
    const output = await handlePostToolUse(gitPayload(), d);

    expect(output.type).toBe('replace');
    if (output.type !== 'replace') throw new Error('expected replacement');
    expect(output.response.hookSpecificOutput.updatedToolOutput).toEqual({
      stdout: expect.stringContaining('Purpose: project requirements'),
      stderr: '',
      interrupted: false,
      isImage: false,
    });
    expect(d.summarize).toHaveBeenCalledWith(
      LARGE_TEXT,
      expect.stringContaining('Do not draft a git commit message'),
      DEFAULT_CONFIG,
    );
  });

  it('passes through git commit, pipes, secret paths, and screenshot Bash results', async () => {
    const d = deps();
    const cases: Array<Partial<PostToolUsePayload>> = [
      { tool_input: { command: 'git commit -m msg' } },
      { tool_input: { command: 'git diff | head' } },
      { tool_input: { command: 'git diff .env' } },
      {
        tool_response: {
          stdout: LARGE_TEXT,
          stderr: '',
          interrupted: false,
          isImage: true,
        },
      },
    ];

    for (const overrides of cases) {
      const output = await handlePostToolUse(gitPayload(overrides), d);
      expect(output.type).toBe('pass');
    }
    expect(d.summarize).not.toHaveBeenCalled();
  });

  it('passes through git stdout that looks like a secret', async () => {
    const d = deps();
    const output = await handlePostToolUse(
      gitPayload({
        tool_response: {
          stdout: `${LARGE_TEXT}\nAuthorization: Bearer abcdefghijklmnop`,
          stderr: '',
          interrupted: false,
          isImage: false,
        },
      }),
      d,
    );

    expect(output.type).toBe('pass');
    expect(d.summarize).not.toHaveBeenCalled();
  });
});
