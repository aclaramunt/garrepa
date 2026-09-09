> **Mirror notice:** This file is identical to `CLAUDE.md`. Always edit both together — never update just one.

# garrepa — Agent Guidelines

## 1. What garrepa is

Garrepa is a router that installs as a plugin or hook inside coding agents (Claude Code, Codex CLI) and intercepts large, mechanical tasks — reading a Jira ticket, summarizing a file, digesting a Notion spec — delegating them to a cheap language model (Haiku, GPT-4o-mini, Llama via Ollama) so the expensive orchestrator model only ever sees a compressed result instead of the raw content. The orchestrator stays focused; garrepa handles the grunt work.

## 2. Architecture

### Package layout

```
packages/
  core/                  @garrepa/core                Decision engine
  adapter-claude-code/   @garrepa/adapter-claude-code Claude Code hook adapter
  provider-anthropic/    @garrepa/provider-anthropic  Anthropic model provider
  cli/                   @garrepa/cli                 npx garrepa binary
```

### What logic belongs where

**`core` — decision engine**
Decides whether a task should be delegated (based on size threshold and configured rules), calls the selected provider, and returns the compressed result. Must be 100% agnostic: zero imports referencing a specific harness (Claude Code, Codex CLI) or a specific vendor (Anthropic, OpenAI, etc.). If you find yourself importing anything harness- or vendor-specific here, stop and restructure.

**`adapters/*` — harness translation layer**
Translate a specific harness's native hook or event format into calls to `core`. All harness-specific knowledge (hook payload shapes, config file locations, installation paths) lives here and **only** here.

**`providers/*` — model calling layer**
Each provider package wraps one specific way of reaching a cheap model: a proprietary API, a generic OpenAI-compatible HTTP endpoint (Groq, Together, OpenRouter, etc.), or local Ollama. Every provider must implement the same minimal interface exported from `core` (defined in `@garrepa/core` types). Provider packages depend on `core` for that interface — never the other way around.

**`cli` — user-facing entry point**
The `npx garrepa` binary. Handles the setup wizard and any user-facing commands. Depends on `core`; delegates provider and adapter wiring to the packages that own those concerns.

## 3. Core design rules

These rules must be enforced in every PR, at every layer.

**The cheap model is text-in, text-out only.**
The cheap model never performs tool-calling and never decides which external tool to invoke. It receives plain text and returns plain text (a summary). Any fetch needed before the model sees content — reading a file, pulling a Jira ticket, fetching a Notion page — must happen in the adapter or core layer before calling the provider. The model itself never touches external APIs.

**Reuse existing MCP servers; never re-implement integrations.**
Garrepa does not build its own Jira, Notion, or Figma clients. When a fetch step is needed, garrepa acts as an MCP client and reuses the harness's existing MCP server configuration. This keeps credentials and integration logic outside garrepa entirely.

**Delegate only above a configurable threshold.**
Small content must not be delegated — the round-trip cost outweighs the benefit. The default threshold is based on content size and is user-configurable. Core enforces the check; adapters pass the size metadata.

**The provider interface lives in `core`; nothing else defines it.**
Once `@garrepa/core` exports a `Provider` interface, every `provider-*` package implements it. No provider package defines its own competing interface. Dependency direction: `provider-*` → `core`, never `core` → `provider-*`.

## 4. Conventions

- TypeScript strict mode everywhere (`strict: true`). No `any` without an inline comment explaining why it cannot be avoided.
- One package = one responsibility. No cross-package logic shortcuts.
- Test files live alongside the source they test: `src/foo.ts` → `src/foo.test.ts`.
- Commit messages follow Conventional Commits: `feat:`, `fix:`, `docs:`, `chore:`, `refactor:`, `test:`.
- Each package exports only through `src/index.ts`. Nothing else is public API.
- `dist/` is build-generated and gitignored — never commit it.

## 5. How to work in this repo

```bash
pnpm install                                    # install all workspace deps
pnpm test                                       # run all tests
pnpm --filter @garrepa/<package> test           # run one package's tests
pnpm lint                                       # lint + format check
pnpm build                                      # tsc across all packages
```

Before opening a PR: `pnpm test` and `pnpm lint` must both pass locally.

## 6. Contribution philosophy

Garrepa is designed so that adding a new harness or a new model provider requires only creating a new `adapter-*` or `provider-*` package — `core` stays untouched. If a contribution requires modifying `core` to accommodate one specific harness or vendor, that is a signal the abstraction is leaking. Flag it for discussion rather than merging it.
