---
description: >
  Where throwaway clones, worktrees, and scratch files must live. Applies everywhere, because
  cloning another repo to review a PR happens from any file in this workspace.
applyTo: "**"
---

# Scratch space stays inside this workspace

Never clone, `git worktree add`, or check out another repository outside the root of the
workspace folder you have open. That means no `~/dev/rvXXX`, no sibling folder under
`~/dev/`, no bare `/tmp/...`.

Paths outside the open workspace root are untrusted, so every tool call that touches them
fires a permission prompt. That's true even when the thing being cloned is a completely
unrelated repo (e.g. reviewing a PR in `web-storefront-engine` from a session opened in this
`central-command` workspace).

## Use `tmp/` in this workspace instead

- `tmp/` at the repo root is gitignored and exists for exactly this purpose.
- Clone into it: `git clone ... tmp/rv2442-engine`
- Or add a worktree into it: `git worktree add tmp/rv472-web-lib-RRS <branch>`
- Reuse a scratch clone across review rounds instead of re-cloning: keep
  `tmp/rv<pr>` and `tmp/rv<repo>main` around with `node_modules` already installed, and just
  `git checkout -q <newHead>` when the manifest hasn't changed.
- Nothing under `tmp/` is committed; treat it as disposable, but there's no need to delete it
  between sessions.
