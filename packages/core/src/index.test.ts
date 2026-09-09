import { describe, it, expect } from 'vitest';
import {
  decide,
  route,
  MockProvider,
  DEFAULT_THRESHOLD,
} from './index';

describe('@garrepa/core public API', () => {
  it('exports decide', () => expect(typeof decide).toBe('function'));
  it('exports route', () => expect(typeof route).toBe('function'));
  it('exports MockProvider', () => expect(typeof MockProvider).toBe('function'));
  it('exports DEFAULT_THRESHOLD with minChars', () =>
    expect(DEFAULT_THRESHOLD.minChars).toBeGreaterThan(0));
});
