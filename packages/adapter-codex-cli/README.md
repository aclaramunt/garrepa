# @garrepa/adapter-codex-cli

Garrepa adapter for [OpenAI Codex CLI](https://github.com/openai/codex). Intercepts
large file reads before they consume the orchestrator's context window, delegating
summarization to a cheap model via `@garrepa/core`.

## Limitations (read before using)

**This adapter uses best-effort pattern matching on `exec_command`** because Codex CLI
has no dedicated file-read tool yet (as of September 2026). The model reads files by
running shell commands (`cat`, `head`, `tail`, etc.) through `exec_command`, so garrepa
inspects the command string to detect reads.

What this means in practice:

- **It will miss reads done via uncommon commands** (`rg --passthru`, `awk`, `sed -n p`,
  paged output through `pv`, etc.) — those pass through unintercepted.
- **It will miss reads with piped or chained commands** (`cat file | grep pattern`,
  `cat file && echo done`) — any shell metacharacter causes the command to pass through
  unchanged. This is intentional: false positives (blocking a legitimate compound
  command) are worse than false negatives.
- **It will miss reads with quoted or space-containing paths** — simple whitespace
  tokenization is used; quoted arguments are not parsed.

Compare this to `@garrepa/adapter-claude-code`, which hooks the dedicated `Read` tool
and has no equivalent ambiguity.

**Contributions to expand pattern coverage are welcome.** Add entries to the
`readCommands` config field (see below) or open a PR with better parsing logic.

## Hook mechanism

Source references (openai/codex repository):
- Payload schema: `codex-rs/hooks/src/schema.rs` — `PreToolUseCommandInput`
- Config format: `codex-rs/config/src/hook_config.rs` — `HooksFile`
- File location: `codex-rs/hooks/src/engine/discovery.rs` — `load_hooks_json`

The hook:
1. Receives a `PreToolUse` event on stdin when `tool_name === "exec_command"`.
2. Inspects `tool_input.cmd` for a simple read pattern.
3. If matched, reads the target file and checks its size against the threshold.
4. Blocks the tool call (via `permissionDecision: "deny"`) and instructs the model
   to call `garrepa summarize <file>` instead when the file is above threshold.

## Config

Garrepa uses the same `garrepa.config.json` file as `@garrepa/adapter-claude-code`.
Add a `readCommands` array to extend the pattern allowlist:

```json
{
  "threshold": { "minChars": 2000 },
  "provider": { "type": "anthropic", "apiKeyEnvVar": "ANTHROPIC_API_KEY" },
  "readCommands": ["cat", "head", "tail", "less", "more", "bat", "rg"]
}
```

Default `readCommands`: `cat`, `head`, `tail`, `less`, `more`, `bat`.

## Hook registration

`garrepa init --harness codex-cli` writes a `PreToolUse` entry to
`<project>/.codex/hooks.json`:

```json
{
  "hooks": {
    "PreToolUse": [
      {
        "matcher": "^exec_command$",
        "hooks": [
          { "type": "command", "command": "node /path/to/pre-tool-use-hook.js", "timeout": 30 }
        ]
      }
    ]
  }
}
```
