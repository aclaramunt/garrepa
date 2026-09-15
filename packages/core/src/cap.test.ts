import { describe, it, expect } from 'vitest';
import { capForProvider } from './cap';

describe('capForProvider()', () => {
  it('returns content unchanged when under the cap', () => {
    expect(capForProvider('hello', 100)).toBe('hello');
  });

  it('keeps a head and tail when over the cap', () => {
    const input = 'A'.repeat(50) + 'MIDDLE' + 'Z'.repeat(50);
    const capped = capForProvider(input, 40);
    expect(capped.length).toBeLessThanOrEqual(40 + 40);
    expect(capped.startsWith('A')).toBe(true);
    expect(capped.endsWith('Z')).toBe(true);
    expect(capped).toContain('truncated');
    expect(capped).not.toContain('MIDDLE');
  });
});
