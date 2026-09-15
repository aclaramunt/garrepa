# Contributing to garrepa

## Before you start

Read [`AGENTS.md`](AGENTS.md) — it is the single source of truth for architecture rules, safety requirements, and what belongs in each package. The short version:

- **Claude Code** is the first-party product. New features and safety work go in `@garrepa/adapter-claude-code`.
- **Codex CLI** is a community scaffold. PRs that keep it building and tests green are welcome; first-party maintainers will not add Codex features. See [Community harnesses](#community-harnesses) in the README.
- **`@garrepa/core`** must stay 100% harness-agnostic. No Claude Code or Codex imports there.
- **New cheap-model providers** are welcome as `provider-*` packages that implement the `Provider` interface from `@garrepa/core`.
- **New `garrepa write` presets** are welcome. Add an entry to `packages/cli/src/presets.ts` and document it in the README.

## Local setup

```bash
pnpm install       # install all workspace dependencies
pnpm build         # compile all packages
pnpm test          # run all tests
pnpm lint          # eslint + format check
```

`pnpm build`, `pnpm test`, and `pnpm lint` must all pass before opening a PR.

## What makes a good PR

- **One responsibility per PR.** A bug fix in `core` should not include unrelated Codex changes.
- **Test files live alongside source:** `src/foo.ts` → `src/foo.test.ts`.
- **TypeScript strict mode** — no `any` without an inline comment explaining why it cannot be avoided.
- **Commit messages follow [Conventional Commits](https://www.conventionalcommits.org/):** `feat:`, `fix:`, `docs:`, `chore:`, `refactor:`, `test:`.
- **Exports only through `src/index.ts`.** Nothing else is public API.

## Safety checklist

Every PR that touches the Claude Code adapter or anything on the PreToolUse / PostToolUse path must verify all of the following:

- [ ] **Fail-open.** Crashes, timeouts, and provider errors allow the original tool call. No `process.exit(1)` that can block the harness.
- [ ] **No settings clobber.** Install merges into `.claude/settings.json`. Invalid JSON aborts; it never overwrites with `{}`.
- [ ] **Do not starve edits.** A `Read` within `offset`/`limit` that is under threshold must not be intercepted. Do not block content the agent is likely about to edit.
- [ ] **Bounded I/O.** Stat or cap before reading large content into memory. Cap bytes sent to the provider.
- [ ] **Secret denylist respected.** Paths matching `.env*`, `*.pem`, `id_rsa`, `**/credentials*`, `**/secrets/**` pass through unchanged.
- [ ] **Install is idempotent.** Re-running `garrepa init` must not duplicate hooks or wipe unrelated settings.

## Abstraction leak rule

If your change requires `@garrepa/core` to import from a specific harness or vendor, that is an abstraction leak. Flag it in the PR rather than merging it. The dependency direction must stay: `adapter-*` → `core`, `provider-*` → `core`, never the reverse.

## Filing issues

Bug reports and feature requests are welcome as GitHub Issues. Include:

- What you expected to happen.
- What actually happened (paste the relevant hook output if available).
- Your `garrepa.config.json` with API keys redacted.
- Your Claude Code version (`claude --version`).
