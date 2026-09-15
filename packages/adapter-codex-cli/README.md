# @garrepa/adapter-codex-cli

Community scaffold for [OpenAI Codex CLI](https://github.com/openai/codex).

**This package is not first-party product.** Garrepa’s supported harness is Claude Code (`@garrepa/adapter-claude-code`). This adapter exists so the architecture stays “one harness = one adapter package” and so the community can take Codex further without touching `core`.

First-party maintainers will keep the package building and tests green when shared APIs change. They will not implement Codex feature parity (MCP, git interception, richer shell parsing, safety hardening beyond what already exists).

If you want Codex to work well, this is the package to fork or send PRs against. Do not add Codex-specific types or shell parsing to `@garrepa/core`.

## What it does today

Codex CLI has no dedicated file-read tool. The model reads files via the `Bash` shell tool (unified exec). This adapter uses **best-effort** pattern matching on the command string (`cat`, `head`, `tail`, …) and, on a match above threshold, denies the tool and asks the model to run `garrepa summarize`.

## Limitations (read before using)

- **Uncommon read commands are missed** (`rg --passthru`, `awk`, `sed -n p`, …) — they pass through.
- **Piped or chained commands are missed** (`cat file | grep pattern`, `cat file && echo done`). Any shell metacharacter is a deliberate pass-through: false positives (blocking a real compound command) are worse than false negatives.
- **Quoted or space-containing paths are missed** — tokenization is whitespace-only.
- **MCP, git, and safety work that lands on Claude are not ported here** unless a community PR does it inside this package.

## Hook mechanism

Source: [Codex hooks](https://developers.openai.com/codex/hooks). Shell / unified exec is `Bash` with `tool_input.command`. Older builds used `exec_command` and `tool_input.cmd`; the adapter accepts both.

1. `PreToolUse` on stdin when `tool_name` is `Bash` (or legacy `exec_command`).
2. Inspect `tool_input.command` (or legacy `cmd`) for a simple read pattern (`parse-read-command.ts`).
3. If matched, read the file and check `threshold`.
4. Deny via `permissionDecision: "deny"` and point at `garrepa summarize` when above threshold.

## Config

Same `garrepa.config.json` as the Claude adapter. Optional Codex-only `readCommands` allowlist:

```json
{
  "threshold": { "minChars": 32000 },
  "provider": { "type": "anthropic", "apiKeyEnvVar": "ANTHROPIC_API_KEY" },
  "readCommands": ["cat", "head", "tail", "less", "more", "bat", "rg"]
}
```

Default `readCommands`: `cat`, `head`, `tail`, `less`, `more`, `bat`.

## Hook registration

`garrepa init --harness codex-cli` writes `<project>/.codex/hooks.json` and a skill under `.agents/skills/`. Community users can use that path; it is not the default `init` harness.

```json
{
  "hooks": {
    "PreToolUse": [
      {
        "matcher": "^Bash$",
        "hooks": [
          { "type": "command", "command": "node /path/to/pre-tool-use-hook.js", "timeout": 30 }
        ]
      }
    ]
  }
}
```
