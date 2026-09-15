# garrepa

> A Claude Code hook that intercepts large, mechanical tool results and delegates compression to a cheap language model — so the expensive orchestrator never swallows the raw dump.

## What it does

Install garrepa in a Claude Code project. When the orchestrator is about to pull a large blob into context — a huge documentation file, a long MCP page, a bulky git dump — garrepa routes that text through a cheap model (Haiku, GPT-4o-mini, Llama via Ollama) and returns a compressed result instead.

The cheap model only receives plain text and returns plain text. It never decides which tool to call and never touches external APIs.

**Supported harness: Claude Code.** See [Community harnesses](#community-harnesses) for other harnesses.

### What gets compressed

| Trigger | What happens |
|---|---|
| `Read` on a large documentation file (`.md`, `.rst`, `.txt`, …) | PreToolUse hook injects a section map instead of the raw file. Source code, config, and lockfiles are never touched. |
| MCP tool result above threshold | PostToolUse hook compresses text and `structuredContent`. Mixed image+text results (e.g. Figma) keep screenshots intact — rasters are never sent to the cheap model. |
| `git diff` / `git log` / `git show` above threshold | PostToolUse hook on `Bash` replaces the dump with a structured briefing. The hook never drafts a commit message and never runs git. |
| `garrepa write commit-message` | Opt-in CLI command: pipe a diff on stdin, get a conventional-commits message on stdout. |
| `garrepa write pr-title` | Opt-in CLI command: pipe a diff on stdin, get a pull request title on stdout. |

## Quick start

```bash
# 1. Install the CLI
npm install -g garrepa
# or run without installing:
npx garrepa init

# 2. Run the setup wizard in your project root
cd your-project
garrepa init
```

The wizard asks for your provider (Anthropic, OpenAI-compatible endpoint, or manual) and writes two files:

- `garrepa.config.json` — provider and threshold settings
- `.claude/settings.json` — hook entries merged into your existing Claude Code config (never overwritten)

Re-running `garrepa init` is safe: it never duplicates hooks and never wipes unrelated settings.

## Configuration

`garrepa.config.json` lives at your project root:

```json
{
  "threshold": {
    "minChars": 32000
  },
  "provider": {
    "type": "anthropic",
    "model": "claude-haiku-4-5-20251001",
    "apiKeyEnvVar": "ANTHROPIC_API_KEY"
  }
}
```

### Provider options

**Anthropic (default)**

```json
{
  "provider": {
    "type": "anthropic",
    "model": "claude-haiku-4-5-20251001",
    "apiKeyEnvVar": "ANTHROPIC_API_KEY"
  }
}
```

**OpenAI-compatible endpoint** (Groq, Together, OpenRouter, …)

```json
{
  "provider": {
    "type": "openai-compatible",
    "baseUrl": "https://api.groq.com/openai/v1",
    "model": "llama-3.1-8b-instant",
    "apiKeyEnvVar": "GROQ_API_KEY"
  }
}
```

**Local Ollama** (no API key needed)

```json
{
  "provider": {
    "type": "openai-compatible",
    "baseUrl": "http://localhost:11434/v1",
    "model": "llama3.2",
    "apiKeyEnvVar": "OLLAMA_API_KEY"
  }
}
```

### Threshold

`threshold.minChars` (default `32000`) is the minimum character count before content is delegated. Content below this threshold passes through without a cheap-model round-trip.

Raise it if garrepa is intercepting content you'd rather the orchestrator read directly. Lower it to catch smaller documents.

### Excluding MCP tools

Some MCP servers return sensitive data that must not leave its trust boundary. Exclude specific tools by their exact tool name:

```json
{
  "mcp": {
    "excludeTools": ["mcp__internal_wiki__fetch_page", "mcp__private_crm__get_contact"]
  }
}
```

The tool name matches the name Claude Code uses for that MCP server tool — it follows the pattern `mcp__<server-name>__<tool-name>`. Excluded tools always pass through unchanged. When in doubt, exclude rather than risk forwarding sensitive content to an external provider.

## CLI reference

```
garrepa init                        Interactive setup wizard
garrepa init --provider anthropic   Non-interactive setup (accepts flags)
garrepa summarize <file>            Compress a file to stdout
garrepa write commit-message        Read a diff from stdin, write a commit message
garrepa write pr-title              Read a diff from stdin, write a pull request title
```

### garrepa write

`garrepa write` reads from stdin and writes to stdout. It never runs `git commit`, `git push`, or any other git command.

```bash
# Conventional-commits message from the current staged diff
git diff --staged | garrepa write commit-message

# PR title from everything not yet on main
git diff main...HEAD | garrepa write pr-title
```

**Adding more presets** is a community contribution: add an entry to `packages/cli/src/presets.ts` and open a PR. See [`CONTRIBUTING.md`](CONTRIBUTING.md).

## Verifying the install

After `garrepa init`, confirm the hooks are registered:

```bash
cat .claude/settings.json | grep -A3 garrepa
```

You should see `PreToolUse` (matcher `Read`) and `PostToolUse` (matchers `mcp__.*` and `Bash`) entries pointing at `.claude/hooks/garrepa-hook.js`.

## Troubleshooting

**Hooks are not firing**

- Confirm `.claude/settings.json` contains garrepa hook entries (see above).
- Confirm `.claude/hooks/garrepa-hook.js` exists.
- Re-run `garrepa init` — it is safe to run again and will add any missing entries.

**No compression / provider errors**

- Check that the env var named in `apiKeyEnvVar` is set in your shell (`echo $ANTHROPIC_API_KEY`).
- Garrepa always fails open: if the provider call fails, the original tool result passes through unchanged. Nothing breaks; you just don't get compression.

**garrepa is compressing a file it should not touch**

- Garrepa never compresses source code, config files, lockfiles, or secret paths (`.env*`, `*.pem`, `id_rsa`, `**/credentials*`).
- To stop garrepa from compressing a specific documentation file, raise `threshold.minChars` in `garrepa.config.json`.

**garrepa is intercepting an MCP tool it should not**

- Add the tool name to `mcp.excludeTools` in `garrepa.config.json` (see [Excluding MCP tools](#excluding-mcp-tools)).

## Packages

| Package | Role |
|---|---|
| `@garrepa/core` | Decision engine — harness-agnostic routing and provider interface |
| `@garrepa/adapter-claude-code` | **First-party** Claude Code adapter |
| `@garrepa/adapter-codex-cli` | **Community scaffold** — see below |
| `@garrepa/provider-anthropic` | Anthropic cheap-model provider |
| `@garrepa/provider-openai-compatible` | OpenAI-compatible endpoints (Groq, Together, OpenRouter, Ollama, …) |
| `@garrepa/cli` | `npx garrepa` binary |

## Community harnesses

**`@garrepa/adapter-codex-cli`** ships as an architecture scaffold for [OpenAI Codex CLI](https://github.com/openai/codex). It is not a first-party product.

What it does today: best-effort interception of simple `cat`/`head`/`tail` read patterns above threshold. What it does not do (yet): MCP compression, git dump compression, safety hardening equivalent to the Claude Code adapter.

First-party maintainers will keep the package building and tests green when shared APIs change. They will not implement Codex feature parity.

**If you want to take it further:** the scaffold is there for you. PRs that keep Codex concerns inside `@garrepa/adapter-codex-cli` and do not touch `@garrepa/core` are welcome. See [`CONTRIBUTING.md`](CONTRIBUTING.md) for the abstraction rules.

**Adding support for a different harness** (Cursor, Windsurf, …) follows the same pattern: one `adapter-<harness>` package, all harness-specific knowledge inside it, `@garrepa/core` stays untouched.

## Development

```bash
pnpm install
pnpm build
pnpm test
pnpm lint
```

Agent and contributor rules: [`AGENTS.md`](AGENTS.md) / [`CLAUDE.md`](CLAUDE.md). How to contribute: [`CONTRIBUTING.md`](CONTRIBUTING.md).

## License

MIT
