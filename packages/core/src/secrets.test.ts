import { describe, it, expect } from 'vitest';
import { isSecretPath } from './secrets';

describe('isSecretPath()', () => {
  it('matches .env and .env* basenames', () => {
    expect(isSecretPath('/project/.env')).toBe(true);
    expect(isSecretPath('/project/.env.local')).toBe(true);
    expect(isSecretPath('/project/src/.env.production')).toBe(true);
  });

  it('matches *.pem, id_rsa, credentials*, and secrets directories', () => {
    expect(isSecretPath('/keys/cert.pem')).toBe(true);
    expect(isSecretPath('/home/user/.ssh/id_rsa')).toBe(true);
    expect(isSecretPath('/app/google-credentials.json')).toBe(true);
    expect(isSecretPath('/app/secrets/api.txt')).toBe(true);
    expect(isSecretPath('/app/Secrets/token')).toBe(true);
  });

  it('does not match ordinary source or docs', () => {
    expect(isSecretPath('/project/src/index.ts')).toBe(false);
    expect(isSecretPath('/project/README.md')).toBe(false);
    expect(isSecretPath('/project/docs/guide.md')).toBe(false);
  });
});
