import { describe, it, expect } from 'vitest';
import { VERSION, readConfig, writeConfig, createProvider } from './index';

describe('@garrepa/cli — public API', () => {
  it('exports VERSION', () => {
    expect(VERSION).toBe('0.0.1');
  });

  it('exports readConfig', () => {
    expect(typeof readConfig).toBe('function');
  });

  it('exports writeConfig', () => {
    expect(typeof writeConfig).toBe('function');
  });

  it('exports createProvider', () => {
    expect(typeof createProvider).toBe('function');
  });
});
