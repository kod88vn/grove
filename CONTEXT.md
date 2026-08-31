# CONTEXT.md — Glossary

> Domain vocabulary for this repository. Keep definitions to one or two lines.
> Purpose: stop agents inventing meanings for terms that already have a precise one here.

## Domain Terms

| Term | Means | Does not mean |
| --- | --- | --- |
| `Task` | A **pure** function `collect(ctx) → TaskResult`. Observes, proposes, never mutates. | A scheduled job, or anything that performs the work |
| `TaskResult` | `{ report, actions[] }` — what was observed plus what is *proposed* | A record of things that happened |
| `Action` | A described, not-yet-performed mutation with capability, target, payload, reason | An executed change |
| `Capability` | The permission class an action needs, e.g. `jira:comment`, `git:push` | A feature or a task name |
| `Decision` | Policy engine output: `allow`, `queue`, or `deny` | A user choice |
| `PolicyRule` | A **pre-approval**: capability + predicates + limits + expiry | A permanent grant |
| `Denylist` | The compiled-in, config-unoverridable prohibitions | A configurable blocklist |
| `Executor` | The only component permitted to cause side effects | A task runner |
| `Connector` | Adapter from an external system (Jira, git, GitHub) to core types | A client library |
| `Reporter` | Output sink for a report (console, file, later Slack) | A logger |
| `Run` | One execution of a task, recorded in `runs` | A scheduled slot |
| `Slot` | A scheduled point in time the agent was meant to fire | A run |
| `Provenance` | The link from an applied action back to the rule that authorized it | A timestamp |

## Ambiguous Words

Words that mean something specific here and something else in general usage.

| Word | In this repo |
| --- | --- |
| `queue` | **A query, not a table** — `actions WHERE decision='queue' AND resolution IS NULL` |
| `apply` | Executor mode permitting mutation. Does **not** bypass policy; policy still decides per action |
| `dry-run` | The default everywhere. Actions are proposed and recorded, never performed |
| `propose` | Mode where allowed actions are still parked for human approval |
| `suppressed` | A slot deliberately skipped (quiet hours). **Never** caught up |
| `missed` | A slot lost to sleep, shutdown, or failure. **Is** caught up, coalesced into one run |
| `catch-up` | A single run covering a gap of missed slots — never N replayed runs |
| `stale` | A ticket untouched beyond the configured threshold (3 days assumed, unconfirmed) |
| `my tickets` | Assignee, reporter, or watcher — **plus** any ticket keyed in a branch or PR I authored |
| `audit` | The `actions` record of applied mutations and their authority. Distinct from `logs` |
| `logs` | High-volume verbose run output. Pruned at 30 days. Not the audit trail |

## Layer Names

Dependency levels enforced by `ai-guard.config.json`. **Dependencies point downward only**:
a layer may import equal or lower levels, never higher.

| Level | Layer | May import |
| --- | --- | --- |
| L0 | `src/core` | Nothing. No vendor packages, no Node builtins, no I/O |
| L1 | `src/tasks` | Core only. Must stay pure — no clock, no env, no fs |
| L2 | `src/store` | Core, `node:sqlite` and fs/path builtins |
| L2 | `src/delivery` | Core plus fs builtins |
| L3 | `src/connectors` | Core plus process/network builtins |
| L4 | `src/executor` | Core, store, connectors |
| L5 | `bin`, `scripts`, `dashboard` | Everything |

## Naming Conventions

| Thing | Convention | Example |
| --- | --- | --- |
| Files | kebab-case, named after the concept owned | `evaluate.ts`, `denylist.ts` |
| Capabilities | `domain:verb`, lowercase | `jira:transition` |
| Stall rules | one file per subject, under `src/stalls/rules/` | `src/stalls/rules/review.ts` |
| Branches | `feature/WS-1234-description` | `feature/bot-poc-scaffold` |
| Tables | plural, snake_case | `actions`, `schedule_slots`, `rule_history` |
