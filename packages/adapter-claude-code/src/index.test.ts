import { describe, it, expect } from 'vitest';
import { VERSION } from './index';

describe('@garrepa/adapter-claude-code', () => {
  it('exports VERSION', () => {
    expect(VERSION).toBe('0.0.1');
  });
});
