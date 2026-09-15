import { describe, it, expect } from 'vitest';
import {
  decide,
  decideFromCharCount,
  route,
  capForProvider,
  isSecretPath,
  MockProvider,
  DEFAULT_THRESHOLD,
  DEFAULT_MAX_PROVIDER_CHARS,
} from './index';

describe('@garrepa/core public API', () => {
  it('exports decide', () => expect(typeof decide).toBe('function'));
  it('exports route', () => expect(typeof route).toBe('function'));
  it('exports MockProvider', () => expect(typeof MockProvider).toBe('function'));
  it('exports DEFAULT_THRESHOLD at 32k so typical source is not delegated', () =>
    expect(DEFAULT_THRESHOLD.minChars).toBe(32_000));
  it('exports decideFromCharCount', () => expect(typeof decideFromCharCount).toBe('function'));
  it('exports capForProvider and DEFAULT_MAX_PROVIDER_CHARS', () => {
    expect(typeof capForProvider).toBe('function');
    expect(DEFAULT_MAX_PROVIDER_CHARS).toBe(200_000);
  });
  it('exports isSecretPath', () => expect(typeof isSecretPath).toBe('function'));
});
