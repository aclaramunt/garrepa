import { describe, it, expect, vi } from 'vitest';
import { runSummarize } from './summarize';
import type { SummarizeDeps } from './summarize';
import type { GarrepaConfig } from '@garrepa/adapter-claude-code';
import type { Provider, RouterResult } from '@garrepa/core';

const FAKE_CONFIG: GarrepaConfig = {
  threshold: { minChars: 2000 },
  provider: { type: 'anthropic', apiKeyEnvVar: 'ANTHROPIC_API_KEY' },
};

const LARGE_CONTENT = 'x'.repeat(3000);

function makeDeps(overrides: Partial<SummarizeDeps> = {}): SummarizeDeps & { output: string; errors: string } {
  let output = '';
  let errors = '';
  return {
    readFile: () => LARGE_CONTENT,
    readConfig: () => FAKE_CONFIG,
    createProvider: () => ({ summarize: vi.fn().mockResolvedValue('mocked summary') } as Provider),
    route: vi.fn().mockResolvedValue({ output: 'mocked summary', delegated: true } as RouterResult),
    writeOutput: (t) => { output += t; },
    writeError: (t) => { errors += t; },
    exit: (c) => { throw Object.assign(new Error('process.exit'), { code: c }); },
    get output() { return output; },
    get errors() { return errors; },
    ...overrides,
  };
}

describe('runSummarize — success', () => {
  it('calls route() and writes output', async () => {
    const deps = makeDeps();
    await runSummarize('src/large.ts', '/project', deps);
    expect(deps.output).toBe('mocked summary');
  });

  it('passes file content and config threshold to route()', async () => {
    const deps = makeDeps();
    await runSummarize('src/file.ts', '/project', deps);
    expect(deps.route).toHaveBeenCalledWith(
      LARGE_CONTENT,
      expect.any(String),
      FAKE_CONFIG.threshold,
      expect.any(Object),
    );
  });

  it('passes the config to createProvider', async () => {
    const createProvider = vi.fn().mockReturnValue({
      summarize: vi.fn(),
    } as Provider);
    const route = vi.fn().mockResolvedValue({ output: 'ok', delegated: true } as RouterResult);
    const deps = makeDeps({ createProvider, route });
    await runSummarize('file.ts', '/project', deps);
    expect(createProvider).toHaveBeenCalledWith(FAKE_CONFIG);
  });
});

describe('runSummarize — error: missing config', () => {
  it('writes actionable error and exits 1 when garrepa.config.json is absent', async () => {
    const deps = makeDeps({ readConfig: () => null });
    await expect(runSummarize('file.ts', '/project', deps)).rejects.toThrow('process.exit');
    expect(deps.errors).toContain('garrepa init');
    expect(deps.errors).toContain('garrepa.config.json');
  });

  it('exits with code 1', async () => {
    const exitCodes: number[] = [];
    const deps = makeDeps({
      readConfig: () => null,
      exit: (c) => { exitCodes.push(c); throw Object.assign(new Error('exit'), { code: c }); },
    });
    await expect(runSummarize('file.ts', '/project', deps)).rejects.toThrow();
    expect(exitCodes).toContain(1);
  });
});

describe('runSummarize — error: unreadable file', () => {
  it('writes error and exits 1 when file cannot be read', async () => {
    const deps = makeDeps({
      readFile: () => { throw new Error('ENOENT: no such file or directory'); },
    });
    await expect(runSummarize('missing.ts', '/project', deps)).rejects.toThrow('process.exit');
    expect(deps.errors).toContain('cannot read file');
  });
});

describe('runSummarize — error: provider failure', () => {
  it('writes error and exits 1 when route() throws', async () => {
    const deps = makeDeps({
      route: vi.fn().mockRejectedValue(new Error('API error')),
    });
    await expect(runSummarize('file.ts', '/project', deps)).rejects.toThrow('process.exit');
    expect(deps.errors).toContain('summarization failed');
  });
});
