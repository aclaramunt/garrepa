import { describe, expect, it } from 'vitest';
import { pruneJsonTextIfPossible, prunePlumbing } from './mcp-prune';

describe('prunePlumbing', () => {
  it('drops plumbing keys and keeps tool handles', () => {
    expect(
      prunePlumbing({
        id: 'page-1',
        url: 'https://example.com/page-1',
        status: 'open',
        requestId: 'req-9',
        etag: '"abc"',
        avatar_url: 'https://cdn.example/a.png',
        nested: {
          id: 'child-1',
          request_id: 'inner',
          _rev: '3',
          expiry_time: '2099-01-01',
        },
      }),
    ).toEqual({
      id: 'page-1',
      url: 'https://example.com/page-1',
      status: 'open',
      nested: { id: 'child-1' },
    });
  });

  it('does not throw on cyclic objects', () => {
    const cyclic: { id: string; self?: unknown } = { id: 'root' };
    cyclic.self = cyclic;
    expect(() => prunePlumbing(cyclic)).not.toThrow();
    const pruned = prunePlumbing(cyclic) as { id: string; self?: unknown };
    expect(pruned.id).toBe('root');
  });
});

describe('pruneJsonTextIfPossible', () => {
  it('compacts JSON objects after dropping plumbing', () => {
    const raw = JSON.stringify({ id: 'abc', etag: '1', avatarUrl: 'https://cdn/x' }, null, 2);
    expect(pruneJsonTextIfPossible(raw)).toBe(JSON.stringify({ id: 'abc' }));
  });

  it('leaves markdown and invalid JSON intact', () => {
    expect(pruneJsonTextIfPossible('# Heading\nNot JSON')).toBe('# Heading\nNot JSON');
    expect(pruneJsonTextIfPossible('{ not json')).toBe('{ not json');
    expect(pruneJsonTextIfPossible('42')).toBe('42');
  });
});
