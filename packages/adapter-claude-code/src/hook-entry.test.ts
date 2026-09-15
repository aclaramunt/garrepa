import { describe, expect, it, vi } from 'vitest';
import { DEFAULT_THRESHOLD } from '@garrepa/core';
import { MAX_STDIN_BYTES } from './constants';
import { dispatchHookPayload } from './hook-entry';
import type { HookEntryDeps } from './hook-entry';

const config = {
  threshold: DEFAULT_THRESHOLD,
  provider: { type: 'anthropic' as const },
};
const large = 'large content '.repeat(4_000);

function deps(): HookEntryDeps {
  return {
    stat: vi.fn(() => ({ size: large.length })),
    readWindow: vi.fn(() => large),
    loadConfig: vi.fn(() => config),
    summarize: vi.fn(async () => 'compressed result'),
  };
}

describe('dispatchHookPayload', () => {
  it('dispatches PreToolUse payloads to the Read handler', async () => {
    const output = await dispatchHookPayload(
      {
        session_id: 'session',
        prompt_id: 'prompt',
        transcript_path: '/tmp/transcript',
        cwd: '/project',
        permission_mode: 'default',
        hook_event_name: 'PreToolUse',
        tool_name: 'Read',
        tool_input: { file_path: '/project/docs/spec.md' },
        tool_use_id: 'tool-1',
      },
      deps(),
    );

    expect(output).toMatchObject({
      hookSpecificOutput: {
        hookEventName: 'PreToolUse',
        permissionDecision: 'deny',
      },
    });
  });

  it('dispatches PostToolUse payloads to the MCP handler', async () => {
    const output = await dispatchHookPayload(
      {
        session_id: 'session',
        transcript_path: '/tmp/transcript',
        cwd: '/project',
        permission_mode: 'default',
        hook_event_name: 'PostToolUse',
        tool_name: 'mcp__notion__fetch',
        tool_input: { id: 'page-1' },
        tool_response: { content: [{ type: 'text', text: large }] },
        tool_use_id: 'tool-2',
      },
      deps(),
    );

    expect(output).toMatchObject({
      hookSpecificOutput: {
        hookEventName: 'PostToolUse',
        updatedToolOutput: {
          content: [{ type: 'text', text: expect.stringContaining('compressed result') }],
        },
      },
    });
  });

  it('dispatches PostToolUse Bash git dumps to the git handler', async () => {
    const output = await dispatchHookPayload(
      {
        session_id: 'session',
        transcript_path: '/tmp/transcript',
        cwd: '/project',
        permission_mode: 'default',
        hook_event_name: 'PostToolUse',
        tool_name: 'Bash',
        tool_input: { command: 'git diff' },
        tool_response: {
          stdout: large,
          stderr: '',
          interrupted: false,
          isImage: false,
        },
        tool_use_id: 'tool-3',
      },
      deps(),
    );

    expect(output).toMatchObject({
      hookSpecificOutput: {
        hookEventName: 'PostToolUse',
        updatedToolOutput: {
          stdout: expect.stringContaining('compressed result'),
          stderr: '',
          interrupted: false,
          isImage: false,
        },
      },
    });
  });

  it('caps hook stdin at 8MB so mixed MCP image payloads can be parsed', () => {
    expect(MAX_STDIN_BYTES).toBe(8_000_000);
  });

  it('returns no output for unknown events and malformed payloads', async () => {
    await expect(dispatchHookPayload(null, deps())).resolves.toBeUndefined();
    await expect(
      dispatchHookPayload({ hook_event_name: 'Notification' }, deps()),
    ).resolves.toBeUndefined();
  });
});
