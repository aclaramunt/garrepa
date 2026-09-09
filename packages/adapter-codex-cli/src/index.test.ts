import { describe, it, expect } from 'vitest';
import { VERSION } from './index';

describe('@garrepa/adapter-codex-cli', () => {
  it('exports VERSION', () => {
    expect(VERSION).toBe('0.0.1');
  });
});
