import { describe, it, expect } from 'vitest';
import { withTimeout } from './provider-factory';

describe('withTimeout()', () => {
  it('resolves when the work finishes in time', async () => {
    await expect(withTimeout(Promise.resolve(7), 1000, 'test')).resolves.toBe(7);
  });

  it('rejects when the work exceeds the budget', async () => {
    await expect(
      withTimeout(new Promise(() => undefined), 20, 'garrepa provider'),
    ).rejects.toThrow(/timed out/);
  });
});
