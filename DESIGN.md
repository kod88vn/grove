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
| Copilot CLI | Installed (`1.0.81`, at `~/.nvm/versions/node/v24.18.0/bin/copilot`) but **BLOCKED and unusable** — every non-interactive run returns `Error: Access denied by policy settings`. Org policy; not ours to change. See §13. | `copilot -p … --allow-all-tools` |
| Other agent CLIs | **None installed** — `claude`, `codex`, `aider`, `cursor-agent`, `gemini`, `ollama`, `llm` all absent | `command -v <name>` |
| Headless LLM access | **None, in any phase.** The bot cannot invoke a model unattended. Judgment work is handed off to VS Code Chat and initiated by a human (§13). | derived from the two rows above |
| Node | `v24.18.0` | `node --version` |
| `node:sqlite` | Available with **no experimental flag and no warning**; exports `DatabaseSync`, `StatementSync`, `Session`, `constants`, `backup` | `node -e "require('node:sqlite')"` |
| Bundled SQLite | `3.53.1`, with **FTS5** and **json1** compiled in | `SELECT sqlite_version()`; `CREATE VIRTUAL TABLE … USING fts5`; `json_extract` |
| SQLite WAL | `PRAGMA journal_mode=WAL` → `wal`; `busy_timeout` and `user_version` settable | verified on a file-backed DB |
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

1. Shared skeleton: task registry, action/policy engine, SQLite store, CLI
2. One standalone script per task, individually runnable and testable
3. One real task implemented end to end: **standup digest** (Jira + git + GitHub)
4. Pre-approval policy engine with a catalog of candidate rules, **all disabled by default**
5. Local dashboard (Vite + React SPA + JSON API): observe, approve, trigger runs
6. launchd hourly agent
7. `bot doctor` preflight

### Explicitly out of scope for the POC

- Slack delivery (deferred by user; `Reporter` interface makes it a drop-in later)
- Sprint maintenance, auto-resolving tickets, PR-feedback resolution — each needs its own spec
- Agent-driven code changes — the `chat:handoff` action and its briefing writer are defined; the agents themselves are P10+ (§13)
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
| Storage | **SQLite** via built-in `node:sqlite`, WAL mode, zero dependencies |
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
    tasks/                      # pure: collect() -> TaskResult. No side effects.
      jira-standup.ts
      branch-hygiene.ts
      pr-status.ts
      standup.ts
    executor/                   # applies actions according to policy decisions
    handoff/                    # writes briefing files for chat agents (P10+; stub in POC)
    store/                      # SQLite: schema, migrations, queries
    delivery/                   # ConsoleReporter, FileReporter (SlackReporter later)
    config/
  .github/
    agents/                     # dedicated chat agents — human-initiated only (§13)
  dashboard/
    api/                        # JSON API over the store, binds 127.0.0.1
    web/                        # Vite + React SPA
  launchd/
    com.jayquach.bot.standup.plist.template
    install.sh / uninstall.sh
  data/                         # gitignored
    bot.db                      # SQLite (WAL: bot.db-wal, bot.db-shm alongside)
    migrations/                 # numbered .sql files, applied via PRAGMA user_version
  reports/                      # gitignored
    handoffs/                   # per-action briefing files consumed by chat agents
```

**Dependency direction is strictly inward:** `dashboard → store → core`, `scripts → tasks → connectors → core`. `src/core/` imports nothing from `connectors/`, `tasks/`, or any vendor package. This is what keeps the policy engine unit-testable without network or git.

## 6. Core domain model

```ts
type Capability =
  | 'jira:comment' | 'jira:assign' | 'jira:transition' | 'jira:create'
  | 'git:push' | 'git:branch-create' | 'git:commit'
  | 'github:pr-create' | 'github:pr-comment' | 'github:pr-review'
  | 'chat:handoff';   // prepare work for a human-initiated chat agent (§13)

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
2. **Rate limits** — `perRun` and `perDay`. The realistic failure is not a malicious action, it is a loop emitting the same action 400 times. Limits are counted with a query over the `actions` table, so they survive restarts.
3. **Provenance** — every applied action records `authorizedBy: <ruleId>` in the audit log. You can always answer "why did it do that", and revoking a rule tells you exactly what it had authorized.

### Hardcoded denylist (uneditable, encodes standing personal rules)

- push to `main` / `master`
- `--force` / `--force-with-lease`
- `--no-verify`
- `git reset --hard`, branch deletion, `rm -rf`
- committing on a branch the bot did not create
- opening a PR whose body contains no Jira link
- auto-applying the *outcome* of a `chat:handoff` — the executor may only prepare a handoff,
  never perform the judgment work itself, and never mark one applied on the agent's behalf

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

A single SQLite database at `data/bot.db`, accessed through the built-in `node:sqlite`
module. No external dependency, no native build step.

**Why SQLite over append-only JSONL:** the audit requirement (§11) is a *query* requirement —
filter by date range, task, capability and decision, isolate applied mutations, full-text
search, and pivot on "everything rule X authorized". Serving those from JSONL means reading
every line into memory on every dashboard request, and log volume is expected to be high.
Retention also becomes a `DELETE … WHERE ts < ?` instead of rewriting files.

### Tables

| Table | Purpose | Volume |
|---|---|---|
| `runs` | one row per execution: task, scheduled slot, start/end, mode, outcome, catch-up window | low |
| `actions` | every action proposed, its decision, authorizing rule, payload, result | low–medium |
| `logs` | verbose run output, level, message, context | **high** |
| `schedule_slots` | per-slot accounting: `ran` / `suppressed` / `missed` / `failed` | medium |
| `rules` | pre-approval rules | low |
| `rule_history` | every rule create/edit/revoke, with before/after | low |
| `config` | key → JSON value; all dashboard-editable settings | low |
| `actions_fts` | FTS5 index over action summary/target | mirrors `actions` |

### The queue is a query, not a table

An earlier draft had a separate `queue.jsonl`. That was a mistake: it duplicates rows that
already exist in the audit record and creates two things that can disagree. Instead,
`actions` carries `resolution`, `resolved_at`, `resolved_by`, and the approval inbox is:

```sql
SELECT * FROM actions WHERE decision = 'queue' AND resolution IS NULL ORDER BY created_at;
```

One row per action, from proposal through to outcome. Nothing to reconcile.

### Concurrency

The launchd agent writes while the dashboard reads, so:

- `PRAGMA journal_mode=WAL` — readers never block the writer and vice versa (verified working, §2)
- `PRAGMA busy_timeout=5000` — absorbs brief contention instead of throwing `SQLITE_BUSY`
- Single-writer discipline: the dashboard mutates only via explicit commands, never mid-run
- Every run's inserts are wrapped in a transaction so a crashed run leaves no half-written state

### Migrations

Numbered `.sql` files in `data/migrations/`, applied at startup in order, tracked with
`PRAGMA user_version` (verified settable, §2). Both the CLI and the dashboard run the same
migration step on open, so whichever starts first brings the schema up to date. Migrations
are forward-only.

### Retention: logs and audit are not the same thing

Retention is configured **per table**, not globally, because these have different purposes:

| Data | Default retention | Rationale |
|---|---|---|
| `logs` | **30 days** | Debugging aid; high volume; loses value quickly |
| `runs`, `schedule_slots` | **30 days** | Operational history |
| `actions` — proposed / rejected / queued | **30 days** | High volume, superseded once resolved |
| `actions` — **applied mutations** | **365 days** | The record of what the bot *changed*. See below. |
| `rules`, `rule_history`, `config` | **never pruned** | Tiny, and they explain every past decision |

**Recommendation, flagged for explicit decision:** pruning applied mutations at 30 days would
destroy the answer to "did the bot do this, and under what authority?" for anything older
than a month. That is the one question an audit trail exists to answer. Applied mutations are
also extremely low volume — a handful per day at most — so retaining them for a year costs
almost nothing, while the high-volume data that motivated SQLite (`logs`) *is* pruned at 30
days. If 30 days across the board is genuinely required it is a one-line config change, but
the tradeoff should be deliberate.

Pruning runs at the start of each scheduled run, is itself logged, and never deletes an
action that is still unresolved. Note that `DELETE` alone does not shrink the file: pruning
is followed by `PRAGMA wal_checkpoint(TRUNCATE)`, with a periodic `VACUUM` on a longer cycle.

### Indexes

Driven by the actual dashboard queries, not guessed: `actions(created_at)`,
`actions(decision, resolution)`, `actions(capability)`, `actions(authorized_by_rule)`,
`actions(run_id)`, `logs(ts)`, `logs(run_id)`, `runs(scheduled_slot)`.

### Escape hatch

`bot export` dumps `config`, `rules`, and applied actions to JSON. This preserves the one
real advantage JSONL had — human-readable, diffable, backup-able state — without paying its
query cost. Config and rules live in the database rather than in a hand-edited file so that
edits are transactional and every change is captured in `rule_history`.

## 9. Scripts and CLI

Each task is runnable three ways, all sharing one code path:

```bash
npx tsx scripts/jira-standup.ts               # dry-run by default
npx tsx scripts/jira-standup.ts --json        # machine-readable
npx tsx scripts/branch-hygiene.ts --apply     # policy still governs each action
bot run standup                               # via the registry
```

`--dry-run` is the default everywhere. `--apply` does not bypass policy; it only permits the executor to act on actions the policy engine independently allows.

`bot doctor` verifies: `JIRA_DC_TOKEN` present, Jira reachable, `gh auth status` healthy for `github.corp.clover.com`, every configured repo path exists and is a git repo, `data/` writable, the database opens and its migrations are current, launchd agent loaded. Exits non-zero on any failure.

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

These two requirements are reconciled by making **the `config` table the single source of
truth** and the dashboard merely an editor of it. Writes are transactional and
schema-validated before commit; the scheduled run re-reads config at the start of every fire.
The bot therefore runs correctly whether the dashboard has ever been opened, is running, or
has crashed. The dashboard is a control panel, never a dependency.

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

A log nobody can query is not an audit trail. Backed by SQL, the audit view must support, at
minimum: filter by date range, task, capability, and decision (`allow`/`queue`/`deny`);
filter to **applied mutations only**; full-text search over target and summary via FTS5
(verified available, §2); and per-entry drill-down showing the exact payload sent, the
authorizing rule, the run that produced it, and the outcome.

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

- Each run records its scheduled slot and outcome in `schedule_slots`
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

## 13. Chat-initiated agent handoff (designed, not built)

**The Copilot CLI is unusable here, and that is not going to change.** It is installed at
`1.0.81`, but every non-interactive invocation is refused by org policy:

```
$ copilot -p "Reply with exactly: PROBE_OK" --allow-all-tools
Error: Access denied by policy settings (Request ID: 5A74:32B222:30F7C3:36D5A4:6A91D982)
```

The entitlement exists in VS Code Chat but not on the CLI surface, and the policy is not ours
to grant. No alternative agent CLI is installed either. So the bot has **no headless path to a
language model, in any phase.** Any design that assumes one is wrong.

This is a constraint, not a loss. It splits the "act" tier along a line that was always the
right one:

| Tier | Needs judgment? | Who performs it |
|---|---|---|
| Deterministic mutations — assign, transition, comment, create branch, push, open PR | No | The executor, headless, under policy — **P7–P9 unchanged** |
| Judgment work — write code, triage PR feedback, draft prose | Yes | A dedicated chat agent, **initiated by the human** |

Everything the POC and P7–P9 promise lives in the first row: those are HTTP calls and git
plumbing, not inference. **Nothing in P0–P9 changes.** Only P10+ is affected.

### The handoff mechanism

A task that wants judgment work emits a `chat:handoff` action like any other. What differs is
who applies it:

1. The task emits `chat:handoff`, with a payload naming the target agent and carrying the
   facts it already gathered.
2. On approval the executor performs only the **deterministic prep** — create the isolated
   `git worktree`, then write a briefing to `reports/handoffs/<action-id>.md` containing
   everything the agent needs, so the agent never re-fetches what the bot already knows.
3. The action moves to resolution `awaiting-human`. The digest and the dashboard surface it
   as a copy-pasteable chat invocation.
4. You open Chat and run the agent. **This step is manual by construction — that is the
   entire point of the model, not a workaround for the policy block.**
5. The agent's mandatory closing step is
   `npx tsx scripts/record-outcome.ts --action <id> --status applied|abandoned --notes "…"`,
   which writes the result back into `actions`.

Step 5 is the load-bearing one. Without it, work performed in Chat is invisible to the
database and the audit trail (§11) has a hole in exactly the place where the mutations
happened. An agent that cannot run that command must not be given the handoff.

### Where the agents live

`.github/agents/*.agent.md` in this repo. That directory is already a configured discovery
target (`chat.promptFilesLocations` in `.vscode/settings.json`), so adding agents requires no
submodule bump. They are bot-specific and must **not** go in `.copilot-config/agents/`, which
is shared across the storefront repos.

Each agent stays narrow and reads its briefing file rather than rediscovering context —
candidates are `implement-ticket`, `fix-pr-feedback`, `sprint-hygiene`. Defining them as
agents rather than prompts means each one carries its own tool restrictions.

### Why this is safer than what it replaces

§16 lists "pre-approval creeps into de facto full autonomy" as a standing risk. Removing
headless model access deletes that risk at the code-change tier outright: unattended runs can
now only ever perform mutations that were enumerable in advance.

## 14. Testing strategy

- **Policy engine** — the highest-value tests. Pure function, no I/O: denylist precedence, expiry, per-run and per-day limits, predicate matching, default-to-queue. Table-driven.
- **Tasks** — pure `collect()` against fake connectors (hand-written fakes, not mocking frameworks), asserting on the report and the emitted actions.
- **Connectors** — thin; tested against recorded fixtures, not the live network. Fixtures captured once from the real API and committed.
- **Determinism** — inject the clock; never call `Date.now()` inside task or policy logic, or staleness tests become time-dependent and flaky.
- Tests must assert real behavior. A test that only checks "did not throw" does not count.

## 15. Milestones

Superseded by the phased roadmap in §18 and
[the roadmap document](agent-docs/superpowers/plans/2026-08-28-bot-roadmap.md). An earlier
M1–M8 list lived here and had drifted out of step with the roadmap's ordering; keeping two
sequencing plans in one document guarantees one of them is wrong.

## 16. Risks

| Risk | Mitigation |
|---|---|
| Jira DC API shape differs from assumptions | Verify live before parsing; fixtures from real responses |
| Missing `write:org` scope breaks a future task | `bot doctor` checks scopes explicitly |
| launchd minimal env lacks credentials | Explicit credential sourcing; `doctor` run inside the agent |
| Pre-approval creeps into de facto full autonomy | Mandatory expiry + rate limits + audit provenance |
| Loopback dashboard later exposed remotely | Documented as a hard precondition; bind address asserted in code |
| Scope sprawl back into "automate everything" | Each new task is a separate spec; skeleton unchanged |
| Copilot CLI blocked by org policy (§13) | Judgment work moves to human-initiated chat agents; deterministic mutations are unaffected, so P0–P9 stand |
| Work done in Chat escapes the audit trail | Every agent's mandatory final step is `record-outcome.ts`; a handoff stays `awaiting-human` until it reports back |
| SQLite contention between agent and dashboard | WAL + `busy_timeout`; single-writer discipline; per-run transactions |
| Database file grows despite pruning | `DELETE` does not shrink the file — checkpoint after prune, periodic `VACUUM` |
| `node:sqlite` API changes | It is stable in v24.18.0 (§2), but all access is confined to `src/store/`, so a swap to another driver touches one directory |

## 17. Open questions

1. Staleness threshold — 3 days assumed. Correct?
2. Should applied mutations really be pruned at 30 days along with everything else, or retained for 365 days as recommended in §8?
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
| P2 | Store, audit & retention | SQLite schema, migrations, queries, pruning |
| P3 | Connectors & `doctor` | Jira, git, GitHub reads against fixtures |
| P4 | Standalone task scripts | Three independently runnable scripts |
| P5 | **Composite standup** | **First genuinely useful output — POC checkpoint** |
| P6 | Scheduler | launchd, quiet hours, sleep/offline catch-up |
| P7 | Executor & queue | Actions queued; approve via CLI |
| P8 | Dashboard | Full control surface + audit navigation |
| P9 | Enable first pre-approvals | Operational, not code |
| P10+ | New tasks & chat-agent handoff | Sprint hygiene, PR feedback, human-initiated agent work |

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
9. **The bot never invokes a language model.** There is no headless path to one (§13), and no phase may introduce one. Judgment work is prepared by the bot and initiated by a human in Chat.
10. A `chat:handoff` is never resolved by the executor. It stays `awaiting-human` until the agent reports its own outcome back into `actions`.
