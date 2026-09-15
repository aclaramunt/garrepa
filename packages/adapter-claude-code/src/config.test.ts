import { describe, it, expect } from 'vitest';
import { loadConfig, DEFAULT_GARREPA_CONFIG } from './config';
import { DEFAULT_THRESHOLD } from '@garrepa/core';

describe('loadConfig — missing or invalid file', () => {
  it('falls back to DEFAULT_THRESHOLD when config file is absent', () => {
    const config = loadConfig('/nonexistent', () => {
      throw Object.assign(new Error('ENOENT'), { code: 'ENOENT' });
    });
    expect(config.threshold).toEqual(DEFAULT_THRESHOLD);
  });

  it('falls back to default when config file contains invalid JSON', () => {
    const config = loadConfig('/project', () => '{ not json {{');
    expect(config.threshold).toEqual(DEFAULT_THRESHOLD);
    expect(config.provider.type).toBe('anthropic');
  });

  it('falls back to default when config file is empty', () => {
    const config = loadConfig('/project', () => '');
    expect(config.threshold).toEqual(DEFAULT_THRESHOLD);
  });
});

describe('loadConfig — valid config file', () => {
  it('loads a custom threshold from the config file', () => {
    const raw = JSON.stringify({ threshold: { minChars: 500 }, provider: { type: 'anthropic' } });
    const config = loadConfig('/project', () => raw);
    expect(config.threshold.minChars).toBe(500);
  });

  it('uses default threshold when config omits threshold field', () => {
    const raw = JSON.stringify({ provider: { type: 'anthropic', model: 'claude-haiku-4-5' } });
    const config = loadConfig('/project', () => raw);
    expect(config.threshold).toEqual(DEFAULT_THRESHOLD);
  });

  it('uses default provider when config omits provider field', () => {
    const raw = JSON.stringify({ threshold: { minChars: 300 } });
    const config = loadConfig('/project', () => raw);
    expect(config.provider).toEqual(DEFAULT_GARREPA_CONFIG.provider);
  });

  it('passes the correct path (<cwd>/garrepa.config.json) to the reader', () => {
    let capturedPath = '';
    loadConfig('/my/project', (p) => {
      capturedPath = p;
      return JSON.stringify({ threshold: { minChars: 1 }, provider: { type: 'anthropic' } });
    });
    expect(capturedPath).toMatch(/garrepa\.config\.json$/);
    expect(capturedPath).toContain('/my/project');
  });

  it('loads model and maxTokens from provider config', () => {
    const raw = JSON.stringify({
      threshold: { minChars: 100 },
      provider: { type: 'anthropic', model: 'claude-haiku-4-5', maxTokens: 512 },
    });
    const config = loadConfig('/project', () => raw);
    expect(config.provider.model).toBe('claude-haiku-4-5');
    expect(config.provider.maxTokens).toBe(512);
  });

  it('loads only valid exact MCP tool exclusions', () => {
    const raw = JSON.stringify({
      threshold: { minChars: 100 },
      provider: { type: 'anthropic' },
      mcp: {
        excludeTools: ['mcp__vault__read_secret', 'Read', 42],
      },
    });
    const config = loadConfig('/project', () => raw);

    expect(config.mcp?.excludeTools).toEqual(['mcp__vault__read_secret']);
  });
});
