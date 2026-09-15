> **Mirror notice:** This file is identical to `AGENTS.md`. Always edit both together — never update just one.

# garrepa — Agent Guidelines

## 1. What garrepa is

Garrepa is a router that installs as a hook inside **Claude Code** and intercepts large, mechanical tool results — a big file, a Notion/Jira page fetched via MCP, a bulky git dump — so a cheap language model (Haiku, GPT-4o-mini, Llama via Ollama) compresses them before they fill the expensive orchestrator’s context.

The orchestrator stays focused on reasoning and edits. Garrepa handles the grunt work.

**Claude Code is the only first-party harness.** All product work, security hardening, and feature completeness happen in `@garrepa/adapter-claude-code`. `@garrepa/adapter-codex-cli` is a community scaffold: keep it compiling, do not grow it in first-party work.

## 2. Product goals (Claude Code)

First-party work aims for these capabilities, each at production quality and with the safety rules in §3:

| Surface | Intent |
|---|---|
| Large files | Intercept oversized reads so the orchestrator sees a useful compression, not a raw dump. Never starve an edit: source the agent needs to change must still be readable (respect `Read` offset/limit; do not summarily block typical source files). |
| MCP documents | When the harness fetches a large page/ticket/spec through an existing MCP server, compress the payload before it lands in the expensive context. Reuse the harness’s MCP config — never re-implement Jira/Notion/Figma clients. |
| Git | Keep huge `git diff` / `log` / `show` output out of the orchestrator; optional cheap drafting (`garrepa write`) stays opt-in and never runs `git commit` / `git push`. |

MCP text, `structuredContent`, mixed image+text, and large `git diff` / `log` / `show` dumps are compressed in the Claude adapter (Figma screenshots kept, rasters never sent to the cheap model). Screenshot-only MCP results pass through. New MCP/git work belongs in that adapter (and shared `core` only when the logic is harness-agnostic).

## 3. Architecture

### Package layout

```
packages/
  core/                       @garrepa/core                       Decision engine (harness-agnostic)
  adapter-claude-code/        @garrepa/adapter-claude-code        First-party Claude Code adapter
  adapter-codex-cli/          @garrepa/adapter-codex-cli          Community scaffold — do not expand first-party
  provider-anthropic/        @garrepa/provider-anthropic         Anthropic cheap-model provider
  provider-openai-compatible/ @garrepa/provider-openai-compatible   OpenAI-compatible endpoints
  cli/                        @garrepa/cli                        npx garrepa binary
```

### What logic belongs where

**`core` — decision engine**
Decides whether content should be delegated (threshold and shared rules), calls the selected provider, and returns compressed text. Must stay 100% agnostic: zero imports of a harness (Claude Code, Codex CLI) or a vendor SDK. If you need a Claude- or Codex-specific import here, stop and restructure.

**`adapter-claude-code` — first-party harness layer**
All Claude Code knowledge lives here: hook payload shapes, `.claude/settings.json`, skill paths, `Read` / MCP / Bash semantics, fail-open behaviour, install/merge of user settings. Feature work belongs here.

**`adapter-codex-cli` — community scaffold**
Translates Codex CLI hooks into `core` calls. First-party changes are limited to keeping the package building and tests green, or fixing breakage from shared API changes. New Codex features, pattern coverage, and MCP/git interception are community PRs. Those PRs must not leak Codex types or shell-parsing into `core`.

**`providers/*` — model calling layer**
Each package wraps one way to reach a cheap model. Every provider implements the `Provider` interface exported from `@garrepa/core`. Dependency direction: `provider-*` → `core`, never the reverse.

**`cli` — user-facing entry point**
The `npx garrepa` binary (`init`, `summarize`, `write`). Default harness is Claude Code. Codex `init` may remain so community users can wire the scaffold; it is not a commitment to first-party Codex support.

## 4. Core design rules

Enforce these in every PR, at every layer.

**The cheap model is text-in, text-out only.**
It never tool-calls and never chooses which external tool to invoke. Fetching (files, MCP, git) happens in the adapter (or shared helpers in `core` that are still harness-agnostic) *before* `Provider.summarize`. The model itself never touches external APIs.

**Reuse existing MCP servers; never re-implement integrations.**
Garrepa does not ship Jira, Notion, or Figma clients. Credentials and integration logic stay in the harness’s MCP configuration.

**Delegate only above a conservative, configurable threshold.**
Small content must not be delegated — the round-trip is a net loss. Defaults must be high enough that normal source files are not intercepted. Core enforces the size check; adapters pass size metadata (and must not ignore `Read` limit/offset when those bound the bytes that would enter context).

**The provider interface lives in `core`; nothing else defines it.**
`provider-*` packages implement it. Never the other way around.

### Safety rules (Claude adapter and anything that can block a tool)

These are product requirements, not optional polish. Prefer failing open over surprising the user.

1. **Fail-open.** A hook crash, timeout, unreadable file, missing config, or provider error must *allow* the original tool call. Never `process.exit(1)` on the PreToolUse path in a way that can block the harness. Unexpected exceptions are allow, not deny.
2. **Never clobber user config.** Install must merge into `.claude/settings.json` (and never rewrite a file it cannot parse). Invalid JSON → abort with a clear error, do not overwrite with `{}`.
3. **Do not starve edits.** Do not deny a `Read` whose requested window (`offset`/`limit`) is under threshold. Do not replace code the agent is likely about to edit with a summary. Summaries are for bulky, mechanical content — not for “any file longer than N chars”.
4. **Bound I/O.** Do not `readFileSync` unbounded blobs into the hook just to measure size. Stat / cap first. Cap bytes sent to the cheap-model provider.
5. **Do not ship secrets to the cheap model.** Deny-list paths such as `.env*`, `*.pem`, `id_rsa`, `**/credentials*`, `**/secrets/**`. When in doubt, allow the original tool rather than upload.
6. **Stable, quoted hook commands.** Do not depend on a vanishing npx cache path. Quote paths so spaces cannot break the hook.
7. **Install is additive.** Re-running `garrepa init` must not duplicate hooks and must not wipe unrelated hooks, permissions, or MCP config.

## 5. Conventions

- TypeScript strict mode everywhere (`strict: true`). No `any` without an inline comment explaining why it cannot be avoided.
- One package = one responsibility. No cross-package logic shortcuts.
- Test files live alongside the source they test: `src/foo.ts` → `src/foo.test.ts`.
- Commit messages follow Conventional Commits: `feat:`, `fix:`, `docs:`, `chore:`, `refactor:`, `test:`.
- Each package exports only through `src/index.ts`. Nothing else is public API.
- `dist/` is build-generated and gitignored — never commit it.

## 6. How to work in this repo

```bash
pnpm install                                    # install all workspace deps
pnpm test                                       # run all tests
pnpm --filter @garrepa/<package> test           # run one package's tests
pnpm lint                                       # lint + format check
pnpm build                                      # tsc across all packages
```

Default local loop for product work: `@garrepa/adapter-claude-code` plus `core` / `cli` as needed. Keep `@garrepa/adapter-codex-cli` tests passing when you change shared APIs; do not add Codex features in the same PR as Claude work.

Before opening a PR: `pnpm test` and `pnpm lint` must both pass locally.

## 7. Contribution philosophy

- **Claude Code PRs** are the product. Completeness and safety land there first.
- **New cheap-model providers** are welcome as `provider-*` packages that implement `@garrepa/core`’s `Provider` interface.
- **Codex CLI (and other harnesses)** are welcome as community adapter packages. They must not require `core` to know about that harness. First-party maintainers will review for abstraction leaks and safety (fail-open, no settings clobber) but will not treat Codex feature parity as a release blocker.
- If a contribution requires modifying `core` to accommodate one specific harness or vendor, that is an abstraction leak. Flag it rather than merging it.
