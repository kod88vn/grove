# central-command

Personal work tracker: mirrors Jira and GitHub locally, detects stalled work, and surfaces
the next move. See [AGENTS.md](AGENTS.md) and [DESIGN.md](DESIGN.md) for the full picture.

This repository is local only — no remote, no `main`, no push, no PRs.

## Setup

```bash
npm install
npm run cc -- doctor   # checks credentials and connectivity
```

## Everyday commands

| Task | Command |
| --- | --- |
| Refresh the mirror | `npm run cc -- sync all` |
| What has stopped moving | `npm run cc -- stalls` |
| Resolve tickets whose PR merged | `npm run cc -- resolve` (add `--apply` to mutate) |
| Dashboard | `npm run dashboard` → http://127.0.0.1:4747 |
| MCP server (for VS Code Chat) | `npm run cc -- mcp` |

`cc resolve` is dry-run by default — it only lists candidates. Nothing is mutated until you
add `--apply`.

## Development

```bash
npm run verify   # guards, typecheck, tests — run before every commit
```
