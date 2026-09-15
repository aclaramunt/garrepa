---
name: garrepa-write
description: >-
  Use when about to commit changes or write a git commit message, especially
  if the diff is large or the change is straightforward. Delegates drafting
  to `garrepa write commit-message`. Never run git commit or git push via this skill.
---

When about to commit changes, if the diff is large or the change is straightforward, pipe `git diff` (or `git diff --staged`) into `garrepa write commit-message` to get a suggested commit message instead of writing one from scratch. Always review the suggested message before committing — garrepa never runs `git commit` itself.
