import * as clack from '@clack/prompts';
import { DEFAULT_THRESHOLD } from '@garrepa/core';
import type { GarrepaConfig } from '@garrepa/core';

export type SupportedHarness = 'claude-code' | 'codex-cli';

export interface InitOptions {
  /** Harness to configure: 'claude-code' | 'codex-cli' */
  harness?: string;
  /** Provider type: 'anthropic' | 'openai-compatible' | 'manual' */
  provider?: string;
  /** Base URL (openai-compatible only) */
  baseUrl?: string;
  /** Model identifier */
  model?: string;
  /** Name of the env var holding the API key */
  apiKeyEnv?: string;
  /** Delegation threshold in chars */
  threshold?: number;
}

export interface InitDeps {
  cwd: string;
  writeConfig(cwd: string, config: GarrepaConfig): void;
  /** Called after config is written to register the hook and skill for the chosen harness. */
  installHook(projectRoot: string, harness: SupportedHarness): void;
  log(msg: string): void;
  exit(code: number): never;
}

// ─── Non-interactive path ────────────────────────────────────────────────────

function buildConfigFromFlags(options: InitOptions): GarrepaConfig {
  const threshold = { minChars: options.threshold ?? DEFAULT_THRESHOLD.minChars };
  const provider = options.provider ?? 'anthropic';

  if (provider === 'anthropic' || provider === 'manual') {
    return {
      threshold,
      provider: { type: 'anthropic', apiKeyEnvVar: options.apiKeyEnv ?? 'ANTHROPIC_API_KEY' },
    };
  }

  if (provider === 'openai-compatible') {
    if (!options.baseUrl) throw new Error('--base-url is required for openai-compatible provider');
    if (!options.model) throw new Error('--model is required for openai-compatible provider');
    return {
      threshold,
      provider: {
        type: 'openai-compatible',
        baseUrl: options.baseUrl,
        model: options.model,
        apiKeyEnvVar: options.apiKeyEnv ?? 'OPENAI_API_KEY',
      },
    };
  }

  throw new Error(
    `Unknown provider: ${provider}. Valid options: anthropic, openai-compatible, manual`,
  );
}

function parseHarness(raw: string): SupportedHarness {
  if (raw === 'claude-code' || raw === 'codex-cli') return raw;
  throw new Error(`Unknown harness: ${raw}. Valid options: claude-code, codex-cli`);
}

// ─── Interactive helpers ─────────────────────────────────────────────────────

function handleCancel(value: unknown, deps: InitDeps): void {
  if (clack.isCancel(value)) {
    clack.cancel('Setup cancelled.');
    deps.exit(0);
  }
}

async function promptEnvVarName(defaultName: string, deps: InitDeps): Promise<string> {
  const envVar = await clack.text({
    message: 'Env var name for the API key (stored in config; the value comes from your shell):',
    initialValue: defaultName,
    validate: (v) => (v.trim().length === 0 ? 'Cannot be empty' : undefined),
  });
  handleCancel(envVar, deps);
  return envVar as string;
}

async function promptThreshold(initial: number, deps: InitDeps): Promise<number> {
  const raw = await clack.text({
    message: 'Delegation threshold — content longer than this (chars) is delegated:',
    initialValue: String(initial),
    validate: (v) => (isNaN(Number(v)) || Number(v) <= 0 ? 'Must be a positive number' : undefined),
  });
  handleCancel(raw, deps);
  return Number(raw as string);
}

async function collectApiKeyEnv(defaultEnv: string, deps: InitDeps): Promise<string> {
  const alreadySet = !!process.env[defaultEnv];
  if (alreadySet) {
    const useDetected = await clack.confirm({
      message: `${defaultEnv} is already set in the environment. Use this env var name?`,
      initialValue: true,
    });
    handleCancel(useDetected, deps);
    return (useDetected as boolean) ? defaultEnv : promptEnvVarName(defaultEnv, deps);
  }
  clack.note(
    `Garrepa stores only the env var NAME in config — never the key value.\n` +
      `Add the actual key to your .env or shell profile:\n\n` +
      `  ${defaultEnv}=<your-api-key>`,
    'API key setup',
  );
  return promptEnvVarName(defaultEnv, deps);
}

// ─── Interactive wizard ───────────────────────────────────────────────────────

async function runInteractiveWizard(options: InitOptions, deps: InitDeps): Promise<void> {
  clack.intro('garrepa setup wizard');

  const harnessChoice = await clack.select({
    message: 'Which coding harness do you want to configure?',
    options: [
      { value: 'claude-code', label: 'Claude Code' },
      {
        value: 'codex-cli',
        label: 'Codex CLI',
        hint: 'experimental — best-effort file-read detection',
      },
    ],
    initialValue: options.harness ?? 'claude-code',
  });
  handleCancel(harnessChoice, deps);
  const harness = harnessChoice as SupportedHarness;

  const providerChoice = await clack.select({
    message: 'Which cheap model provider should garrepa delegate to?',
    options: [
      { value: 'anthropic', label: 'Anthropic (claude-haiku-4-5)', hint: 'recommended' },
      {
        value: 'openai-compatible',
        label: 'OpenAI-compatible endpoint',
        hint: 'Groq, Together, OpenRouter, Ollama…',
      },
      { value: 'manual', label: "Skip — I'll configure the provider manually" },
    ],
    initialValue: options.provider ?? 'anthropic',
  });
  handleCancel(providerChoice, deps);

  const chosenProvider = providerChoice as string;
  let config: GarrepaConfig;

  if (chosenProvider === 'anthropic') {
    const apiKeyEnv = await collectApiKeyEnv(options.apiKeyEnv ?? 'ANTHROPIC_API_KEY', deps);
    const thresholdChars = await promptThreshold(
      options.threshold ?? DEFAULT_THRESHOLD.minChars,
      deps,
    );
    config = {
      threshold: { minChars: thresholdChars },
      provider: { type: 'anthropic', apiKeyEnvVar: apiKeyEnv },
    };
  } else if (chosenProvider === 'openai-compatible') {
    const baseUrl = await clack.text({
      message: 'Base URL of the OpenAI-compatible endpoint:',
      placeholder: 'https://api.groq.com/openai/v1',
      initialValue: options.baseUrl ?? '',
      validate: (v) =>
        !v.startsWith('http://') && !v.startsWith('https://')
          ? 'Must start with http:// or https://'
          : undefined,
    });
    handleCancel(baseUrl, deps);

    const model = await clack.text({
      message: 'Model identifier:',
      placeholder: 'llama-3.1-8b-instant',
      initialValue: options.model ?? '',
      validate: (v) => (v.trim().length === 0 ? 'Cannot be empty' : undefined),
    });
    handleCancel(model, deps);

    const apiKeyEnv = await collectApiKeyEnv(options.apiKeyEnv ?? 'OPENAI_API_KEY', deps);
    const thresholdChars = await promptThreshold(
      options.threshold ?? DEFAULT_THRESHOLD.minChars,
      deps,
    );
    config = {
      threshold: { minChars: thresholdChars },
      provider: {
        type: 'openai-compatible',
        baseUrl: baseUrl as string,
        model: model as string,
        apiKeyEnvVar: apiKeyEnv,
      },
    };
  } else {
    // manual
    const thresholdChars = await promptThreshold(
      options.threshold ?? DEFAULT_THRESHOLD.minChars,
      deps,
    );
    config = {
      threshold: { minChars: thresholdChars },
      provider: { type: 'anthropic', apiKeyEnvVar: 'ANTHROPIC_API_KEY' },
    };
    clack.note(
      'garrepa.config.json created with Anthropic defaults.\n' +
        'Edit provider.type and provider.apiKeyEnvVar manually before use.',
      'Manual configuration',
    );
  }

  deps.writeConfig(deps.cwd, config);
  deps.installHook(deps.cwd, harness);

  const hookLocation =
    harness === 'codex-cli'
      ? '.codex/hooks.json (PreToolUse → exec_command)'
      : '.claude/settings.json (PreToolUse → Read)';

  const skillLocation =
    harness === 'codex-cli'
      ? '.agents/skills/garrepa-write/SKILL.md'
      : '.claude/skills/garrepa-write/SKILL.md';

  const envWarning =
    config.provider.apiKeyEnvVar && !process.env[config.provider.apiKeyEnvVar]
      ? `\nRemember to set ${config.provider.apiKeyEnvVar} in your shell or .env file.`
      : '';

  const codexNote =
    harness === 'codex-cli'
      ? '\n\nNote: Codex CLI adapter uses best-effort pattern matching — see README.'
      : '';

  clack.outro(
    `garrepa configured!\n` +
      `  Config  → garrepa.config.json\n` +
      `  Hook    → ${hookLocation}\n` +
      `  Skill   → ${skillLocation}` +
      envWarning +
      codexNote,
  );
}

// ─── Entry point ─────────────────────────────────────────────────────────────

export async function runInit(options: InitOptions, deps: InitDeps): Promise<void> {
  const hasFlags = Boolean(
    options.harness ?? options.provider ?? options.apiKeyEnv ?? options.threshold ?? options.baseUrl ?? options.model,
  );

  if (hasFlags) {
    const config = buildConfigFromFlags(options);
    deps.writeConfig(deps.cwd, config);
    const harness = parseHarness(options.harness ?? 'claude-code');
    deps.installHook(deps.cwd, harness);
    deps.log('garrepa configured successfully.');
    const envVar = config.provider.apiKeyEnvVar;
    if (envVar && !process.env[envVar]) {
      deps.log(`Remember to set ${envVar} in your environment before using garrepa.`);
    }
    return;
  }

  await runInteractiveWizard(options, deps);
}
