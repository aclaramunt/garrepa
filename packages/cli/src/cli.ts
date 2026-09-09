import * as path from 'path';
import { config as loadDotenv } from 'dotenv';
import * as fs from 'fs';
import { Command } from 'commander';

loadDotenv({ path: path.resolve(process.cwd(), '.env'), quiet: true });
import { installHook as installClaudeCodeHook } from '@garrepa/adapter-claude-code';
import { installHook as installCodexCliHook } from '@garrepa/adapter-codex-cli';
import { runInit } from './commands/init';
import { runSummarize } from './commands/summarize';
import { runWrite, readStdinFromProcess } from './commands/write';
import { readConfig, writeConfig } from './config';
import { createProvider } from './provider-factory';
import { route } from '@garrepa/core';

const program = new Command();

program
  .name('garrepa')
  .version('0.0.1')
  .description('Route large content to cheap models, keeping your orchestrator lean.');

program
  .command('init')
  .description('Interactive setup wizard — configure garrepa for your project')
  .option('--harness <name>', 'Harness to configure (claude-code, codex-cli)')
  .option('--provider <type>', 'Provider type: anthropic | openai-compatible | manual')
  .option('--base-url <url>', 'Base URL for openai-compatible provider')
  .option('--model <model>', 'Model identifier')
  .option('--api-key-env <varname>', 'Name of the env var holding the API key')
  .option('--threshold <number>', 'Delegation threshold in characters', Number)
  .action(async (opts: Record<string, string | number | undefined>) => {
    const cwd = process.cwd();
    await runInit(
      {
        harness: opts['harness'] as string | undefined,
        provider: opts['provider'] as string | undefined,
        baseUrl: opts['baseUrl'] as string | undefined,
        model: opts['model'] as string | undefined,
        apiKeyEnv: opts['apiKeyEnv'] as string | undefined,
        threshold: opts['threshold'] as number | undefined,
      },
      {
        cwd,
        writeConfig,
        installHook: (projectRoot, harness) => {
          if (harness === 'codex-cli') {
            installCodexCliHook(projectRoot);
          } else {
            installClaudeCodeHook(projectRoot);
          }
        },
        log: (msg) => process.stdout.write(msg + '\n'),
        exit: (c) => process.exit(c),
      },
    );
  });

program
  .command('summarize <file>')
  .description('Summarize a file using the configured cheap model provider')
  .action(async (file: string) => {
    const cwd = process.cwd();
    await runSummarize(file, cwd, {
      readFile: (p) => fs.readFileSync(p, 'utf8'),
      readConfig,
      createProvider,
      route,
      writeOutput: (t) => process.stdout.write(t),
      writeError: (t) => process.stderr.write(t),
      exit: (c) => process.exit(c),
    });
  });

program
  .command('write <preset>')
  .description('Generate content from stdin using the configured cheap model (e.g. commit-message)')
  .action(async (preset: string) => {
    const cwd = process.cwd();
    await runWrite(preset, cwd, {
      readStdin: readStdinFromProcess,
      readConfig,
      createProvider,
      writeOutput: (t) => process.stdout.write(t),
      writeError: (t) => process.stderr.write(t),
      exit: (c) => process.exit(c),
    });
  });

program.parse(process.argv);
