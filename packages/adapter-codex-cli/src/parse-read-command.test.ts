import { describe, it, expect } from 'vitest';
import { parseReadCommand, DEFAULT_READ_COMMANDS } from './parse-read-command';

// Parses the shell command string from Codex Bash tool_input.command (or legacy cmd).

describe('parseReadCommand — shell metacharacter rejection', () => {
  it('rejects commands with a pipe', () => {
    expect(parseReadCommand('cat /etc/hosts | grep lo')).toBeNull();
  });

  it('rejects commands with stdout redirect', () => {
    expect(parseReadCommand('cat /etc/hosts > /tmp/out')).toBeNull();
  });

  it('rejects commands with stdin redirect', () => {
    expect(parseReadCommand('cat < /etc/hosts')).toBeNull();
  });

  it('rejects commands with append redirect', () => {
    expect(parseReadCommand('cat /etc/hosts >> /tmp/out')).toBeNull();
  });

  it('rejects commands chained with semicolon', () => {
    expect(parseReadCommand('cat file.txt; ls')).toBeNull();
  });

  it('rejects commands chained with &&', () => {
    expect(parseReadCommand('cat file.txt && echo done')).toBeNull();
  });

  it('rejects commands chained with ||', () => {
    expect(parseReadCommand('cat file.txt || true')).toBeNull();
  });

  it('rejects commands with backtick subshell', () => {
    expect(parseReadCommand('cat `echo /etc/hosts`')).toBeNull();
  });

  it('rejects commands with $() subshell', () => {
    expect(parseReadCommand('cat $(echo /etc/hosts)')).toBeNull();
  });

  it('rejects commands with $ variable expansion', () => {
    expect(parseReadCommand('cat $FILE')).toBeNull();
  });
});

describe('parseReadCommand — non-matching commands', () => {
  it('rejects commands not in the read allowlist', () => {
    expect(parseReadCommand('ls /etc')).toBeNull();
    expect(parseReadCommand('grep foo /etc/hosts')).toBeNull();
    expect(parseReadCommand('wc -l /etc/hosts')).toBeNull();
  });

  it('rejects a bare command with no arguments', () => {
    expect(parseReadCommand('cat')).toBeNull();
    expect(parseReadCommand('less')).toBeNull();
  });

  it('rejects when multiple non-flag arguments are present (ambiguous file list)', () => {
    expect(parseReadCommand('cat file1.txt file2.txt')).toBeNull();
  });

  it('rejects when multiple non-flag arguments appear with flags', () => {
    expect(parseReadCommand('cat -n file1.txt file2.txt')).toBeNull();
  });

  it('returns null for empty input', () => {
    expect(parseReadCommand('')).toBeNull();
    expect(parseReadCommand('   ')).toBeNull();
  });
});

describe('parseReadCommand — successful matches', () => {
  it('matches a plain cat command', () => {
    expect(parseReadCommand('cat /etc/hosts')).toEqual({ filePath: '/etc/hosts' });
  });

  it('matches cat with a relative path', () => {
    expect(parseReadCommand('cat src/index.ts')).toEqual({ filePath: 'src/index.ts' });
  });

  it('matches cat with -n flag', () => {
    expect(parseReadCommand('cat -n /etc/hosts')).toEqual({ filePath: '/etc/hosts' });
  });

  it('matches cat with multiple flags', () => {
    expect(parseReadCommand('cat -A -n /etc/hosts')).toEqual({ filePath: '/etc/hosts' });
  });

  it('matches head', () => {
    expect(parseReadCommand('head /var/log/app.log')).toEqual({
      filePath: '/var/log/app.log',
    });
  });

  it('matches tail with -f flag (single file, unambiguous)', () => {
    expect(parseReadCommand('tail -f /var/log/app.log')).toEqual({
      filePath: '/var/log/app.log',
    });
  });

  it('matches less', () => {
    expect(parseReadCommand('less /usr/share/doc/readme.txt')).toEqual({
      filePath: '/usr/share/doc/readme.txt',
    });
  });

  it('matches more', () => {
    expect(parseReadCommand('more /etc/fstab')).toEqual({ filePath: '/etc/fstab' });
  });

  it('matches bat', () => {
    expect(parseReadCommand('bat src/main.rs')).toEqual({ filePath: 'src/main.rs' });
  });

  it('matches bat with --style=plain (flag has embedded =)', () => {
    expect(parseReadCommand('bat --style=plain src/main.rs')).toEqual({
      filePath: 'src/main.rs',
    });
  });
});

describe('parseReadCommand — acceptable false negatives', () => {
  it('does not match head -n 10 <file> (two non-flag args: 10, file)', () => {
    // head -n 10 file.txt: "10" doesn't start with "-", so treated as non-flag
    expect(parseReadCommand('head -n 10 /var/log/app.log')).toBeNull();
  });

  it('does not match paths with spaces (tokenized incorrectly)', () => {
    expect(parseReadCommand('cat /path/with spaces/file.txt')).toBeNull();
  });

  it('does not match bat --style plain <file> (plain is a non-flag)', () => {
    // --style and plain are separate tokens; plain is non-flag, creating 2 non-flags
    expect(parseReadCommand('bat --style plain src/main.rs')).toBeNull();
  });
});

describe('parseReadCommand — custom readCommands', () => {
  it('uses provided readCommands instead of defaults', () => {
    const custom = ['view', 'show'];
    expect(parseReadCommand('cat /etc/hosts', custom)).toBeNull();
    expect(parseReadCommand('view /etc/hosts', custom)).toEqual({ filePath: '/etc/hosts' });
  });

  it('DEFAULT_READ_COMMANDS covers the expected set', () => {
    expect(DEFAULT_READ_COMMANDS).toContain('cat');
    expect(DEFAULT_READ_COMMANDS).toContain('head');
    expect(DEFAULT_READ_COMMANDS).toContain('tail');
    expect(DEFAULT_READ_COMMANDS).toContain('less');
    expect(DEFAULT_READ_COMMANDS).toContain('more');
    expect(DEFAULT_READ_COMMANDS).toContain('bat');
  });
});
