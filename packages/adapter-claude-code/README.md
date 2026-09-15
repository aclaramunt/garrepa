# @garrepa/adapter-claude-code

First-party garrepa adapter for [Claude Code](https://code.claude.com). This is the only harness the project develops and hardens in-tree.

It translates Claude Code hook events into `@garrepa/core` decisions so large, mechanical tool results can be compressed by a cheap model instead of filling the orchestrator context.

## Product surface

| Goal | Status |
|---|---|
| Large file reads (`Read`) | PreToolUse hook. **Never compresses source code.** Compresses only very large documentation (`.md`, `.rst`, `.txt`, …) in-hook. |
| MCP documents (Notion, Jira, Figma, …) | PostToolUse hook. Reuses existing MCP servers. Large text/`structuredContent` is compressed; mixed image+text keeps screenshots intact and never sends rasters to the cheap model. Malformed siblings are skipped. Screenshot-only results pass through. |
| Git dumps / optional `garrepa write` | PostToolUse on `Bash` after `git diff` / `log` / `show`. Skill + CLI for commit-message drafting remain opt-in and never run `git commit` / `git push`. |

Safety requirements (fail-open, no settings clobber, do not starve edits, bound I/O, secret path denylist) live in the repo [`AGENTS.md`](../../AGENTS.md) / [`CLAUDE.md`](../../CLAUDE.md).

## Hook mechanism

Claude Code exposes a dedicated `Read` tool. `garrepa init` registers a `PreToolUse` hook in `<project>/.claude/settings.json` with matcher `Read`.

Current loop:

1. Receive a `PreToolUse` payload on stdin.
2. Ignore non-`Read` tools (pass through).
3. Allow immediately unless the path is documentation (never source, config, lockfiles, or secrets).
4. If the effective `Read` window (`offset`/`limit`, or whole file) is below `garrepa.config.json` `threshold.minChars` (default 32k), allow.
5. Otherwise read a capped window, summarize in-process with the cheap model, and deny the original `Read` while injecting a documentation map via `additionalContext`.
6. On any error, timeout, or a summary that is not shorter than the source, allow the original `Read`.

The hook never tells the model to run `garrepa summarize` over Bash.

### MCP response compression

`garrepa init` also registers `PostToolUse` with matcher `mcp__.*`. After a
successful MCP call, Garrepa replaces a sufficiently large result with a
structured briefing through Claude Code's `updatedToolOutput`; it does not
call or reimplement the MCP server.

Accepted shapes are one or more `{ "type": "text" }` blocks and/or
`structuredContent` (object, array, or JSON string), including mixed payloads
that also contain `image` / `resource` / `resource_link` blocks (typical Figma
`get_design_context`). Malformed blocks are skipped. Text embedded in
`resource.resource.text` is compressed; the resource block is copied through.
Opaque blocks are otherwise copied unchanged. The cheap model receives a
plumbing-pruned **text** copy only — never image bytes — and must keep tool
handles (page/issue/view/node IDs, URLs, keys). Figma tools use a design-map
instruction so node IDs are not dropped as plumbing. The rebuilt output keeps
those opaque blocks and a single text briefing; `structuredContent` is not
left beside the briefing.

Errors, screenshot-only or resource-link-only results, secret-like content, and
empty extractions pass through unchanged. Provider failures, timeouts, and
summaries without a net size reduction also fail open.

### Git dump compression

`garrepa init` also registers `PostToolUse` with matcher `Bash` and
`if: "Bash(git *)"`. After a successful `git diff`, `git log`, or `git show`,
Garrepa replaces a sufficiently large `stdout` with a briefing through
`updatedToolOutput`, preserving the Bash shape
(`stdout` / `stderr` / `interrupted` / `isImage`). Compound shell, writes
(`commit` / `push` / …), secret paths, and image results pass through. This is
not `garrepa write`: the hook never drafts a commit message and never runs git.

The replacement value must match the Bash output schema or Claude Code ignores
it; if the harness drops the replace, the original dump still reaches the
model (fail-open).

## Config

Shared project file: `garrepa.config.json` (see `@garrepa/core`).

Claude Code projects can prevent delegation for exact MCP tool names:

```json
{
  "mcp": {
    "excludeTools": ["mcp__private_server__fetch"]
  }
}
```

MCP text sent for compression goes to the cheap-model provider configured in
this file. Garrepa applies conservative secret guards, but they cannot replace
an access-control or data-classification policy; exclude tools whose responses
must never leave their original trust boundary.

## Hook registration

`garrepa init` (default harness `claude-code`) merges `PreToolUse` (`Read`) and
`PostToolUse` (`mcp__.*` and `Bash` git dumps) entries into `.claude/settings.json`, writes a stable
launcher at `.claude/hooks/garrepa-hook.js`, and installs the `garrepa-write`
skill under `.claude/skills/`. Install is additive: no duplicate hooks, no
wiping unrelated settings. Invalid `.claude/settings.json` aborts without
overwrite.
