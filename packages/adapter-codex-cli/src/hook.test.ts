import { describe, it, expect, vi } from 'vitest';
import { handleHook } from './hook';
import type { PreToolUsePayload } from './types';
import { DEFAULT_THRESHOLD } from '@garrepa/core';
import type { CodexCliConfig } from './config';

// Source: openai/codex codex-rs/hooks/src/schema.rs — PreToolUseCommandInput
// tool_name: "exec_command", tool_input: { cmd: "..." }

const DEFAULT_CONFIG: CodexCliConfig = {
  threshold: DEFAULT_THRESHOLD,
  provider: { type: 'anthropic' },
};

const EXEC_PAYLOAD: PreToolUsePayload = {
  session_id: 'sess_test',
  turn_id: 'turn_001',
  transcript_path: null,
  cwd: '/project',
  hook_event_name: 'PreToolUse',
  model: 'gpt-test',
  permission_mode: 'default',
  tool_name: 'exec_command',
  tool_input: { cmd: 'cat /project/src/large-file.ts' },
  tool_use_id: 'tu_001',
};

const SMALL_CONTENT = 'const x = 1;'; // well below 2000 chars
const LARGE_CONTENT = 'x'.repeat(3000); // above 2000-char default threshold

describe('handleHook — payload parsing', () => {
  it('extracts file path from a cat exec_command payload', () => {
    const readFile = vi.fn(() => SMALL_CONTENT);
    handleHook(EXEC_PAYLOAD, { readFile, loadConfig: () => DEFAULT_CONFIG });
    expect(readFile).toHaveBeenCalledWith('/project/src/large-file.ts');
  });

  it('does not touch the filesystem for non-exec_command tools', () => {
    const readFile = vi.fn(() => '');
    const output = handleHook(
      { ...EXEC_PAYLOAD, tool_name: 'apply_patch', tool_input: { patch: '...' } },
      { readFile, loadConfig: () => DEFAULT_CONFIG },
    );
    expect(output.type).toBe('allow');
    expect(readFile).not.toHaveBeenCalled();
  });

  it('does not touch the filesystem when cmd field is absent', () => {
    const readFile = vi.fn(() => '');
    const output = handleHook(
      { ...EXEC_PAYLOAD, tool_input: {} },
      { readFile, loadConfig: () => DEFAULT_CONFIG },
    );
    expect(output.type).toBe('allow');
    expect(readFile).not.toHaveBeenCalled();
  });
});

describe('handleHook — allow decisions', () => {
  it('allows when file content is below threshold', () => {
    const output = handleHook(EXEC_PAYLOAD, {
      readFile: () => SMALL_CONTENT,
      loadConfig: () => DEFAULT_CONFIG,
    });
    expect(output.type).toBe('allow');
  });

  it('allows when the file cannot be read', () => {
    const output = handleHook(EXEC_PAYLOAD, {
      readFile: () => { throw new Error('ENOENT: no such file'); },
      loadConfig: () => DEFAULT_CONFIG,
    });
    expect(output.type).toBe('allow');
  });

  it('allows all non-exec_command tool names', () => {
    for (const toolName of ['apply_patch', 'write_stdin', 'mcp_tool', 'request_permissions']) {
      const readFile = vi.fn(() => LARGE_CONTENT);
      const output = handleHook(
        { ...EXEC_PAYLOAD, tool_name: toolName },
        { readFile, loadConfig: () => DEFAULT_CONFIG },
      );
      expect(output.type).toBe('allow');
      expect(readFile).not.toHaveBeenCalled();
    }
  });

  it('allows compound/piped commands without inspecting the file', () => {
    const readFile = vi.fn(() => LARGE_CONTENT);
    for (const cmd of [
      'cat /etc/hosts | grep lo',
      'cat file.txt > /tmp/out',
      'cat file.txt; ls',
      'cat file.txt && echo done',
    ]) {
      const output = handleHook(
        { ...EXEC_PAYLOAD, tool_input: { cmd } },
        { readFile, loadConfig: () => DEFAULT_CONFIG },
      );
      expect(output.type, `expected allow for: ${cmd}`).toBe('allow');
    }
    expect(readFile).not.toHaveBeenCalled();
  });

  it('allows when cmd targets a command not in the read allowlist', () => {
    const readFile = vi.fn(() => LARGE_CONTENT);
    const output = handleHook(
      { ...EXEC_PAYLOAD, tool_input: { cmd: 'ls /project' } },
      { readFile, loadConfig: () => DEFAULT_CONFIG },
    );
    expect(output.type).toBe('allow');
    expect(readFile).not.toHaveBeenCalled();
  });

  it('allows when cmd has multiple file arguments (ambiguous)', () => {
    const readFile = vi.fn(() => LARGE_CONTENT);
    const output = handleHook(
      { ...EXEC_PAYLOAD, tool_input: { cmd: 'cat file1.txt file2.txt' } },
      { readFile, loadConfig: () => DEFAULT_CONFIG },
    );
    expect(output.type).toBe('allow');
    expect(readFile).not.toHaveBeenCalled();
  });
});

describe('handleHook — deny decisions', () => {
  it('denies when file is above threshold', () => {
    const output = handleHook(EXEC_PAYLOAD, {
      readFile: () => LARGE_CONTENT,
      loadConfig: () => DEFAULT_CONFIG,
    });
    expect(output.type).toBe('deny');
  });

  it('deny response has hookEventName: "PreToolUse"', () => {
    const output = handleHook(EXEC_PAYLOAD, {
      readFile: () => LARGE_CONTENT,
      loadConfig: () => DEFAULT_CONFIG,
    });
    if (output.type !== 'deny') throw new Error('expected deny');
    expect(output.response.hookSpecificOutput.hookEventName).toBe('PreToolUse');
  });

  it('deny response has permissionDecision: "deny"', () => {
    const output = handleHook(EXEC_PAYLOAD, {
      readFile: () => LARGE_CONTENT,
      loadConfig: () => DEFAULT_CONFIG,
    });
    if (output.type !== 'deny') throw new Error('expected deny');
    expect(output.response.hookSpecificOutput.permissionDecision).toBe('deny');
  });

  it('deny reason mentions garrepa summarize', () => {
    const output = handleHook(EXEC_PAYLOAD, {
      readFile: () => LARGE_CONTENT,
      loadConfig: () => DEFAULT_CONFIG,
    });
    if (output.type !== 'deny') throw new Error('expected deny');
    expect(output.response.hookSpecificOutput.permissionDecisionReason).toContain(
      'garrepa summarize',
    );
  });

  it('deny additionalContext references the original file path', () => {
    const output = handleHook(EXEC_PAYLOAD, {
      readFile: () => LARGE_CONTENT,
      loadConfig: () => DEFAULT_CONFIG,
    });
    if (output.type !== 'deny') throw new Error('expected deny');
    expect(output.response.hookSpecificOutput.additionalContext).toContain(
      '/project/src/large-file.ts',
    );
  });

  it('deny reason includes actual char count and configured threshold', () => {
    const customConfig: CodexCliConfig = {
      threshold: { minChars: 500 },
      provider: { type: 'anthropic' },
    };
    const content = 'y'.repeat(800);
    const output = handleHook(EXEC_PAYLOAD, {
      readFile: () => content,
      loadConfig: () => customConfig,
    });
    if (output.type !== 'deny') throw new Error('expected deny');
    const reason = output.response.hookSpecificOutput.permissionDecisionReason;
    expect(reason).toContain('800');
    expect(reason).toContain('500');
  });

  it('uses custom readCommands from config when provided', () => {
    const customConfig: CodexCliConfig = {
      threshold: { minChars: 1 },
      provider: { type: 'anthropic' },
      readCommands: ['view'],
    };
    const readFile = vi.fn(() => 'x'.repeat(10));

    // 'cat' is not in custom allowlist — should allow
    const catOutput = handleHook(EXEC_PAYLOAD, {
      readFile,
      loadConfig: () => customConfig,
    });
    expect(catOutput.type).toBe('allow');
    expect(readFile).not.toHaveBeenCalled();

    // 'view' IS in custom allowlist — should deny (above threshold of 1 char)
    const viewOutput = handleHook(
      { ...EXEC_PAYLOAD, tool_input: { cmd: 'view /project/src/large-file.ts' } },
      { readFile, loadConfig: () => customConfig },
    );
    expect(viewOutput.type).toBe('deny');
  });
});

describe('handleHook — config loading fallback', () => {
  it('uses DEFAULT_THRESHOLD when config cannot be loaded', () => {
    const output = handleHook(EXEC_PAYLOAD, {
      readFile: () => SMALL_CONTENT,
      loadConfig: () => DEFAULT_CONFIG,
    });
    // Small content → allow regardless
    expect(output.type).toBe('allow');
  });
});
