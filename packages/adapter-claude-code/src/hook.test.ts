import { describe, it, expect, vi } from 'vitest';
import { handleHook } from './hook';
import type { HookDeps } from './hook';
import type { PreToolUsePayload } from './types';
import { DEFAULT_THRESHOLD } from '@garrepa/core';
import type { GarrepaConfig } from './config';

const DEFAULT_CONFIG: GarrepaConfig = {
  threshold: DEFAULT_THRESHOLD,
  provider: { type: 'anthropic' },
};

function readPayload(filePath: string, extra: Record<string, unknown> = {}): PreToolUsePayload {
  return {
    session_id: 'sess_test',
    prompt_id: 'prompt_test',
    transcript_path: '/tmp/transcript.json',
    cwd: '/project',
    permission_mode: 'default',
    hook_event_name: 'PreToolUse',
    tool_name: 'Read',
    tool_input: { file_path: filePath, ...extra },
    tool_use_id: 'tu_001',
  };
}

const HUGE_DOC = '# Title\n\n' + 'paragraph '.repeat(20_000);
const HUGE_CODE = 'export const x = 1;\n'.repeat(20_000);

function deps(overrides: Partial<HookDeps> = {}): HookDeps {
  return {
    stat: vi.fn(() => ({ size: HUGE_DOC.length })),
    readWindow: vi.fn(() => HUGE_DOC),
    loadConfig: vi.fn(() => DEFAULT_CONFIG),
    summarize: vi.fn(async () => 'DOC MAP: purpose and sections'),
    ...overrides,
  };
}

describe('handleHook — never summarize code', () => {
  it('allows a huge TypeScript file without stating or reading it', async () => {
    const d = deps();
    const output = await handleHook(readPayload('/project/src/index.ts'), d);
    expect(output.type).toBe('allow');
    expect(d.stat).not.toHaveBeenCalled();
    expect(d.readWindow).not.toHaveBeenCalled();
    expect(d.summarize).not.toHaveBeenCalled();
  });

  it('allows huge python, json, and lockfiles without reading', async () => {
    for (const filePath of [
      '/project/app.py',
      '/project/package.json',
      '/project/package-lock.json',
      '/project/pnpm-lock.yaml',
    ]) {
      const d = deps({ stat: vi.fn(() => ({ size: HUGE_CODE.length })), readWindow: vi.fn(() => HUGE_CODE) });
      const output = await handleHook(readPayload(filePath), d);
      expect(output.type).toBe('allow');
      expect(d.readWindow).not.toHaveBeenCalled();
      expect(d.summarize).not.toHaveBeenCalled();
    }
  });
});

describe('handleHook — documentation', () => {
  it('denies a huge markdown file and injects the map, without mentioning garrepa summarize', async () => {
    const output = await handleHook(readPayload('/project/docs/SPEC.md'), deps());
    expect(output.type).toBe('deny');
    if (output.type !== 'deny') throw new Error('expected deny');
    expect(output.response.hookSpecificOutput.permissionDecision).toBe('deny');
    expect(output.response.hookSpecificOutput.additionalContext).toContain('DOC MAP');
    expect(output.response.hookSpecificOutput.permissionDecisionReason).not.toMatch(/garrepa summarize/);
    expect(output.response.hookSpecificOutput.additionalContext).not.toMatch(/garrepa summarize/);
  });

  it('allows markdown below the default threshold', async () => {
    const d = deps({
      stat: vi.fn(() => ({ size: 100 })),
      readWindow: vi.fn(() => '# short'),
    });
    const output = await handleHook(readPayload('/project/README.md'), d);
    expect(output.type).toBe('allow');
    expect(d.readWindow).not.toHaveBeenCalled();
    expect(d.summarize).not.toHaveBeenCalled();
  });

  it('allows a limited Read window under threshold without reading the file', async () => {
    const d = deps();
    const output = await handleHook(readPayload('/project/docs/SPEC.md', { offset: 1, limit: 40 }), d);
    expect(output.type).toBe('allow');
    expect(d.stat).not.toHaveBeenCalled();
    expect(d.readWindow).not.toHaveBeenCalled();
    expect(d.summarize).not.toHaveBeenCalled();
  });

  it('allows when summarize fails', async () => {
    const d = deps({ summarize: vi.fn(async () => { throw new Error('provider down'); }) });
    const output = await handleHook(readPayload('/project/docs/SPEC.md'), d);
    expect(output.type).toBe('allow');
  });

  it('allows when the summary is not shorter than the source window', async () => {
    const d = deps({ summarize: vi.fn(async () => HUGE_DOC + HUGE_DOC) });
    const output = await handleHook(readPayload('/project/docs/SPEC.md'), d);
    expect(output.type).toBe('allow');
  });

  it('allows secret paths even when they look like docs', async () => {
    const d = deps();
    const output = await handleHook(readPayload('/project/.env'), d);
    expect(output.type).toBe('allow');
    expect(d.summarize).not.toHaveBeenCalled();
  });

  it('allows when stat throws', async () => {
    const d = deps({ stat: vi.fn(() => { throw new Error('ENOENT'); }) });
    const output = await handleHook(readPayload('/project/docs/SPEC.md'), d);
    expect(output.type).toBe('allow');
  });

  it('allows non-Read tools', async () => {
    const d = deps();
    const output = await handleHook(
      { ...readPayload('/project/docs/SPEC.md'), tool_name: 'Edit' },
      d,
    );
    expect(output.type).toBe('allow');
    expect(d.stat).not.toHaveBeenCalled();
  });
});
