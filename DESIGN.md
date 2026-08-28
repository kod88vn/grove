# `bot` — Personal Work Automation Runner

**Design document.** This is the canonical description of what `bot` is and why it is built
this way. Phase-by-phase delivery lives in
[the roadmap](agent-docs/superpowers/plans/2026-08-28-bot-roadmap.md).

- **Date:** 2026-08-28
- **Status:** Draft, awaiting review
- **Author:** jay.quach (with GitHub Copilot)
- **Branch:** `feature/bot-poc-scaffold`

---

## 1. Problem

Recurring, low-judgement work currently done by hand every day:

- Checking which Jira `WS` tickets are assigned to me and which have gone stale
- Checking whether local branches are behind `origin/main` or have uncommitted work
- Checking which of my PRs need attention (review requested, conflicts, red CI)
- Writing a status summary for the team
- Sprint hygiene: assigning, transitioning, closing tickets
- Eventually: delegating small code changes to an agent

The goal is a scheduled runner that performs these, escalating from *observe* to *propose* to *act*, with an explicit approval model rather than implicit trust.

## 2. Verified environment facts

Every fact below was confirmed by running the command shown, on 2026-08-28. Nothing here is from recall.

| Fact | Value | Source |
|---|---|---|
| Copilot CLI | `1.0.81`, at `~/.nvm/versions/node/v24.18.0/bin/copilot` | `copilot --version` |
| Copilot non-interactive | `-p/--prompt`; `--allow-all-tools` **required** for non-interactive | `copilot --help` |
| Copilot permissioning | `--allow-tool[=tools...]`, `--allow-url`, `--allow-all-paths`, `--add-dir`, `--agent` | `copilot --help` |
| Copilot safety judge | `--assisted-approval` — *takes precedence over* `--allow-all-tools`; requires `--experimental` or `enabledFeatureFlags.AUTO_APPROVAL` | `copilot --help` |
| Node | `v24.18.0` | `node --version` |
| GitHub CLI | `2.97.0` | `gh --version` |
| GitHub host | `github.corp.clover.com`, account `jay-quach`, git protocol **ssh** | `gh auth status` |
| GitHub token scopes | `admin:public_key`, `gist`, `read:org`, `repo` | `gh auth status` |
| `jq` | present at `/usr/bin/jq` | `which jq` |
| `JIRA_DC_TOKEN` | set in environment (value never read or logged) | `${JIRA_DC_TOKEN:+yes}` |
| Slack credentials | **none present** — no `SLACK_*` env vars | `env \| grep -i slack` |
| launchd agents | `~/Library/LaunchAgents` is empty — no conflicts | `ls ~/Library/LaunchAgents` |
| Local repos | `~/dev/web-storefront-engine` plus `-retail`, `-services`, `-ui`, `-developer-portal`, `-copilot-config` | `ls ~/dev` |

### Facts that must be verified during implementation, not assumed

- The exact Jira search endpoint, request shape, and pagination for this Data Center instance. Prior session notes record host `https://jira.corp.clover.com`, REST v2, `Authorization: Bearer $JIRA_DC_TOKEN`, project key `WS` — **the implementer must confirm the search path and response fields against the live API before writing parsing code.**
- Whether `gh pr list --author @me` supports the required `--json` fields on GHE 
  `github.corp.clover.com`; GHE field availability lags github.com.
- The `read:org` / missing `write:org` scope means org-level writes will fail. Any task
  needing them must fail loudly in `bot doctor`, not at 3am in a cron run.

## 3. Scope

### In scope for the POC

1. Shared skeleton: task registry, action/policy engine, JSONL store, CLI
2. One standalone script per task, individually runnable and testable
3. One real task implemented end to end: **standup digest** (Jira + git + GitHub)
4. Pre-approval policy engine with a catalog of candidate rules, **all disabled by default**
5. Local dashboard (Vite + React SPA + JSON API): observe, approve, trigger runs
6. launchd hourly agent
7. `bot doctor` preflight

### Explicitly out of scope for the POC

- Slack delivery (deferred by user; `Reporter` interface makes it a drop-in later)
- Sprint maintenance, auto-resolving tickets, PR-feedback resolution — each needs its own spec
- Copilot-driven code changes — interface defined, implementation stubbed
- Multi-user, auth, remote hosting

## 4. Decisions locked with the user

| Question | Decision |
|---|---|
| Autonomy | Full-write machinery built now, but **dry-run is the default**; writes enabled per-capability |
| POC task | Combined standup digest across Jira + git + GitHub |
| Delivery | Console + local markdown file. Slack deferred |
| Scheduling | macOS launchd agent, hourly |
| Repos | Start with `web-storefront-engine`; config is a list, expected to grow |
| Per-task scripts | Yes — one runnable script per task |
| Dashboard | Vite + React SPA against a small JSON API |
| Dashboard role | Read state, approve actions, trigger manual runs |
| Storage | JSONL files + a rules JSON file |
| Initial pre-approvals | **None enabled.** Ship a catalog of candidates, disabled, for inspection |
| Ticket scope | All my tickets, but **correlated with PRs I opened** — PR linkage is the primary signal |
| Quiet hours | No runs 23:00–07:00 local |
| Sleep/offline recovery | Required — runs missed while asleep or offline must be caught up |
| Dashboard authority | Must control every meaningful setting, while the cron job stays independent of it |
| Audit | Every automated action must leave an audit trail, navigable from the dashboard |
| Retention | 30 days for run logs (see §8 for the audit-log exception) |

## 5. Architecture

```
bot/
  bin/bot.ts                    # bot run|list|doctor|queue|rules|dash
  scripts/                      # ONE standalone runnable script per task
    jira-standup.ts
    branch-hygiene.ts
    pr-status.ts
    standup.ts                  # composite of the three
  src/
    core/                       # ZERO vendor imports
      task.ts                   # Task, TaskContext, TaskResult
      action.ts                 # Action, Capability
      policy/
        rules.ts                # PolicyRule shape
        evaluate.ts             # (action, rules, usage) -> Decision
        denylist.ts             # hardcoded, uneditable
      report.ts
    connectors/                 # adapt the outside world to core types
      jira.ts
      github.ts                 # wraps `gh`
      git.ts                    # wraps local git
      copilot.ts                # STUB: interface only in POC
    tasks/                      # pure: collect() -> TaskResult. No side effects.
      jira-standup.ts
      branch-hygiene.ts
      pr-status.ts
      standup.ts
    executor/                   # applies actions according to policy decisions
    store/                      # JSONL append + read
    delivery/                   # ConsoleReporter, FileReporter (SlackReporter later)
    config/
  dashboard/
    api/                        # JSON API over the store, binds 127.0.0.1
    web/                        # Vite + React SPA
  launchd/
    com.jayquach.bot.standup.plist.template
    install.sh / uninstall.sh
  data/                         # gitignored
    runs.jsonl
    actions.jsonl               # append-only audit log
    queue.jsonl
    rules.json
  reports/                      # gitignored
```

**Dependency direction is strictly inward:** `dashboard → store → core`, `scripts → tasks → connectors → core`. `src/core/` imports nothing from `connectors/`, `tasks/`, or any vendor package. This is what keeps the policy engine unit-testable without network or git.

## 6. Core domain model

```ts
type Capability =
  | 'jira:comment' | 'jira:assign' | 'jira:transition' | 'jira:create'
  | 'git:push' | 'git:branch-create' | 'git:commit'
  | 'github:pr-create' | 'github:pr-comment' | 'github:pr-review'
  | 'copilot:code-change';

interface Action {
  id: string;              // stable hash of capability + target + payload
  capability: Capability;
  target: { kind: string; id: string; url?: string };
  summary: string;         // human sentence shown in the dashboard
  payload: unknown;        // exact request that would be sent
  reason: string;          // why the task proposed this
  producedBy: { task: string; runId: string };
}

interface TaskResult {
  report: ReportSection[];  // what it observed
  actions: Action[];        // what it proposes to do — NOT yet done
}
```

**Tasks never mutate anything.** A task is a pure function from context to `TaskResult`. Only the executor performs side effects, and only after the policy engine returns `allow`. This single rule is what makes every task safe to run in tests and safe to run standalone.

## 7. Pre-approval / policy engine

### Decision order

```
evaluate(action):
  1. HARDCODED_DENYLIST matches?     -> DENY   (not overridable by any config)
  2. explicit deny rule matches?     -> DENY
  3. mode is 'apply' for capability
     AND an enabled allow rule matches
     AND within perRun/perDay limits
     AND rule not expired?           -> ALLOW
  4. otherwise                       -> QUEUE  (default)
```

Default is always `QUEUE`. Absence of a rule can never mean permission.

### Rule shape

```jsonc
{
  "id": "stale-ticket-nudge",
  "enabled": false,
  "capability": "jira:comment",
  "match": { "project": "WS", "assignee": "jay.quach" },
  "limits": { "perRun": 5, "perDay": 20 },
  "expiresAt": "2026-09-27",
  "reason": "Nudge my own stale tickets",
  "createdBy": "jay.quach",
  "createdAt": "2026-08-28"
}
```

### Three non-negotiable properties

1. **Expiry** — every rule has `expiresAt`. Rules rot as circumstances change; forcing periodic re-consent prevents "pre-approved once" silently becoming permanent autonomy. An expired rule falls through to `QUEUE`, it does not fail closed loudly but it does not act.
2. **Rate limits** — `perRun` and `perDay`. The realistic failure is not a malicious action, it is a loop emitting the same action 400 times. Limits are counted from `actions.jsonl`, so they survive restarts.
3. **Provenance** — every applied action records `authorizedBy: <ruleId>` in the audit log. You can always answer "why did it do that", and revoking a rule tells you exactly what it had authorized.

### Hardcoded denylist (uneditable, encodes standing personal rules)

- push to `main` / `master`
- `--force` / `--force-with-lease`
- `--no-verify`
- `git reset --hard`, branch deletion, `rm -rf`
- committing on a branch the bot did not create
- opening a PR whose body contains no Jira link

These are compiled in, not config. Config cannot grant them.

### Dashboard approval UX

A queued action offers:
- **Approve once** — executes just this instance
- **Reject** — records the rejection with an optional note (useful signal for tuning tasks)
- **Always approve like this** — opens a pre-filled rule derived from the action, showing the exact predicate, limits and expiry **before** saving

The third is the important one: the allowlist grows from actions you have actually seen and judged, rather than from guesses made up front. This is why the POC ships with zero enabled rules.

### Candidate rule catalog (shipped disabled, for inspection)

| Candidate | Capability | Suggested limits | Notes |
|---|---|---|---|
| Assign unassigned `WS` ticket to me | `jira:assign` | 5/day | Low risk, easily reversed |
| Comment staleness nudge on my own tickets | `jira:comment` | 5/run, 20/day | Visible to others — noise risk |
| Move my ticket To Do → In Progress when a matching branch exists | `jira:transition` | 3/day | Depends on branch naming `feature/WS-1234-*` |
| Create branch from ticket key | `git:branch-create` | 3/day | Local only, no push |
| Push a branch the bot itself created | `git:push` | 1/run | Recommend keeping queued indefinitely |
| Open draft PR with Jira link | `github:pr-create` | 1/day | Recommend keeping queued |

## 8. Storage

JSONL append-only files under `data/`, plus `rules.json`.

| File | Contents |
|---|---|
| `runs.jsonl` | one record per task execution: id, task, start/end, mode, outcome |
| `actions.jsonl` | append-only audit: every action proposed, its decision, authorizing rule, result |
| `queue.jsonl` | pending actions awaiting approval; resolved entries appended, never edited in place |
| `rules.json` | pre-approval rules |
| `config.json` | all job settings the dashboard edits; the single source of truth |

Append-only means concurrent writers never corrupt earlier records, and history is greppable and git-diffable. The tradeoff is weak querying; if the dashboard gets slow, migrating to SQLite is a store-layer change only, because nothing above `src/store/` knows the format.

### Retention: logs and audit are not the same thing

Retention is configured **per stream**, not globally, because these have different purposes:

| Stream | Default retention | Rationale |
|---|---|---|
| Verbose run logs (`~/Library/Logs/bot/`) | **30 days** | Debugging aid; high volume; loses value quickly |
| `runs.jsonl` | **30 days** | Operational history |
| `queue.jsonl` (resolved entries) | **30 days** | Superseded by the audit record |
| `actions.jsonl` (**applied mutations only**) | **365 days** | This is the record of what the bot *changed*. See below. |

**Recommendation, flagged for explicit decision:** pruning `actions.jsonl` at 30 days would
destroy the answer to "did the bot do this, and under what authority?" for anything older
than a month. That is the one question an audit trail exists to answer. Applied mutations
are also extremely low volume — a handful per day at most — so retaining them for a year
costs almost nothing. Proposed and rejected actions are high-volume and *are* pruned at 30
days. If 30 days across the board is genuinely required, say so and it becomes a one-line
config change, but the tradeoff should be deliberate.

Pruning runs at the start of each scheduled run, is itself logged, and never deletes a
record that is still referenced by an unresolved queue entry.

## 9. Scripts and CLI

Each task is runnable three ways, all sharing one code path:

```bash
npx tsx scripts/jira-standup.ts               # dry-run by default
npx tsx scripts/jira-standup.ts --json        # machine-readable
npx tsx scripts/branch-hygiene.ts --apply     # policy still governs each action
bot run standup                               # via the registry
```

`--dry-run` is the default everywhere. `--apply` does not bypass policy; it only permits the executor to act on actions the policy engine independently allows.

`bot doctor` verifies: `JIRA_DC_TOKEN` present, Jira reachable, `gh auth status` healthy for `github.corp.clover.com`, every configured repo path exists and is a git repo, `data/` writable, launchd agent loaded. Exits non-zero on any failure.

## 10. POC task: standup digest

Three collectors, merged into one report:

1. **Jira** — my tickets, resolved as: issues where I am assignee, reporter, or watcher, **plus** any issue whose key appears in a branch or PR I authored. Tickets are then ranked by PR linkage, since a ticket with an open PR of mine is the one most likely to need action. Fields: key, summary, status, updated, sprint, linked PR. Flags anything untouched > 3 days.
2. **Git** — per configured repo: current branch, dirty worktree, ahead/behind `origin/main`, branches lacking an upstream. Read-only (`git fetch` + `rev-list`); never modifies the worktree.
3. **GitHub** — my open PRs via `gh`: review decision, mergeable state, CI status, age.

Output: console + `reports/<ISO-timestamp>-standup.md`, through the `Reporter` interface.

The task also *emits* actions it will not run in the POC (all queued): staleness nudges, assign-to-me for unassigned tickets. This exercises the full pipeline so you can judge action quality before enabling anything.

## 11. Dashboard

- **Web:** Vite + React SPA, `dashboard/web/`
- **API:** small JSON API over the store, bound to `127.0.0.1` only — never `0.0.0.0`. No auth in the POC is acceptable *only* because it is loopback-bound; this must be revisited before any remote exposure.

### Dashboard controls everything; cron depends on nothing

These two requirements are reconciled by making **`config.json` the single source of truth**
and the dashboard merely an editor of it. The dashboard writes config atomically
(write-temp-then-rename) and validates against a schema before saving; the scheduled run
re-reads config at the start of every fire. The bot therefore runs correctly whether the
dashboard has ever been opened, is running, or has crashed. The dashboard is a control
panel, never a dependency.

Settings that must be dashboard-editable: per-job enable/disable, schedule and quiet hours,
dry-run vs apply per capability, pre-approval rules (add/revoke/expiry/limits), watched repo
list, staleness thresholds, retention windows, and report destinations.

### Views

- **Jobs** — last run, outcome, duration, next fire, enable/disable, Run now (dry-run/apply toggle)
- **Approval inbox** — queued actions with full payload; approve once / reject / always-approve-like-this
- **Rules** — expiry countdown, usage vs limit, revoke
- **Settings** — everything listed above
- **Audit** — see below

### Audit navigation

An append-only JSONL file is not an audit trail if nobody can read it. The audit view must
support, at minimum: filter by date range, task, capability, and decision
(`allow`/`queue`/`deny`); filter to **applied mutations only**; free-text search over target
and summary; and per-entry drill-down showing the exact payload sent, the authorizing rule,
the run that produced it, and the outcome.

Two pivots matter most in practice and should be first-class: **"what did the bot actually
change today"** and **"show me everything rule X ever authorized"** — the latter is what you
need when deciding whether to revoke a pre-approval.

The API is a thin read/command layer. All business logic stays in `src/`, so the dashboard can be deleted without breaking the CLI.

## 12. Scheduling, quiet hours, and recovery

### Use `StartCalendarInterval`, not `StartInterval`

This is load-bearing and was corrected after reading `man launchd.plist` (lines 348–369):

> **`StartInterval`** — "If the system is asleep during the time of the next scheduled interval firing, that interval **will be missed** due to shortcomings in kqueue(3)."
>
> **`StartCalendarInterval`** — "Unlike cron which skips job invocations when the computer is asleep, launchd **will start the job the next time the computer wakes up**. If multiple intervals transpire before the computer is woken, those events **will be coalesced into one event** upon wake from sleep."

So `StartInterval` — the obvious choice, and what an earlier draft of this spec specified —
is the one option that silently loses runs across sleep, which is exactly the failure the
user asked to avoid. The agent uses an **array of `StartCalendarInterval` dictionaries, one
per waking hour (07:00–22:00)**. This delivers quiet hours structurally rather than by
running and then deciding to do nothing.

`RunAtLoad` stays false so installing the agent does not immediately fire. stdout/stderr to
`~/Library/Logs/bot/`. Because launchd runs with a minimal environment, the agent must source
credentials explicitly rather than assuming an interactive shell profile — a common and
silent failure mode, and something `bot doctor` must be able to check *from inside* the agent
context, not just from a terminal.

### Do not rely on launchd alone for recovery

launchd coalesces missed wake-up events into a single fire, and offline failures are
invisible to it entirely. Recovery is therefore implemented in our own store, independent of
launchd semantics:

- Each run records its scheduled slot and outcome in `runs.jsonl`
- On every fire, the runner compares expected slots since `lastSuccessfulRun` against recorded ones
- Missed slots are **coalesced into one catch-up run**, never replayed N times — replaying an hourly digest 9 times after a weekend is noise, not recovery
- The catch-up report states the window it covers, so a gap is visible rather than silently smoothed over

### Suppressed is not the same as missed

Slots inside quiet hours are recorded as **suppressed** and are never caught up — they were
intentionally skipped. Only slots missed due to sleep, shutdown, or failure count as missed.
Conflating the two would produce a 23:00–07:00 catch-up burst every single morning, which
defeats the purpose of having quiet hours.

### Offline handling

Network calls use bounded retry with backoff. If a connector still fails, the run is recorded
as `failed:offline`, `lastSuccessfulRun` is **not** advanced, and the next fire treats the
slot as missed. A partial run (e.g. git succeeded, Jira unreachable) reports what it has and
marks the missing section explicitly — it never silently omits a section, since a digest that
quietly drops Jira looks identical to a digest with no Jira tickets.

## 13. Copilot CLI integration (designed, not built)

`src/connectors/copilot.ts` ships as an interface with a stub implementation. Intended shape:

1. Create an isolated `git worktree` for the ticket
2. Run `copilot -p "<task prompt>" --allow-all-tools --add-dir <worktree>` (both flags verified present in 1.0.81)
3. Capture the resulting diff as a `copilot:code-change` action
4. Route it through the same policy engine as every other action

Consider `--assisted-approval` as a second safety layer inside the worktree. Defining the interface now means autonomous development inherits the existing approval gates instead of requiring a restructure.

## 14. Testing strategy

- **Policy engine** — the highest-value tests. Pure function, no I/O: denylist precedence, expiry, per-run and per-day limits, predicate matching, default-to-queue. Table-driven.
- **Tasks** — pure `collect()` against fake connectors (hand-written fakes, not mocking frameworks), asserting on the report and the emitted actions.
- **Connectors** — thin; tested against recorded fixtures, not the live network. Fixtures captured once from the real API and committed.
- **Determinism** — inject the clock; never call `Date.now()` inside task or policy logic, or staleness tests become time-dependent and flaky.
- Tests must assert real behavior. A test that only checks "did not throw" does not count.

## 15. Milestones

| # | Milestone | Verifiable by |
|---|---|---|
| M1 | Repo scaffold, TS config, core types, policy engine + tests | `npm test` green; policy table tests pass |
| M2 | Store (JSONL) + `bot doctor` | `bot doctor` exits 0 against the real environment |
| M3 | Three connectors against fixtures | Connector tests green |
| M4 | Three task scripts runnable standalone, dry-run | `npx tsx scripts/*.ts` each produce a report |
| M5 | Composite `standup` + file/console reporters | `reports/*.md` generated with real data |
| M6 | Executor + queue; actions land in queue, nothing applied | `data/queue.jsonl` populated, `actions.jsonl` shows QUEUE decisions |
| M7 | Dashboard API + SPA: jobs, inbox, rules, history | Approve a queued action end to end |
| M8 | launchd agent installed, hourly | Agent fires; logs in `~/Library/Logs/bot/` |

M1–M5 alone constitute a useful, fully read-only tool. Everything after adds control surface.

## 16. Risks

| Risk | Mitigation |
|---|---|
| Jira DC API shape differs from assumptions | Verify live before parsing; fixtures from real responses |
| Missing `write:org` scope breaks a future task | `bot doctor` checks scopes explicitly |
| launchd minimal env lacks credentials | Explicit credential sourcing; `doctor` run inside the agent |
| Pre-approval creeps into de facto full autonomy | Mandatory expiry + rate limits + audit provenance |
| Loopback dashboard later exposed remotely | Documented as a hard precondition; bind address asserted in code |
| Scope sprawl back into "automate everything" | Each new task is a separate spec; skeleton unchanged |

## 17. Open questions

1. Staleness threshold — 3 days assumed. Correct?
2. Should `actions.jsonl` (applied mutations) really be pruned at 30 days along with everything else, or retained for 365 days as recommended in §8?
3. On catch-up after a long gap (e.g. Monday morning after a weekend), should the digest cover the whole gap, or just report current state and note the gap?

Resolved:
- Repo list starts at `web-storefront-engine` only (§4), configured as an array.
- "My tickets" = assignee/reporter/watcher, correlated with and ranked by PRs I opened (§10).
- Quiet hours 23:00–07:00, implemented structurally via `StartCalendarInterval` (§12).

## 18. Roadmap

Full detail in [the roadmap](agent-docs/superpowers/plans/2026-08-28-bot-roadmap.md).
Each phase gets its own task-level plan when work on it starts.

| # | Phase | Delivers |
|---|---|---|
| P0 | Scaffold & toolchain | Repo builds, tests run, config schema |
| P1 | Core + policy engine | Pre-approval logic, unit-tested, no I/O |
| P2 | Store, audit & retention | JSONL append/read, pruning, audit records |
| P3 | Connectors & `doctor` | Jira, git, GitHub reads against fixtures |
| P4 | Standalone task scripts | Three independently runnable scripts |
| P5 | **Composite standup** | **First genuinely useful output — POC checkpoint** |
| P6 | Scheduler | launchd, quiet hours, sleep/offline catch-up |
| P7 | Executor & queue | Actions queued; approve via CLI |
| P8 | Dashboard | Full control surface + audit navigation |
| P9 | Enable first pre-approvals | Operational, not code |
| P10+ | New tasks & Copilot automation | Sprint hygiene, PR feedback, autonomous dev |

**P0–P5 is the POC and is entirely read-only. Nothing mutates anything until P9.**

## 19. Invariants

These hold in every phase. A change that violates one is a bug regardless of what it enables:

1. Tasks are pure. Only the executor causes side effects.
2. Default is queue. Absence of a rule never means permission.
3. The hardcoded denylist is not overridable by configuration.
4. Every pre-approval has an expiry and a rate limit.
5. Every applied action is auditable to its authorizing rule.
6. `src/core/` imports no vendor package and no connector.
7. The dashboard is a control panel, never a runtime dependency.
8. Repository facts (endpoints, fields, flags) are verified against the live system or a fixture before code depends on them.
