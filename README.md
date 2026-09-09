# garrepa

> A router that intercepts large, mechanical tasks inside coding agents and delegates them to a cheap language model — reducing token costs without sacrificing reasoning quality.

## Status

Early development. API and design are not stable.

## How it works

Garrepa installs as a plugin or hook into coding agents (Claude Code, Codex CLI, etc.) and sits between the orchestrator and its tools. When it detects a task that is large but mechanical — reading a big file, summarizing a diff, extracting structured data — it routes that task to a cheap model (Haiku, GPT-4o-mini, Llama via Ollama) instead of passing it through the expensive orchestrator model.

The cheap model only receives plain text and returns plain text. It never decides which tool to call.

## Packages

| Package | Description |
|---|---|
| `@garrepa/core` | Decision engine — harness-agnostic routing logic |
| `@garrepa/adapter-claude-code` | Claude Code hook integration |
| `@garrepa/adapter-codex-cli` | Codex CLI hook integration (experimental — see note below) |
| `@garrepa/provider-anthropic` | Anthropic API model provider |
| `@garrepa/cli` | `npx garrepa` binary |

### Adapter maturity

**`adapter-claude-code`** is the primary adapter. Claude Code exposes a dedicated `Read`
tool, so garrepa can intercept file reads cleanly with no ambiguity.

**`adapter-codex-cli`** is experimental. Codex CLI has no dedicated file-read tool —
the model reads files via the `exec_command` shell tool. Garrepa uses best-effort
pattern matching on the command string (`cat`, `head`, `tail`, etc.) to detect reads.
This means it will miss reads done via less common commands or piped/chained commands.
See [`packages/adapter-codex-cli/README.md`](packages/adapter-codex-cli/README.md)
for the full list of limitations and how to extend pattern coverage.

## Development

```bash
# Install dependencies
pnpm install

# Build all packages
pnpm build

# Run all tests
pnpm test

# Lint
pnpm lint
```

## License

MIT
