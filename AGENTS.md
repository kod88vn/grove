# AGENTS.md — bot

> Project layer. This file states **what is true here**. The shared layer
> (`web-storefront-copilot-config`) states **how to work** and must never assert a version,
> path, or command. Read this file plus `STACK.md` before answering any factual question.

## What This Is

A personal automation agent that watches my Jira tickets, branches, and PRs, reports what
needs attention, and — only where I have pre-approved it — acts. It runs hourly under
`launchd` outside quiet hours, records everything it does to SQLite, and exposes a local
dashboard for control and audit.

It is **not** a CI system, **not** a shared service, and **not** something that mutates
anything by default. The design document is [DESIGN.md](DESIGN.md).

## Current Status — read this before assuming anything exists

**No application code exists yet.** The repository contains design documents only.
Phase P0 creates `package.json`, the TypeScript toolchain, and the directory tree described
in DESIGN.md §5. Do not reference a script, module, or command as if it were present —
check first.

Sequencing lives in [agent-docs/superpowers/plans/2026-08-28-bot-roadmap.md](agent-docs/superpowers/plans/2026-08-28-bot-roadmap.md).
Two boundaries govern everything: **P0–P5 is the POC and is entirely read-only**, and
**nothing mutates anything until P9**.

## Commands

| Task | Command | Exists? |
| --- | --- | --- |
| Install | `npm install` | No — P0 |
| Run one task | `npx tsx scripts/<task>.ts` | No — P4 |
| Test | `npm test` (Vitest) | No — P0 |
| Typecheck | `npm run typecheck` | No — P0 |
| Architecture guard | `node .copilot-config/scripts/arch-check.mjs` | Yes |
| Quality guard | `node .copilot-config/scripts/quality-check.mjs` | Yes |
| Validate customizations | `node .copilot-config/scripts/validate-customizations.mjs "$PWD"` | Yes |

The guards ship as plain `node` scripts with no dependencies, so they run before `package.json`
exists; P0 wraps them in npm scripts. They read `ai-guard.config.json` **from the repo root** —
an absent config is a hard error by design ("an unconfigured guard is a guard that lies").

## Key Files

| Purpose | Path |
| --- | --- |
| Design document (canonical) | `DESIGN.md` |
| Verified-fact ledger | `STACK.md` |
| Glossary | `CONTEXT.md` |
| Guard policy | `ai-guard.config.json` |
| Roadmap | `agent-docs/superpowers/plans/2026-08-28-bot-roadmap.md` |
| AI document root | `agent-docs/` |
| Shared Copilot config | `.copilot-config/` (submodule) |
| Chat discovery paths | `.vscode/settings.json` |

### Copilot config integration

Both modes from the shared repo's README are active, deliberately:

- **Mode B (this repo).** `.copilot-config` is a git submodule of
  `web-storefront-copilot-config`, pinned at `b799aef`, and `.vscode/settings.json` points
  `chat.agentSkillsLocations`, `chat.instructionsFilesLocations`, and `chat.promptFilesLocations`
  at it alongside the repo-local `.github/*` paths. This is what makes the guard scripts and the
  config version reproducible for anyone who clones this repo.
- **Mode A (this machine).** `~/.copilot/skills`, `~/.copilot/instructions`, and the VS Code
  user `prompts` folder are already symlinked into the same upstream clone by its `install.sh`.

Mode B pins a commit, so new shared content does not arrive until the pointer is bumped with
`git submodule update --remote .copilot-config`. The pin must always include `agents/`,
`instructions/`, and `prompts/` — pinning below that silently resolves all three configured
paths to nothing, with no error. That outage has already happened in three other repositories.

## Platform-Managed Files — DO NOT MODIFY

- `data/` — SQLite database, WAL and SHM sidecars, migrations output. Gitignored.
- `reports/` — generated report output. Gitignored.
- `~/Library/LaunchAgents/com.jayquach.bot.*.plist` — generated from the template by
  `launchd/install.sh`. Edit the template, not the installed copy.
- `.copilot-config/` — owned by the central config repo; change it there via PR, then bump the
  submodule pointer here. Never commit an edit made inside the submodule from this repo.

## Project Patterns

These are the invariants from DESIGN.md §19, restated as absolutes.

- **Tasks are pure.** A task observes and proposes. Only the executor causes side effects.
  Break this and the whole audit trail becomes a guess.
- **The default is queue.** An action is performed only if a rule explicitly allows it.
  Absence of a rule is never permission.
- **The denylist is compiled in and not overridable by config.** Pushing to `main`, `--force`,
  `--no-verify`, `reset --hard`, deleting branches, committing on a branch the bot did not
  create, and opening a PR with no Jira link are prohibited regardless of configuration.
- **Every pre-approval carries an expiry and a rate limit.** A grant with neither is a
  permanent grant, which is what this system exists to avoid.
- **Every applied action is traceable to the rule that authorized it.** If you cannot name
  the rule, the action must not run.
- **`src/core/` imports no vendor package, no connector, and no Node builtin.** Enforced by
  `ai-guard.config.json`.
- **The dashboard is a control panel, never a runtime dependency.** Cron must work with the
  dashboard shut down.
- **Repository facts are verified before code depends on them.** See `STACK.md`.
- **Suppressed is not missed.** Quiet-hour slots are never caught up. Missed slots coalesce
  into exactly one catch-up run, never a replay burst.
- **The queue is a query, not a table.** Never introduce a second structure holding rows that
  already exist in `actions`.
- **The bot never invokes a language model.** No phase may add one. Judgment work is prepared
  by the bot as a `chat:handoff` and initiated by a human in VS Code Chat.

## Grounding — the expensive failures in this repo

The shared `grounding.instructions.md` applies. Three specifics that have already bitten:

1. **`launchd`.** `StartInterval` silently loses runs across sleep. Use `StartCalendarInterval`.
   Cited in `STACK.md`.
2. **`node:sqlite`.** Stable and unflagged in Node v24.18.0 despite widespread documentation
   to the contrary. Do not add `--experimental-sqlite`.
3. **Jira and GHE shapes are unverified.** `STACK.md` has a "NOT YET VERIFIED" section.
   Do not write parsing code against a remembered response shape.
4. **The Copilot CLI is installed but blocked by org policy.** `copilot --version` succeeds,
   which makes it look available; every `-p` invocation returns `Access denied by policy
   settings`. There is no headless LLM on this machine and no alternative agent CLI installed.
   Never design a step that calls a model unattended. See DESIGN.md §13.

## Validation Checklist

Run before every claim of completion. Paste real output; never summarize it.

```bash
node .copilot-config/scripts/validate-customizations.mjs "$PWD"
node .copilot-config/scripts/arch-check.mjs
node .copilot-config/scripts/quality-check.mjs
```

Once P0 lands, add `npm run typecheck` and `npm test` to the same block.

## Git

- Never commit to `main`. Current working branch: `feature/bot-poc-scaffold`.
- Run `git rev-parse --abbrev-ref HEAD` before every commit.
- Every PR carries a Jira link (`https://jira.corp.clover.com/browse/WS-XXXX`) and the ticket
  is assigned to `jay.quach`.
- Use `gh` for PRs. Remote protocol is SSH.
