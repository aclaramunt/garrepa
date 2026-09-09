import { describe, it, expect, vi } from 'vitest';
import { handleHook } from './hook';
import type { PreToolUsePayload } from './types';
import { DEFAULT_THRESHOLD } from '@garrepa/core';
import type { GarrepaConfig } from './config';

const DEFAULT_CONFIG: GarrepaConfig = {
  threshold: DEFAULT_THRESHOLD,
  provider: { type: 'anthropic' },
};

const READ_PAYLOAD: PreToolUsePayload = {
  session_id: 'sess_test',
  prompt_id: 'prompt_test',
  transcript_path: '/tmp/transcript.json',
  cwd: '/project',
  permission_mode: 'default',
  hook_event_name: 'PreToolUse',
  tool_name: 'Read',
  tool_input: { file_path: '/project/src/large-file.ts' },
  tool_use_id: 'tu_001',
};

const SMALL_CONTENT = 'const x = 1;'; // well below 2000 chars
const LARGE_CONTENT = 'x'.repeat(3000); // above 2000-char default threshold

describe('handleHook — payload parsing', () => {
  it('extracts file_path from a realistic PreToolUse Read payload', () => {
    const readFile = vi.fn(() => SMALL_CONTENT);
    handleHook(READ_PAYLOAD, { readFile, loadConfig: () => DEFAULT_CONFIG });
    expect(readFile).toHaveBeenCalledWith('/project/src/large-file.ts');
  });

  it('does not touch the filesystem for non-Read tools', () => {
    const readFile = vi.fn(() => '');
    const output = handleHook(
      { ...READ_PAYLOAD, tool_name: 'Bash', tool_input: { command: 'ls' } },
      { readFile, loadConfig: () => DEFAULT_CONFIG },
    );
    expect(output.type).toBe('allow');
    expect(readFile).not.toHaveBeenCalled();
  });
});

describe('handleHook — allow decisions', () => {
  it('allows when file content is below threshold', () => {
    const output = handleHook(READ_PAYLOAD, {
      readFile: () => SMALL_CONTENT,
      loadConfig: () => DEFAULT_CONFIG,
    });
    expect(output.type).toBe('allow');
  });

  it('allows when file_path is missing from tool_input', () => {
    const output = handleHook(
      { ...READ_PAYLOAD, tool_input: {} },
      { readFile: () => LARGE_CONTENT, loadConfig: () => DEFAULT_CONFIG },
    );
    expect(output.type).toBe('allow');
  });

  it('allows when the file cannot be read', () => {
    const output = handleHook(READ_PAYLOAD, {
      readFile: () => { throw new Error('ENOENT: no such file'); },
      loadConfig: () => DEFAULT_CONFIG,
    });
    expect(output.type).toBe('allow');
  });

  it('allows all non-Read tool names without inspecting the file', () => {
    for (const toolName of ['Bash', 'Write', 'Edit', 'Glob', 'Grep']) {
      const readFile = vi.fn(() => LARGE_CONTENT);
      const output = handleHook(
        { ...READ_PAYLOAD, tool_name: toolName },
        { readFile, loadConfig: () => DEFAULT_CONFIG },
      );
      expect(output.type).toBe('allow');
      expect(readFile).not.toHaveBeenCalled();
    }
  });
});

describe('handleHook — deny decisions', () => {
  it('denies when file is above threshold', () => {
    const output = handleHook(READ_PAYLOAD, {
      readFile: () => LARGE_CONTENT,
      loadConfig: () => DEFAULT_CONFIG,
    });
    expect(output.type).toBe('deny');
  });

  it('deny response mentions garrepa summarize in the reason', () => {
    const output = handleHook(READ_PAYLOAD, {
      readFile: () => LARGE_CONTENT,
      loadConfig: () => DEFAULT_CONFIG,
    });
    if (output.type !== 'deny') throw new Error('expected deny');
    expect(output.response.hookSpecificOutput.permissionDecisionReason).toContain(
      'garrepa summarize',
    );
  });

  it('deny additionalContext references the original file path', () => {
    const output = handleHook(READ_PAYLOAD, {
      readFile: () => LARGE_CONTENT,
      loadConfig: () => DEFAULT_CONFIG,
    });
    if (output.type !== 'deny') throw new Error('expected deny');
    expect(output.response.hookSpecificOutput.additionalContext).toContain(
      '/project/src/large-file.ts',
    );
  });

  it('deny response has hookEventName: "PreToolUse"', () => {
    const output = handleHook(READ_PAYLOAD, {
      readFile: () => LARGE_CONTENT,
      loadConfig: () => DEFAULT_CONFIG,
    });
    if (output.type !== 'deny') throw new Error('expected deny');
    expect(output.response.hookSpecificOutput.hookEventName).toBe('PreToolUse');
  });

  it('deny response has permissionDecision: "deny"', () => {
    const output = handleHook(READ_PAYLOAD, {
      readFile: () => LARGE_CONTENT,
      loadConfig: () => DEFAULT_CONFIG,
    });
    if (output.type !== 'deny') throw new Error('expected deny');
    expect(output.response.hookSpecificOutput.permissionDecision).toBe('deny');
  });

  it('deny reason includes actual char count and configured threshold', () => {
    const customConfig: GarrepaConfig = {
      threshold: { minChars: 500 },
      provider: { type: 'anthropic' },
    };
    const content = 'y'.repeat(800);
    const output = handleHook(READ_PAYLOAD, {
      readFile: () => content,
      loadConfig: () => customConfig,
    });
    if (output.type !== 'deny') throw new Error('expected deny');
    const reason = output.response.hookSpecificOutput.permissionDecisionReason ?? '';
    expect(reason).toContain('800'); // char count
    expect(reason).toContain('500'); // threshold
  });
});
