import * as fs from 'fs';
import * as path from 'path';
import { describe, it, expect, vi } from 'vitest';
import { runWrite } from './write';
import type { WriteDeps } from './write';
import { COMMIT_MESSAGE_INSTRUCTION } from '../presets';
import type { GarrepaConfig } from '@garrepa/core';
import type { Provider } from '@garrepa/core';

const FAKE_CONFIG: GarrepaConfig = {
  threshold: { minChars: 2000 },
  provider: { type: 'anthropic', apiKeyEnvVar: 'ANTHROPIC_API_KEY' },
};

const SAMPLE_DIFF = `diff --git a/src/foo.ts b/src/foo.ts
index 111..222 100644
--- a/src/foo.ts
+++ b/src/foo.ts
@@ -1,3 +1,4 @@
 export const foo = 1;
+export const bar = 2;
`;

function makeDeps(overrides: Partial<WriteDeps> = {}): WriteDeps & {
  output: string;
  errors: string;
  summarize: ReturnType<typeof vi.fn>;
} {
  let output = '';
  let errors = '';
  const summarize = vi.fn().mockResolvedValue('feat: add bar export');
  const deps: WriteDeps & {
    output: string;
    errors: string;
    summarize: ReturnType<typeof vi.fn>;
  } = {
    readStdin: async () => SAMPLE_DIFF,
    readConfig: () => FAKE_CONFIG,
    createProvider: vi.fn().mockReturnValue({ summarize } as Provider),
    writeOutput: (t) => {
      output += t;
    },
    writeError: (t) => {
      errors += t;
    },
    exit: (c) => {
      throw Object.assign(new Error('process.exit'), { code: c });
    },
    get output() {
      return output;
    },
    get errors() {
      return errors;
    },
    summarize,
    ...overrides,
  };
  return deps;
}

describe('runWrite — success', () => {
  it('calls provider.summarize with the stdin diff and the commit-message instruction', async () => {
    const deps = makeDeps();
    await runWrite('commit-message', '/project', deps);
    expect(deps.summarize).toHaveBeenCalledOnce();
    expect(deps.summarize).toHaveBeenCalledWith(SAMPLE_DIFF, COMMIT_MESSAGE_INSTRUCTION);
  });

  it('prints the provider output to stdout unmodified', async () => {
    const summarize = vi.fn().mockResolvedValue('feat: add bar export');
    const deps = makeDeps({
      createProvider: vi.fn().mockReturnValue({ summarize } as Provider),
    });
    await runWrite('commit-message', '/project', deps);
    expect(deps.output).toBe('feat: add bar export');
    expect(deps.output).not.toMatch(/suggested|here is|commit message:/i);
  });

  it('passes the config to createProvider', async () => {
    const deps = makeDeps();
    await runWrite('commit-message', '/project', deps);
    expect(deps.createProvider).toHaveBeenCalledWith(FAKE_CONFIG);
  });
});

describe('runWrite — error: empty stdin', () => {
  it('writes a clear error and does not call the provider when stdin is empty', async () => {
    const deps = makeDeps({ readStdin: async () => '' });
    await expect(runWrite('commit-message', '/project', deps)).rejects.toThrow('process.exit');
    expect(deps.errors).toMatch(/stdin is empty/i);
    expect(deps.createProvider).not.toHaveBeenCalled();
    expect(deps.summarize).not.toHaveBeenCalled();
  });

  it('treats whitespace-only stdin as empty and does not call the provider', async () => {
    const deps = makeDeps({ readStdin: async () => '  \n\t\n  ' });
    await expect(runWrite('commit-message', '/project', deps)).rejects.toThrow('process.exit');
    expect(deps.errors).toMatch(/stdin is empty/i);
    expect(deps.createProvider).not.toHaveBeenCalled();
    expect(deps.summarize).not.toHaveBeenCalled();
  });

  it('exits with code 1', async () => {
    const exitCodes: number[] = [];
    const deps = makeDeps({
      readStdin: async () => '',
      exit: (c) => {
        exitCodes.push(c);
        throw Object.assign(new Error('exit'), { code: c });
      },
    });
    await expect(runWrite('commit-message', '/project', deps)).rejects.toThrow();
    expect(exitCodes).toContain(1);
  });
});

describe('runWrite — error: missing config', () => {
  it('writes actionable error and exits 1 when garrepa.config.json is absent', async () => {
    const deps = makeDeps({ readConfig: () => null });
    await expect(runWrite('commit-message', '/project', deps)).rejects.toThrow('process.exit');
    expect(deps.errors).toContain('garrepa init');
    expect(deps.errors).toContain('garrepa.config.json');
    expect(deps.createProvider).not.toHaveBeenCalled();
  });

  it('exits with code 1', async () => {
    const exitCodes: number[] = [];
    const deps = makeDeps({
      readConfig: () => null,
      exit: (c) => {
        exitCodes.push(c);
        throw Object.assign(new Error('exit'), { code: c });
      },
    });
    await expect(runWrite('commit-message', '/project', deps)).rejects.toThrow();
    expect(exitCodes).toContain(1);
  });
});

describe('runWrite — error: unknown preset', () => {
  it('writes a clear error listing known presets and does not call the provider', async () => {
    const deps = makeDeps();
    await expect(runWrite('not-a-preset', '/project', deps)).rejects.toThrow('process.exit');
    expect(deps.errors).toMatch(/unknown preset/i);
    expect(deps.errors).toContain('commit-message');
    expect(deps.createProvider).not.toHaveBeenCalled();
  });
});

describe('runWrite — error: provider failure', () => {
  it('writes error and exits 1 when summarize() throws', async () => {
    const summarize = vi.fn().mockRejectedValue(new Error('API error'));
    const deps = makeDeps({
      createProvider: vi.fn().mockReturnValue({ summarize } as Provider),
    });
    await expect(runWrite('commit-message', '/project', deps)).rejects.toThrow('process.exit');
    expect(deps.errors).toContain('generation failed');
  });
});

describe('runWrite — never executes git', () => {
  const implFiles = [
    path.join(__dirname, 'write.ts'),
    path.join(__dirname, '../presets.ts'),
  ];

  it('does not import child_process or invoke git via a shell', () => {
    for (const file of implFiles) {
      const src = fs.readFileSync(file, 'utf8');
      expect(src, file).not.toMatch(/child_process/);
      expect(src, file).not.toMatch(/node:child_process/);
      expect(src, file).not.toMatch(
        /\b(?:exec|execSync|execFile|execFileSync|spawn|spawnSync)\s*\(/,
      );
    }
  });
});
