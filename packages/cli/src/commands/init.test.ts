import { describe, it, expect } from 'vitest';
import { runInit } from './init';
import type { InitDeps, SupportedHarness } from './init';
import type { GarrepaConfig } from '@garrepa/core';
import { DEFAULT_THRESHOLD } from '@garrepa/core';

function makeDeps(cwd = '/project'): InitDeps & {
  writtenConfig: GarrepaConfig | null;
  installedHarness: SupportedHarness | null;
  logs: string[];
} {
  let writtenConfig: GarrepaConfig | null = null;
  let installedHarness: SupportedHarness | null = null;
  const logs: string[] = [];
  return {
    cwd,
    writeConfig: (_cwd, config) => { writtenConfig = config; },
    installHook: (_root, harness) => { installedHarness = harness; },
    log: (msg) => logs.push(msg),
    exit: (c) => { throw Object.assign(new Error('process.exit'), { code: c }); },
    get writtenConfig() { return writtenConfig; },
    get installedHarness() { return installedHarness; },
    get logs() { return logs; },
  };
}

describe('runInit — non-interactive anthropic (claude-code)', () => {
  it('writes garrepa.config.json with correct provider type', async () => {
    const deps = makeDeps();
    await runInit(
      { harness: 'claude-code', provider: 'anthropic', apiKeyEnv: 'MY_API_KEY' },
      deps,
    );
    expect(deps.writtenConfig?.provider.type).toBe('anthropic');
  });

  it('stores apiKeyEnvVar name, never a raw key value', async () => {
    const deps = makeDeps();
    await runInit(
      { harness: 'claude-code', provider: 'anthropic', apiKeyEnv: 'MY_ANTHROPIC_KEY' },
      deps,
    );
    const provider = deps.writtenConfig?.provider;
    expect(provider?.apiKeyEnvVar).toBe('MY_ANTHROPIC_KEY');
    const raw = JSON.stringify(deps.writtenConfig);
    expect(raw).not.toMatch(/sk-ant-/);
    expect(raw).not.toMatch(/Bearer /);
  });

  it('uses DEFAULT_THRESHOLD when --threshold not passed', async () => {
    const deps = makeDeps();
    await runInit(
      { harness: 'claude-code', provider: 'anthropic', apiKeyEnv: 'ANTHROPIC_API_KEY' },
      deps,
    );
    expect(deps.writtenConfig?.threshold).toEqual(DEFAULT_THRESHOLD);
  });

  it('uses custom threshold when --threshold is passed', async () => {
    const deps = makeDeps();
    await runInit(
      { harness: 'claude-code', provider: 'anthropic', apiKeyEnv: 'ANTHROPIC_API_KEY', threshold: 500 },
      deps,
    );
    expect(deps.writtenConfig?.threshold.minChars).toBe(500);
  });

  it('calls installHook with claude-code harness', async () => {
    const deps = makeDeps();
    await runInit(
      { harness: 'claude-code', provider: 'anthropic', apiKeyEnv: 'ANTHROPIC_API_KEY' },
      deps,
    );
    expect(deps.installedHarness).toBe('claude-code');
  });

  it('defaults harness to claude-code when not specified', async () => {
    const deps = makeDeps();
    await runInit({ provider: 'anthropic', apiKeyEnv: 'ANTHROPIC_API_KEY' }, deps);
    expect(deps.installedHarness).toBe('claude-code');
  });

  it('defaults apiKeyEnvVar to ANTHROPIC_API_KEY when --api-key-env not passed', async () => {
    const deps = makeDeps();
    await runInit({ harness: 'claude-code', provider: 'anthropic' }, deps);
    expect(deps.writtenConfig?.provider.apiKeyEnvVar).toBe('ANTHROPIC_API_KEY');
  });
});

describe('runInit — non-interactive codex-cli harness', () => {
  it('calls installHook with codex-cli harness', async () => {
    const deps = makeDeps();
    await runInit(
      { harness: 'codex-cli', provider: 'anthropic', apiKeyEnv: 'ANTHROPIC_API_KEY' },
      deps,
    );
    expect(deps.installedHarness).toBe('codex-cli');
  });

  it('writes the same config shape for codex-cli as for claude-code', async () => {
    const deps = makeDeps();
    await runInit(
      { harness: 'codex-cli', provider: 'anthropic', apiKeyEnv: 'MY_KEY', threshold: 1500 },
      deps,
    );
    expect(deps.writtenConfig?.threshold.minChars).toBe(1500);
    expect(deps.writtenConfig?.provider.type).toBe('anthropic');
    expect(deps.writtenConfig?.provider.apiKeyEnvVar).toBe('MY_KEY');
  });

  it('throws for an unknown harness', async () => {
    const deps = makeDeps();
    await expect(
      runInit({ harness: 'unknown-harness', provider: 'anthropic' }, deps),
    ).rejects.toThrow('Unknown harness');
  });
});

describe('runInit — non-interactive openai-compatible', () => {
  it('writes openai-compatible config with baseUrl and model', async () => {
    const deps = makeDeps();
    await runInit(
      {
        harness: 'claude-code',
        provider: 'openai-compatible',
        baseUrl: 'https://api.groq.com/openai/v1',
        model: 'llama-3.1-8b-instant',
        apiKeyEnv: 'GROQ_API_KEY',
      },
      deps,
    );
    const p = deps.writtenConfig?.provider;
    expect(p?.type).toBe('openai-compatible');
    if (p?.type === 'openai-compatible') {
      expect(p.baseUrl).toBe('https://api.groq.com/openai/v1');
      expect(p.model).toBe('llama-3.1-8b-instant');
      expect(p.apiKeyEnvVar).toBe('GROQ_API_KEY');
    }
  });

  it('throws when --base-url is missing for openai-compatible', async () => {
    const deps = makeDeps();
    await expect(
      runInit(
        { harness: 'claude-code', provider: 'openai-compatible', model: 'gpt-4o-mini' },
        deps,
      ),
    ).rejects.toThrow('--base-url');
  });

  it('throws when --model is missing for openai-compatible', async () => {
    const deps = makeDeps();
    await expect(
      runInit(
        { harness: 'claude-code', provider: 'openai-compatible', baseUrl: 'https://api.openai.com/v1' },
        deps,
      ),
    ).rejects.toThrow('--model');
  });

  it('defaults apiKeyEnvVar to OPENAI_API_KEY', async () => {
    const deps = makeDeps();
    await runInit(
      {
        harness: 'claude-code',
        provider: 'openai-compatible',
        baseUrl: 'https://api.openai.com/v1',
        model: 'gpt-4o-mini',
      },
      deps,
    );
    expect(deps.writtenConfig?.provider.apiKeyEnvVar).toBe('OPENAI_API_KEY');
  });
});

describe('runInit — config file shape invariants', () => {
  it('config never contains a raw secret pattern', async () => {
    const deps = makeDeps();
    await runInit(
      { harness: 'claude-code', provider: 'anthropic', apiKeyEnv: 'ANTHROPIC_API_KEY' },
      deps,
    );
    const raw = JSON.stringify(deps.writtenConfig);
    expect(raw).not.toMatch(/sk-[a-zA-Z0-9]/);
    expect(raw).not.toMatch(/api[_-]?key\s*[:=]\s*["'][^"']{10}/i);
  });

  it('always has a threshold object', async () => {
    const deps = makeDeps();
    await runInit(
      { harness: 'claude-code', provider: 'anthropic', apiKeyEnv: 'ANTHROPIC_API_KEY' },
      deps,
    );
    expect(deps.writtenConfig?.threshold).toBeDefined();
    expect(typeof deps.writtenConfig?.threshold.minChars).toBe('number');
  });
});
