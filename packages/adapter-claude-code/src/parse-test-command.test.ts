import { describe, expect, it } from 'vitest';
import { parseTestCommand } from './parse-test-command';

describe('parseTestCommand', () => {
  it.each([
    ['jest', 'jest'],
    ['jest --coverage', 'jest'],
    ['jest src/foo.test.ts', 'jest'],
    ['vitest', 'vitest'],
    ['vitest run', 'vitest'],
    ['vitest --reporter=verbose', 'vitest'],
    ['mocha', 'mocha'],
    ['mocha --recursive', 'mocha'],
    ['pytest', 'pytest'],
    ['pytest -v src/', 'pytest'],
    ['py.test', 'py.test'],
    ['phpunit', 'phpunit'],
    ['npx jest', 'jest'],
    ['npx vitest run', 'vitest'],
    ['npx mocha --recursive', 'mocha'],
    ['./node_modules/.bin/jest', 'jest'],
    ['./node_modules/.bin/vitest', 'vitest'],
    ['node_modules/.bin/jest --watch=false', 'jest'],
    ['pnpm test', 'pnpm test'],
    ['pnpm run test', 'pnpm test'],
    ['pnpm test --filter=@scope/pkg', 'pnpm test'],
    ['npm test', 'npm test'],
    ['npm run test', 'npm test'],
    ['yarn test', 'yarn test'],
    ['bun test', 'bun test'],
    ['cargo test', 'cargo test'],
    ['cargo test --lib', 'cargo test'],
    ['go test ./...', 'go test'],
    ['go test -v ./pkg/...', 'go test'],
  ] as const)('matches %s -> runner=%s', (cmd, runner) => {
    expect(parseTestCommand(cmd)).toEqual({ runner });
  });

  it.each([
    'echo hello',
    'git diff',
    'tsc --noEmit',
    'eslint src/',
    'pnpm build',
    'npm run lint',
    'cargo build',
    'go build ./...',
    'jest && git commit -m "x"',
    'jest | tee output.txt',
    'npx tsc',
    'npx eslint src/',
    'jest $(cat sha)',
    'npm test; echo done',
    '',
    'pnpm run lint',
    'pnpm run build',
    'cargo check',
  ])('rejects %s', (cmd) => {
    expect(parseTestCommand(cmd)).toBeNull();
  });
});
