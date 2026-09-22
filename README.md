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

## Weekly report (timesheet + summary)

In VS Code Chat, ask for the weekly report (e.g. "do my weekly report", "generate this
week's timesheet and summary"). This uses the `weekly-report` skill
(`.github/skills/weekly-report/SKILL.md`), which:

- Reads this week's Jira/GitHub activity from the local mirror (`data/central-command.db`) —
  no live API calls.
- Produces a timesheet that always totals **8 hours per work day**, split across whatever
  tickets/PRs the mirror shows for that day. The hours are a guesstimate, not tracked time —
  accuracy is not the goal.
- Produces a short narrative summary (Shipped / In progress / Blocked).
- Saves both to `reports/<ISO-week>.md` (e.g. `reports/2026-W37.md`) and prints them in chat.

`reports/` is gitignored — it holds personal artifacts, not project source.

The skill is discoverable because `.vscode/settings.json` adds `.github/skills` to
`chat.agentSkillsLocations` alongside the shared `.copilot-config/skills`.

## Development

```bash
npm run verify   # guards, typecheck, tests — run before every commit
```
