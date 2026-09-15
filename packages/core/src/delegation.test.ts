import { describe, it, expect } from 'vitest';
import { decide, decideFromCharCount } from './delegation';

const THRESHOLD = 2000;
const config = { minChars: THRESHOLD };

describe('decide()', () => {
  it('does not delegate when content is below threshold', () => {
    const result = decide('short content', config);
    expect(result.delegate).toBe(false);
    expect(result.reason).toBe('below_threshold');
  });

  it('delegates when content is above threshold', () => {
    const result = decide('x'.repeat(THRESHOLD + 1), config);
    expect(result.delegate).toBe(true);
    expect(result.reason).toBe('above_threshold');
  });

  // Edge case: content length exactly equals minChars.
  // Decision: delegate (>=). At the boundary the content is large enough that
  // delegation cost is worthwhile; erring toward delegation is safer.
  it('delegates when content length exactly equals threshold', () => {
    const result = decide('x'.repeat(THRESHOLD), config);
    expect(result.delegate).toBe(true);
    expect(result.reason).toBe('above_threshold');
  });

  it('respects a custom threshold', () => {
    const small = decide('hello', { minChars: 3 });
    expect(small.delegate).toBe(true);

    const large = decide('hello', { minChars: 100 });
    expect(large.delegate).toBe(false);
  });
});

describe('decideFromCharCount()', () => {
  it('matches decide() for the same length', () => {
    const fromCount = decideFromCharCount(500, config);
    const fromContent = decide('x'.repeat(500), config);
    expect(fromCount).toEqual(fromContent);
  });

  it('does not require loading the file body', () => {
    expect(decideFromCharCount(32_000, { minChars: 32_000 }).delegate).toBe(true);
    expect(decideFromCharCount(31_999, { minChars: 32_000 }).delegate).toBe(false);
  });
});
