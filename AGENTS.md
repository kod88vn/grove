# AGENTS.md — central-command

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

The POC is built and works against live data. `cc sync` mirrors Jira, GitHub and local
branches; `cc stalls` and the dashboard report what has stopped moving; `cc resolve` closes
tickets whose code already shipped; `cc serve` offers Merge and Resolve buttons behind the
guards; `cc mcp` answers questions in Chat, read-only.

The Jira write path is **verified**: five tickets were resolved through the executor on
2026-08-31 and read back from Jira. Merging a PR is still unproven — it cannot be tested
without really merging something.

What is **not** built: `launchd` scheduling, the chat handoff, notifications, and pre-approval
rules with expiry and rate limits. Nothing runs unattended yet — every mutation today needs a
button press.

Sequencing lives in [agent-docs/superpowers/plans/2026-08-28-central-command-roadmap.md](agent-docs/superpowers/plans/2026-08-28-central-command-roadmap.md).

## Commands

| Task | Command |
| --- | --- |
| Install | `npm install` |
| Everything below at once | `npm run verify` |
| Test | `npm test` (Vitest) |
| Typecheck | `npm run typecheck` |
| All three guards | `npm run guards` |
| Architecture guard | `npm run arch` |
| Quality guard | `npm run quality` |
| Validate customizations | `npm run customizations` |

**`npm run verify` is the gate.** Run it before claiming anything is done, and paste the real
output rather than summarizing it.

## The step gate — mechanical, not advisory

Work in this repository moves one step at a time, and a step finishes only when the repository
says so. This is enforced by a git hook and two database constraints, not by this paragraph.

| Task | Command |
| --- | --- |
| Define a step | `npm run cc -- step add "<title>" [--ticket=WS-1234]` |
| Begin it | `npm run cc -- step start <id>` |
| Earn the stamp | `npm run cc -- step stamp` |
| See the ledger | `npm run cc -- step status` |
| Drop it | `npm run cc -- step abandon <id>` |

The loop is: **start → work → stamp → commit.** Nothing else is available.

### What the machine enforces

- **`step stamp` does not accept a claim.** It runs `npm run verify` itself and reads the exit
  code. Non-zero writes nothing. `step_stamps.exit_code` is `CHECK (exit_code = 0)`, so a
  failing run cannot be stored as a pass even by a caller trying to.
- **A stamp is bound to the tree that earned it.** It records a SHA-256 over every file git can
  see under `src`, `bin`, `scripts`, `dashboard`, `package.json`, `tsconfig.json` and
  `ai-guard.config.json`. Edit any of them and the stamp no longer matches, so the step is
  unstamped again. Stamp-then-edit is not a policy violation; it is arithmetic.
- **`.githooks/pre-commit` refuses the commit** unless a step is in progress and holds a stamp
  for this exact tree. It prints the one command that clears the refusal.
- **`.githooks/post-commit` is the only writer of `done`,** using the SHA git just produced.
  `work_steps` has `CHECK (state <> 'done' OR sealed_commit IS NOT NULL)`, so a finished step
  without a commit behind it cannot exist in the database.
- **One step in progress at a time**, via a partial unique index on `state = 'doing'`.

### Rules for agents working here

1. Do not report a step complete. Run `npm run cc -- step stamp` and paste its output. The
   stamp is the report.
2. If the gate refuses, run the command it printed. Do not explain the refusal, do not work
   around it, and do not ask for it to be waived.
3. `--no-verify` is on the compiled-in denylist (`src/core/policy/denylist.ts`). Never suggest
   it, in any phrasing, for any reason.
4. If a step turns out to be wrong, `step abandon <id>` and add a new one. Abandoning is a
   normal outcome and costs nothing. Redefining "done" is not available.

### The limits, stated plainly

A determined human can run `git commit --no-verify` or `git config core.hooksPath ''`. This
gate stops drift, forgetfulness, and an agent's confident summary — not sabotage. It also
covers the working tree rather than the index, so if you stage a subset of your changes, the
stamp attests to what is on disk, not to what is being committed. Stage everything, or know
the difference.

### Running it

| Task | Command |
| --- | --- |
| Check credentials and connectivity | `npm run cc -- doctor` |
| Refresh the mirror | `npm run cc -- sync all` |
| What has stopped moving | `npm run cc -- stalls` (add `--all` to lift the per-group cap) |
| Tickets whose PR merged | `npm run cc -- resolve` (lists; `--apply` resolves; takes an optional key) |
| Dashboard | `npm run cc -- serve` → http://127.0.0.1:4747 |
| MCP server (stdio) | `npm run cc -- mcp` |

### Finish the loop

**Work is not done when the code is written. It is done when the ticket is closed.**

This project exists because that gap is where work rots: a PR merges, everyone moves on, and
the ticket stays Open as a false signal about project state. Seven such tickets were sitting
in Jira the day this was built.

So, for any change in any repository:

- Merged the PR? Resolve the ticket in the same session. Do not leave it for later.
- Opened a ticket? Assign it to yourself at creation and close it when its PR merges.
- Finished a task here? `npm run cc -- resolve` before you stop, and act on what it reports.

A refusal is a finished loop too. `pr-not-merged` and `already-done` are correct answers, not
failures — what is forbidden is walking away without looking.

The guards are plain `node` scripts with no dependencies and read `ai-guard.config.json` from
the repo root — an absent config is a hard error by design ("an unconfigured guard is a guard
that lies").

## Layout

| Layer | Path | Rule |
| --- | --- | --- |
| 0 | `src/core/` | Pure. No vendor package, no Node builtin, not even a clock. |
| 1 | `src/stalls/` | Pure. The eighteen rules and their context. |
| 2 | `src/store/` | SQLite mirror, migrations, repositories. |
| 3 | `src/connectors/` | Jira, GitHub (`gh`), git. The only code that talks outward. |
| 4 | `src/sync/`, `src/executor/` | Orchestration. The executor is the only writer. |
| 5 | `bin/`, `dashboard/`, `src/config/`, `src/mcp/` | Entry points. |

## Key Files

| Purpose | Path |
| --- | --- |
| Design document (canonical) | `DESIGN.md` |
| Verified-fact ledger | `STACK.md` |
| Glossary | `CONTEXT.md` |
| Guard policy | `ai-guard.config.json` |
| Roadmap | `agent-docs/superpowers/plans/2026-08-28-central-command-roadmap.md` |
| AI document root | `agent-docs/` |
| Shared Copilot config | `.copilot-config/` (submodule) |
| Chat discovery paths | `.vscode/settings.json` |
| MCP server registration | `.vscode/mcp.json` |
| Folder-open sync task | `.vscode/tasks.json` |
| How Chat should use it | `.github/instructions/central-command.instructions.md` |

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

- `data/` — SQLite database, WAL and SHM sidecars. Gitignored.
- `.copilot-config/` — owned by the central config repo; change it there via PR, then bump the
  submodule pointer here. Never commit an edit made inside the submodule from this repo.

## Things that will bite you

- **Every relative import needs a literal `.ts` extension** (`moduleResolution: nodenext` with
  `allowImportingTsExtensions`). Type-only imports must use `import type`
  (`verbatimModuleSyntax`).
- **`.vscode/mcp.json` and `.vscode/tasks.json` use an absolute node path.** They spawn in a
  non-login shell where nvm has never run and a bare `node` is ENOENT — which looks exactly
  like the server failing to start for no reason.
- **`ai-guard.config.json` is Copilot-ignored.** Modify it from a terminal, not the edit tool.
- **`tests/` is not a source root**, which is why the guards do not scan it.
- **The quality guard caps parameters at 4 and nesting at 3.** Deeply nested object literals
  count; hoist JSON schemas to module constants.

## Project Patterns

These are the invariants from DESIGN.md §19, restated as absolutes.

- **Tasks are pure.** A task observes and proposes. Only `src/executor/` causes side effects.
  Break this and the whole audit trail becomes a guess.
- **The default is queue.** An action is performed only if a rule explicitly allows it.
  Absence of a rule is never permission.
- **The denylist is compiled in and not overridable by config** (`src/core/policy/denylist.ts`,
  the only file under `src/` permitted to contain those strings). `--force`, `--no-verify`,
  `--force-with-lease`, `--admin` and `reset --hard` are refused regardless of configuration.
- **Guards run against freshly re-read state, never the mirror** (`src/core/policy/preflight.ts`).
  The mirror can be an hour old and a reviewer may have objected in that hour.
- **The audit row is written before the mutation, not after.** A crash mid-merge must still
  leave a record.
- **Every pre-approval carries an expiry and a rate limit.** A grant with neither is a
  permanent grant, which is what this system exists to avoid.
- **Every applied action is traceable to the rule that authorized it.** If you cannot name
  the rule, the action must not run.
- **`src/mcp/` is read-only and must never import `src/executor/`.** That import is what makes
  "an agent cannot merge or resolve" a property of the code rather than a promise.
- **`src/core/` imports no vendor package, no connector, and no Node builtin.** Enforced by
  `ai-guard.config.json`.
- **The dashboard is a control panel, never a runtime dependency.** Cron must work with the
  dashboard shut down.
- **Repository facts are verified before code depends on them.** See `STACK.md`.
- **Suppressed is not missed.** Quiet-hour slots are never caught up. Missed slots coalesce
  into exactly one catch-up run, never a replay burst.
- **The queue is a query, not a table.** Never introduce a second structure holding rows that
  already exist in `actions`.
- **It never invokes a language model.** No phase may add one. Judgment work is prepared
  as a `chat:handoff` and initiated by a human in VS Code Chat.

## Grounding — the expensive failures in this repo

The shared `grounding.instructions.md` applies. Four specifics that have already bitten:

1. **`launchd`.** `StartInterval` silently loses runs across sleep. Use `StartCalendarInterval`.
   Cited in `STACK.md`.
2. **`node:sqlite`.** Stable and unflagged in Node v24.18.0 despite widespread documentation
   to the contrary. Do not add `--experimental-sqlite`.
3. **Jira and GHE response shapes are verified, and some of what was "known" was wrong.**
   Resolving a WS ticket needs `resolution` alone — an earlier note insisting it also required
   `fixVersions` and an Epic Link was false. Read
   `transitions?expand=transitions.fields` at the moment of use rather than trusting either
   the note or this sentence.
4. **The Copilot CLI is installed but blocked by org policy.** `copilot --version` succeeds,
   which makes it look available; every `-p` invocation returns `Access denied by policy
   settings`. There is no headless LLM on this machine and no alternative agent CLI installed.
   Never design a step that calls a model unattended. See DESIGN.md §13.

## Validation Checklist

Run before every claim of completion. Paste real output; never summarize it.

```bash
npm run verify
```

That is `customizations → arch → quality → typecheck → test`, in that order.

## Git

**This repository is local only. There is no remote, and there are no pull requests.**
Do not add one, do not run `git push`, and do not open a PR or a Jira ticket for work done
here — the ticket-and-PR discipline that governs the storefront repositories does not apply
to a repository nobody else can see.

- Current working branch: `feature/central-command`. There is no `main`.
- Run `git rev-parse --abbrev-ref HEAD` before every commit anyway; the habit is what keeps
  it true in the repositories where it matters.
- Commit messages still carry the reasoning. They are the only review this code gets.
