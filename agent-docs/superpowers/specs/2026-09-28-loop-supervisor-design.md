# Loop supervisor — design (2026-09-28)

> Status: Spike 0 ran 2026-09-28/29 (§8); D13 entry agents built in B1–B8;
> **supervisor not built**. Every repository fact below carries a source. Untested
> supervisor behavior is marked `ASSUMED` or `UNKNOWN`.
> Author instructed to ground every claim per `grounding.instructions.md`; this document follows
> that rule throughout.
>
> Open questions resolved 2026-09-28 by judgment (§11); items reserved for the user in §12.

## 1. Problem & evidence

Two independent failures reported by the user, both in the orchestration layer *above*
`scripts/loop.sh` — the inner verifier loop itself is reliable.

**1. Orphan VS Code windows.** `scripts/loop.sh` refuses to open a new window and requires one
already open on `$REPO` (`scripts/loop.sh`, the `window_exists_for_base` check and the
`ABORT — no open window` branch). `LOOP.md` §1.2 states the reason directly: *"a window it
opens itself cannot be closed reliably, and one folder per item left nine orphan windows on
2026-09-27."* `LOOP.md` §1.4.1 additionally documents that no automated close exists at all:
*"`code` has no close flag, System Events cannot reach fullscreen or other-Space windows, and
`kill -TERM` on the renderer raises a confirmation box on a real loop window (2026-09-27)."*
So the current mitigation is "reuse forever, never close" — workable for one human running one
loop by hand, not for a supervisor running many concurrently.

**2. The agentic layer stalls, not the verifier.** `src/store/migrations/0007-loop-runs.sql`
defines `loop_runs.outcome CHECK (outcome IN ('passed','failed'))` with
`CHECK ((outcome IS NULL) = (finished_at IS NULL))` — a row can be left with `outcome IS NULL`
indefinitely if the driver process dies mid-run; nothing currently reaps it
(`0007-loop-runs.sql` schema comment: *"there is no column an agent can set to claim
success"* — true for outcome, but nothing enforces an upper bound on how long `outcome` stays
NULL). `dashboard/pages/loops.ts` (`currentState()`) renders such a row as
`` `${run.latestState} (running)` `` forever. The user's reported figures — 86 rows, 83
passed, 2 failed, 1 null outcome — are `ASSUMED` (a live count of `loop_runs` was not run this
session; see Spike 0 note). Independent of the exact count, the mechanism for the stuck row is
real and traced above: the driver (`scripts/loop.sh`) is a foreground bash loop with no
external watchdog, and `code chat -r` (LOOP.md §1: *"prints nothing useful and its exit code
is meaningless"*, `scripts/loop.sh` header comment) means the driver has no signal at all when
the *dispatch* — not the verifier — is what's stuck: a confirmation prompt, a dropped
subagent response, or a chat waiting on the user all look identical to "still working" from
outside the session.

**Why the inner loop is not the problem.** `LOOP.md` §2 states the design explicitly: *"the
agent never says whether it succeeded... the driver runs the repo's own suite and reads `$?`."*
That verifier-decides-done contract is sound and is being kept unchanged; this document is
about the layer that dispatches turns and notices when a turn never lands.

## 2. Goals / non-goals

**Goals**
- Never leave an item silently stuck: every `working` item either advances, degrades through a
  bounded recovery ladder, or lands in a human-visible `needs_human` state (D6).
- No orphan processes: supervisor-owned VS Code instances it can start, use, and kill, isolated
  from the user's own windows (D4).
- No leftover temporary by-products: every supervisor-created scratch resource is owned,
  removed and verified on item exit or supervisor shutdown, including failed/cancelled work
  (D7 and §5 teardown contract). Completed code, PRs and durable audit records are not scratch.
- Keep pushing without violating D4's off-limits categories: restart, resume, substitute;
  never block on a human. Park exhausted or human-only items with evidence and continue
  other items (D6/D14/D15).
- Resumable from any restart: all state in SQLite, `tick()` idempotent (D5).
- Human interface that is desired-state, not command-and-hope: pause/resume/cancel only ever set
  intent; `tick()` reconciles at a safe point (D8).

**Non-goals**
- **Merging.** Never done by the supervisor, ever (D1). `gh pr merge` is added to a
  supervisor-local denylist (§3, D1), separate from and in addition to
  `src/core/policy/denylist.ts`.
- **Approval gates.** Spec approval is off everywhere (D10); the user spot-checks after the
  fact, not before.
- **Replacing `cc`'s executor.** `src/executor/` remains the only code in this repo that
  performs the specific mutations it already performs (Jira resolve, and whatever merge
  support exists — `AGENTS.md`, Layer 4 row: *"`src/sync/`, `src/executor/` | Orchestration.
  The executor is the only writer."*). The supervisor is new, separate code (D3); it does not
  fold into or replace this.
- **Being a chat hook.** Chat hooks (`PreToolUse` etc.) are confirmed unavailable on this
  machine — `DESIGN.md` §13: *"the Copilot org flag `chat_preview_features_enabled=false`
  forces the `ChatHooks` policy off, and `chat.useHooks` is `disallowConfigurationDefault`...
  Five probes fired zero hooks."* The supervisor cannot and does not depend on them; it works
  entirely from outside the session, the same posture `scripts/loop.sh` already takes
  (`LOOP.md` §2, "Why the driver lives outside the session").

## 3. Decisions (D1–D15)

Recorded decisions from 2026-09-28, revised with the user's DRIVER-REV authorization.
The narrow-allowlist and human-waiting parts of the earlier D4/D6 are superseded below.
Everything about the supervisor remains **designed, not built**.

**D1 — Supervisor never merges.**
`gh pr merge` is refused by a deny rule in the dedicated profile's terminal rule map (D4), plus D6 detection/audit (not a guaranteed pre-execution barrier), on top of and
independent from `src/core/policy/denylist.ts`, which does not currently list it (verified:
`src/core/policy/denylist.ts` `FORBIDDEN_ARGUMENTS` = `--no-verify`, `--force`,
`--force-with-lease`, `--admin`, `reset --hard` — no `merge` entry). Rationale: `STACK.md`,
"NOT YET VERIFIED": *"Whether `gh pr merge` actually succeeds — Cannot be verified without
performing a real merge."* An unproven, destructive, hard-to-reverse capability is exactly what
`operationalSafety` guidance reserves for explicit human action. Per-repo `closeOn` is
`merged` or `ready`, configured up front, not inferred:
- `merged` (e.g. grove — external auto-merge on approval per
  [grove/AGENTS.md](../../../../grove/AGENTS.md) Push Safety Policy: *"CI must pass... Merge
  the PR — only then is `master` updated"*): supervisor waits for the external merge event,
  then resolves the ticket. "Awaiting approval" is a normal long-timeout state, not a stall:
  shown on the board immediately; one macOS notification after 24h in `awaiting_approval`
  (held in quiet hours); then one line per day in the morning digest; never becomes
  `needs_human` on its own. `closeOn` is per-repo config; grove's entry is `merged`; any
  repo may be enrolled by adding a config entry (see D12).
- `ready`: CI green + `mergeable` → the supervisor's job for that item is done; the actual
  merge is a human action outside the supervisor's board. Note `STACK.md`, "Known Divergences":
  *"`mergeable` ... Returns `UNKNOWN` on first query because GitHub computes it lazily;
  resolves on re-query. Never emit a stall from `UNKNOWN`."* — the same rule applies here.

**D2 — Bounce-backs after PR opens.**
CI red → worker fixes directly, no architect turn (the failing CI job already *is* the check,
so no new spec is needed — same "verifier already exists and is red" shape `LOOP.md` §4.1
requires before looping at all). Review comment → architect turns it into a red test, then
worker loops on it exactly like a fresh `scripts/loop.sh` run; an untestable review comment
(style, wording) no longer goes straight to `needs_human` — it goes to `loop-judge` (D11),
which decides reply-with-evidence, folding a trivial fix into the next re-arm, or
`needs_human` only if that decision is itself `CRITICAL`. A "testable" classification is
verified mechanically, not taken on the architect's word: the architect must produce a spec
that is red at iteration 0 — `cc loop start` refuses a verifier that already exits 0
(`LOOP.md` §3: *"the driver aborts if it passes"*). If it cannot produce a red spec within one
architect turn, the item is reclassified untestable and goes to `loop-judge`. Max 3
bounce-backs per PR, then `needs_human` regardless of what the 4th comment says — this mirrors
the finite-budget principle already in the design (`LOOP.md` §2, "Budget": *"a model looping
confidently looks exactly like a model making progress"*). PR closed unmerged →
`needs_human` unconditionally.

**D3 — Placement: top-level `supervisor/`, separate from `src/`.**
Run via `npm run supervise`. It is the only code allowed to call `code chat`. Architecture-
guard rule, decided (§11) and applied to `ai-guard.config.json` from a terminal in build step
2 (§10) once `supervisor/` first exists (`AGENTS.md`, "Platform-Managed Files": *"`ai-guard.
config.json` is Copilot-ignored. Modify it from a terminal, not the edit tool."*):

```
{src,dashboard,bin}/** must not import supervisor/**
```

**Widened to include `dashboard/` and `bin/`**: `dashboard/` is not under `src/` — it is its
own top-level directory, grouped only conceptually into "Layer 5" alongside `src/mcp/` and
`bin/` (`AGENTS.md`, Layout table: *"5 | `bin/`, `dashboard/`, `src/config/`, `src/mcp/` |
Entry points."*) — so a `src/**`-only rule would not stop `dashboard/pages/supervisor.ts` from
importing `supervisor/**` directly, and §6 already commits `dashboard/` to reading only
`src/store/` repositories, never `supervisor/**`.

`cc` keeps its own invariant 9 (`DESIGN.md` §19: *"It never invokes a language model... no
phase may introduce one"*) — the supervisor is not a phase of `cc`, it is a separate program
that happens to use `cc`'s store, the same relationship `scripts/loop.sh` already has today.
The supervisor may dispatch a model (`code chat`) but must never treat model *output* as a
decision — only verifier exit codes, CI state, and GitHub/Jira state decide anything, matching
the load-bearing rule already stated for the inner loop (`LOOP.md` §2: *"the agent never says
whether it succeeded"*).

**D4 — Dedicated loop VS Code instance.**
**VERIFIED** (C-ter 0): launch `code --user-data-dir tmp/loop-vscode --new-window <folder>`;
dispatch with `VSCODE_PORTABLE=tmp/loop-portable code chat -m <agent> "<prompt>"`, with
`tmp/loop-portable/user-data` symlinked to `tmp/loop-vscode`. Passing `--user-data-dir`
to `chat` does not route it (Spike 0 i). **DESIGNED:** each concurrent child has its own
portable dir, user-data-dir, session store, nonce and verified Electron root; dispatch is
routed to that exact child, never the user's main instance (S17). Before teardown verify the
exact root argument and snapshot descendants; TERM, then KILL the verified root and remaining
snapshotted descendants if needed. **VERIFIED** TERM stopped a live `sleep` in C-quinque 4,
but did not stop a pending request in C-ter C5.

**Routing decision — user, 2026-09-29 (DESIGNED, not built):** always open or reuse a child VS
Code instance whenever the work targets a folder different from the current main
workspace/target context. Match/reuse an existing child rooted at the exact target folder by
verifying its PID, profile (portable/user-data pair), workspace root and last dispatch nonce
before reuse; if none matches, launch a new one rooted there. Never reuse a child rooted in a
different folder for a different target — a mismatch is `DISPATCH_LOST`, not a valid route.
This routing decision addresses only the **outside-folder file-read approval prompt** for
paths inside that child's own folder; it does not exempt terminal, web/network, or other-tool
confirmations, which stay governed by D4's off-limits list and by S13/S14 containment (still
**UNKNOWN**). Do not over-promise: this avoids one specific prompt class, not all prompts.

**DESIGNED child approval policy (not yet verified end-to-end):**
`chat.tools.global.autoApprove: true`, `chat.permissions.default: "autoApprove"`,
`chat.tools.terminal.enableAutoApprove: true`, with terminal auto-approval on. A child
self-approves by this *profile configuration*, not by clicking UI or forging consent keys.
**VERIFIED** unattended child terminal execution after human consent: C-quinque 2 reports
`STATE {'value': 1, 'completedAt': 1790661689731}`, `MODE {'modeId': 'agent',
'permissionLevel': 'default'}`, `TOOLS [('run_in_terminal', {'type': 1},
{'commandLine': 'touch /Users/jay.quach/dev/bot/tmp/spike0-c5.txt'})]`, `TARGET True`.
This proves unattended execution, **not** that global approve-all was honored (the recorded
permission level was `default`). Each new profile still needs a human Copilot sign-in and
one-time warning acceptance; the driver never writes consent storage. Persistence across
relaunch is **UNKNOWN** (S18).

**Off-limits, even in the child:**

1. **System changes:** writes under `/System`, `/usr` (except `/usr/local`), `/bin`, `/sbin`,
  `/etc`, `/Library`; changes to shell rc files or launchd plists outside the supervisor's
  own; and `sudo`.
2. **Secret material:** reading or printing private keys (`~/.ssh/id_*`, not
  `known_hosts`), `~/.aws`, `~/.config/gh/hosts.yml`, keychain via `security`, `.env*`
  secrets, or echoing token environment variables such as `JIRA_DC_TOKEN`. Credential
  *use without exposure* is allowed: SSH git, `gh`, and curl with
  `-H "Authorization: Bearer $JIRA_DC_TOKEN"`.
3. The compiled denylist in `src/core/policy/denylist.ts`, including alternate/short forms
  and bypasses. This remains an `AGENTS.md` invariant.
4. `gh pr merge` remains forbidden by D1.

The dispatcher kept (3) and (4) beyond the user's “only security” wording because they are
existing recorded invariants. **OPEN QUESTION FOR USER (§12):** whether to change either;
the driver may not silently remove them or wait for an answer. This replaces the narrow
fail-closed allowlist as the *primary* approval model. **UNKNOWN:** VS Code terminal deny
regexes overriding global approve-all (S13); the layers below are defense in depth, **not a
proven prevention boundary**. Do not claim the policy enforced until the containment spikes
pass; on failure park the affected work and continue other items, never execute an off-limits
command as a fallback.

1. Generate terminal deny regexes from (1)–(4); test precedence with positive controls (S13).
  Non-terminal edit, fetch and MCP tools require separate containment; pending S9 and S14,
  disable unverified write-capable MCP in the child using an installed-source-verified key.
2. D6 detects pending or denied calls: off-limits → kill that child, park the item with
  evidence, continue. A confirmed off-limits call is an audit incident, not proof of safety.
3. Audit **every** confirmed `toolSpecificData.confirmation.commandLine` post-hoc against
  (1)–(4), writing a `supervisor_events` row. This cannot undo a confirmed call.
4. Retain repo hooks (`.githooks/pre-commit`, grove's `.husky/pre-push`). Optional, user-owned:
  use a `gh` token without merge rights in the child profile.

**Sandbox trade-off (UNKNOWN until S14):** `chat.agent.sandbox.enabled` prevents reads of
`~/.ssh` in prior sandboxed sessions, protecting secrets but breaking git over SSH. Disabling
it permits SSH and widens credential exposure. S14 decides the child setting by testing both
states, secret/system containment and a real authorized SSH git push; neither setting alone
proves containment. Drop the PATH shim: C-quinque 3 showed the agent did not inherit
`terminal.integrated.env.osx.PATH`; C-quater showed `/usr/bin/git` bypasses it.

**D5 — Runtime.**
One idempotent `tick()`; all state in SQLite so any restart resumes from the database, not from
in-memory state. Resident process under `launchd` `KeepAlive`, ticking ~30s, writing a
heartbeat row; a second `launchd` job on `StartCalendarInterval` (not `StartInterval` —
`DESIGN.md` §12 gives the reason with a cited man-page quote: *"`StartInterval`... 'If the
system is asleep during the time of the next scheduled interval firing, that interval will be
missed'"*) every 5 minutes restarts the resident process if the heartbeat is stale. Manual
single pass: `npm run supervise -- tick`. Runs 24/7; notifications respect quiet hours by
default (`DESIGN.md` §12: *"Quiet hours 23:00–07:00, implemented structurally via
`StartCalendarInterval`"*) — the user did not object to this default in the brainstorm.

**Grounding note, not previously flagged in the brainstorm:** `STACK.md`, "Scheduling" section
states plainly: *"The hourly `launchd` runner was dropped"* and *"`~/Library/LaunchAgents` —
Empty — nothing installed, nothing to remove"* (verified 2026-08-28). Separately, `DESIGN.md`
§13 records a **one-shot** `launchd` probe that successfully fired `code chat -m ask -r`
headlessly (verified 2026-08-28/2026-09-14). Neither fact demonstrates a **resident**
`KeepAlive` `launchd` job exists or has ever been tried in this environment — D5 is a new kind
of `launchd` usage, not a revival of the removed one, and must be spiked on its own (§8).

**D6 — Stall detection.**
Store `dispatch_at`, `instance_started_at` (`ps -o lstart` on verified root), and a
per-dispatch nonce embedded in the prompt (`[loop <KEY> <nonce>]`). Search the dedicated
instance's `tmp/loop-vscode/User/workspaceStorage/*/chatSessions/*.jsonl` for the nonce.
Fold `kind:0` as root, `kind:1` as set-at-path and `kind:2` as append-at-path (not replace);
`requests` is append-only (B vii). Let R be `requests[-1]` and `stale_s` = now minus file
mtime. Classify in this order:

| Class | Condition | Action |
|---|---|---|
| `DISPATCH_LOST` | No nonce file after 120s from `dispatch_at` (persistence delayed ≥11s in C-quinque 5) | Re-dispatch once, then rung 3 |
| `RELIC` | `mtime < instance_started_at` | Never call it pending: value 4 survives KILL/relaunch (C-ter C6); treat as `DISPATCH_LOST` |
| `ERRORED` | Last request has an error result (D15); exact JSONL field **UNKNOWN** (S15) | Check artifacts first, then retry/substitute under D15 |
| `PENDING` | `R.modelState.value == 4`, a `toolInvocationSerialized` response has absent `isConfirmed`, `mtime ≥ instance_started_at`, `stale_s ≥ 60` | Split by command below |
| `RUNNING` | `value == 0` and `stale_s < 600` | No action |
| `HUNG` | `value == 0` and `stale_s ≥ 600` | Rung 1: nudge |
| `ENDED` | `value == 1` with `completedAt` | Driver advances or checks verdict; if driver dead D7 reaps |
| `ABNORMAL` | Any other value | Rung 2: fresh session |

Sequencing is explicit: the armed, per-dispatch watcher (below) runs first. While its bounded
(~3 min) window is open it checks for a pending prompt promptly, without waiting for the
`stale_s ≥ 60` threshold in the table above, and may itself approve a narrowly matched,
one-time prompt from an allowed class. The classify/park step in this paragraph applies only
once the watcher's window ends with no matching/valid prompt (unmatched or expired), or the
watcher instead detects an off-limits prompt.

At that point, read `toolSpecificData.confirmation.commandLine`. Under child approve-all,
pending is an **anomaly**. An off-limits (D4 a–d) match becomes `PENDING_DENIED`: kill the
verified child, park in `needs_human` with command evidence, continue other items. Otherwise,
if it is still pending and the child's effective profile settings have drifted from
authorized, verify them, relaunch in a fresh session, and retry **once** — bounded, per the
existing design, never open-ended; if still pending after that, park and continue. No nudge
or open-ended wait; the durable, code-only driver (D5/D14) itself never grants approval and
never asks the main thread to click — approval, when it happens, comes only from the armed
watcher's own narrowly matched, one-time-scoped decision, within its own armed window, and is
never a blanket grant. Denied non-terminal calls follow the same off-limits/unknown split;
missing command evidence is `UNKNOWN`, not permission to run it.
Do not use `pendingRequests`, `isComplete` (always
true on serialization), or `isConfirmed.type` (type 4 is not cancellation) as the signal
(B iii, C-ter). Recover other stalls with nudge → fresh session → verified-root teardown
and relaunch (D4) → `needs_human` with a durable session identifier and stored verifier tail
(not a pointer to a removed temporary file); continue other items. Tests/diff/mtime
progress still resets the 10-minute clock; the 34-minute hard ceiling remains.

**Watcher lifecycle — user, 2026-09-29 (DESIGNED, not built; not probed beyond the narrow
S16 proof in §8):** the bounded watcher is distinct from the durable, code-only driver above
and from that driver's own never-approves invariant — it is a short-lived, per-dispatch
mechanism the dispatcher arms immediately before a dispatch, including a synchronous
main-thread subagent when permitted in the same folder (D14). It runs bounded, e.g. ~3
minutes, driven by a low-overhead pending-session signal (poll session/nonce state, not a
permanent ~200ms AX full-tree walk), and inspects the accessibility tree only once that
signal indicates a pending prompt. Before pressing anything it must match the exact live
session, dispatch nonce, PID, tool name and target path against what was just dispatched, and
the prompt must be an explicit, one-time-scoped allow — never a blanket grant, and never a
forged/synthesized session or consent state. Multiple sequential approvals inside one armed
window are allowed only if each is independently re-validated against the same criteria;
approving the first is never grounds to wave through the second. A press is not the end
state — the watcher must confirm the tool call actually completed, not merely that a button
was activated. Ambiguous matches, any off-limits match (D4 a–d), or content requiring human
judgment (e.g. web-fetch results needing review) fail closed: park the item, never approve.
On a bounded-window timeout with no matching/valid prompt, classify per the table above and
park or continue — the watcher does not wait indefinitely. It can be re-armed for a later
dispatch or phase of the same or a different item, but must never run as an uncontrolled,
open-ended loop. Containment (S13/S14) and general unattended-approval safety (S16) remain
**UNKNOWN**; this is a design intent, not a proven behavior, and the AX-watcher's own
resource cost (CPU/battery impact of periodic polling and tree walks) is **not measured**.
Do not over-promise: routing to the exact-rooted child (D4/D14) avoids only the
outside-folder file-read prompt class for paths under the routed target — it does not
eliminate other confirmation classes. The watcher instead covers whichever of those still
occur after routing (terminal commands, reads outside the routed target, or an initial
web-fetch request when the target is fully identifiable), each individually matched and
verified before approval, never a blanket grant; a web-fetch result requiring human content
review fails closed regardless, as does any ambiguous or off-limits/unknown match.

**N = 10 minutes, decided (§11).** Rationale: `scripts/loop.sh`'s own per-turn budget is
`POLL_LIMIT=72` × 5s = 6 minutes per iteration (`scripts/loop.sh` line 30), so the driver's own
budget fires first on a merely slow turn — the supervisor only needs to catch what the driver
cannot: a dead driver, an unanswered prompt, or a dropped response. There is also a hard
ceiling independent of the three signals: an item in `working` longer than
`MAX_ITER` × `POLL_LIMIT` × 5s + 10 min (= 34 min with the defaults, `MAX_ITER=4` at
`scripts/loop.sh` line 29) with no driver verdict at all is stalled regardless.

**D7 — Housekeeping every tick.**
Finish/abandon `loop_runs` rows whose driver is dead (`outcome IS NULL`, per §1 evidence) —
note this reuses `loop_runs`/`loop_iterations` (`0007-loop-runs.sql`) rather than duplicating
them; see §5 for why the supervisor still needs *new* tables alongside these. Kill loop
instances (D4) with no live item assigned. **Teardown is a required state transition, not
an occasional prune.** Track ownership of every by-product at creation (§5); on `done`,
`cancelled`, `needs_human` or exhausted/failed work, stop the watcher and in-flight dispatch,
then the verified child process tree, release the child profile, remove generated sessions,
portable/user-data directories, scratch clones/worktrees, temporary specs/reports/logs and
probe files created for that item, and verify absence before marking cleanup complete.
On `paused` or `awaiting_approval`, release active processes and watcher; retain only
explicitly registered resume state (e.g. a clean worktree if needed) until the item resumes
or reaches a terminal state. Store the evidence needed for resumption or `needs_human` in
the database **before** removing files, not as dangling links to deleted scratch files;
reopen a parked item in a new, separately owned scratch environment.
Never delete the user's workspace, pre-existing windows/profiles, user-created files,
committed changes or a PR. Do not remove an owned worktree with uncommitted changes until
its diff is captured for recovery and the item is parked with a clear cleanup failure;
never silently discard work. A shared child may be reused while another live item owns it;
the final owner triggers teardown. Cleanup is idempotent, retries after crashes on every
tick, and reports failures instead of declaring a clean finish. On supervisor halt/uninstall,
stop both its resident and watchdog jobs, drain owned items and run the same verified
teardown; leave no running supervisor-owned processes or temporary files (§5).

**D8 — Human interface: desired-state model.**
Every item has `desired` ∈ {`run`, `paused`, `cancelled`}; every human control only sets this
column. `tick()` reconciles, and a pause takes effect only at a safe point — never mid-commit.
Global `supervise halt`. Full table in §6.

**D9 — Intake, pluggable sources.**
(a) manual — chat `/loop <key> <brief>` (enqueue only; the architect and worker still run
*inside* the loop instance, not in the user's own chat), CLI
`npm run supervise -- add <key> --repo=<r> --brief="…"`, dashboard form. (b) plan files —
unchecked boxes in a configured file (e.g. `grove/HOMEWORK_PROGRESS.md`, confirmed to exist:
[grove/HOMEWORK_PROGRESS.md](../../../../grove/HOMEWORK_PROGRESS.md)), queued in file order.
(c) Jira tickets assigned to the user carrying a `loop` label — label is `loop`, decided
(§11); Jira labels are created on first use, so no admin step is needed. Dedupe by key across
all three sources.

**D10 — No approval gates.**
Spec approval off everywhere; contrasts deliberately with the manual loop's human checkpoint
at green (`LOOP.md` §6: *"the diff gets read once, by a person, before it leaves the
machine"*) — see §9 for why removing that checkpoint is a named risk, not a free change.
"Reopen with correction" creates a follow-up item carrying the user's note, rather than
mutating the closed one. **Accepted as decided (§11).** Mitigation: the phase-4 referee is
mandatory in the supervisor and runs on `loop-judge` (the `oracle` tier) — it is reject-only, so its
`accept` is necessary but never sufficient; the verifier's exit code and CI still decide.

**D11 — Model routing & escalation.**
Default driver/architect = the registry's `architect` tier (`registry/model-tiers.json`),
currently GPT-6 Sol, chosen in the 2026-09-28 coding-benchmark re-tier; worker = the
`worker` tier (`loop-worker`, currently GPT-5.6 Luna); judgment = the `oracle` tier
(`loop-judge`, currently Claude Opus 5.5). Model routing itself now lives in
`registry/model-tiers.json`
(worker/dispatcher/architect/oracle tiers, `cc models`/`cc models pick`/`cc models apply`,
escalation on failure/doubt capped at `oracle` — see `LOOP.md` §6a), not hardcoded here or in
agent frontmatter. Any question that would otherwise go to the user goes to
  `loop-judge` first; only a `CRITICAL` verdict creates `needs_human`. `CRITICAL` means the
  decision: (1) enrolls a repo not already enrolled for loops, or pushes to / comments on /
changes someone else's PR, branch, or ticket; (2) involves credentials, money, production, or
  deleting data; (3) changes a recorded design decision (D1–D15 here), an `AGENTS.md` invariant,
the denylist (`src/core/policy/denylist.ts`), or `ai-guard.config.json`; (4) is irreversible
outside this machine beyond the normal loop flow. Every judgment is appended to
`tmp/<KEY>-decisions.md` and recorded as a `supervisor_events` row (§5) so the user can
spot-check it after the fact. Only top-level `loop-architect` and `loop-analyst` are
human/supervisor entry agents; `loop-worker*` are headless leaves. **DESIGNED (D14,
2026-09-28 — see status note in D14 below):** architect, analyst, worker and any
tool-using judge run in child windows by default. Headless
top-level architect access to a nested judge is **ASSUMED** (S10); if unavailable, the
supervisor dispatches `code chat -m loop-judge "consult tmp/<KEY>-consult.md"` to a
child, checks the judgment artifact, then re-dispatches the architect. A subagent unable
to nest-dispatch returns `CONSULT_NEEDED: tmp/<KEY>-consult.md` (B vi). The supervisor
never waits on a human for a consult; park if exhausted and continue. D15 handles model
errors; routing priorities live in `registry/model-tiers.json`.

**D12 — Repo- and task-agnostic.**
Nothing in supervisor code may name a specific repo, branch, test runner, or task type.
Everything repo-specific lives in one per-repo config entry: path, base branch, verify
command, `closeOn` (`merged`/`ready`), and a plan-file path for D9b if any — the same shape
the verifier already uses: `scripts/loop.sh` parameterises entirely via `REPO` (line 25),
`SPEC` (line 27), and `verify()` (line 35), and the supervisor's per-repo config is that same
parameterisation lifted one layer up, not a new mechanism. Enrolling a repo means the user
adding an entry; agents never self-enroll — this is exactly why `loop-judge` treats
enrollment as `CRITICAL` (D11). A repo with no config entry is refused at intake with a clear
message, never guessed at. `grove` is the first entry, not a special case baked into the code.
Decided by the user, 2026-09-28 (§12).

**D13 — Human entry: two agents, no router.**
A router adds a turn to every job. The entry agents' task-fit preflight STOP and handoffs
correct wrong picks; handoff parsing is verified from installed source (B viii), a live
click is not. Every STOP also names the replacement in text.

| Task | Entry agent | Tier → recommended model (`cc models pick <tier>`) |
|---|---|---|
| Implementation, reproducible bug (red test first), checkable doc change, own-PR feedback and resumes | `loop-architect` | architect → GPT-6 Sol |
| Planning, others' PR review (draft only), investigation without a repro | `loop-analyst` | architect → GPT-6 Sol |
| Research, questions, prose docs | `loop-analyst` | dispatcher → Gemini 3.8 Flash |
| Referee / consult | `loop-judge` (leaf, not a human pick) | oracle → Claude Opus 5.5 |
| Grinding | `loop-worker*` (driver only) | worker → GPT-5.6 Luna |

`loop-analyst` offers “Loop this item” → architect; architect offers “Not loopable —
investigate or plan instead” → analyst. Preflight order: (1) task fit, STOP `WRONG AGENT:
this is <type>. Pick <agent> with <model>.`; judge requires a consult path and worker
requires driver's `Current verifier output:` line; (2) selected-model cost via
`npm run --silent cc -- models self --session-log=<VSCODE_TARGET_SESSION_LOG> --tier=<tier>`
and `cc models pick <tier>`, warn once but never STOP for price or `copilot/auto`/unknown;
only *selected*, never backend-served model is known (B vii); (3) explicit repo path or
name resolving to `~/dev/<name>`, `git -C <repo> rev-parse --abbrev-ref HEAD` or STOP
and ask for repo; **today** outside read via `list_dir` needs no grant (B ix), terminal may
require unsandboxed approval, edits require a workspace folder or loop window. **Target
(D14):** target-repo or `bot/tmp/rv<pr>` scratch-clone child owns all repo preflight,
edits and network calls; no main-thread outside-folder permission step. Only Clover remotes get a WS ticket with Epic
`WS-5345`, while other repos use `<REPO>-<slug>` and no Jira ticket; (4) resume using
`tmp/<KEY>*`, `cc loop status`, branches and `gh pr list --head <branch> --state all`:
no artifacts → phase 0; consult without judgment → judge; spec without driver → phase 2;
unclosed dead run → note then start new run (D7 reap not built); passed/no PR → phase 4;
PR open → phase 6; PR merged/ticket open → resolve. Analyst resumes from its incrementally
written `tmp/<KEY>-report.md`; actual artifacts outrank prose.

Variant names use one model slug per registered model in this and higher tiers:
`loop-worker.m-<slug>`, `loop-architect.m-<slug>`, and `loop-judge.m-<slug>`.
Headless variants stay visible because B viii found `user-invocable:false` prevents
`code chat -m` lookup; their STOP preflight guards accidental picker use. Humans pick
the base agent then choose any model (picker override holds until agent re-selection).
The registry's `interactive` list contains analyst and dispatcher without variants;
the earlier one-off model probes have been retired.
The entry agents and `models self` were built at HEAD in B1–B8; this does **not** mean
the supervisor has been built.

**D14 — The driver never blocks on a human (DESIGNED).**

> **Status note (2026-09-29):** D14 below is the design as proposed on 2026-09-28, for a
> supervisor that is still **not built**. Item (d)'s original restriction of main-thread
> subagents to "read-only in-workspace" analysis has since been loosened at the
> policy/documentation level (`LOOP.md` §7.1, `.github/agents/loop-dispatcher.agent.md`): a
> 2026-09-29 proof showed a main-thread subagent's per-request approval is not confined to
> reads or to this workspace, demonstrating the mechanism works. That proof is a historical
> fact about capability, not a standing permission: per the routing decision below, a
> tool-using main-thread subagent remains permitted only for same-folder (current active
> root) work, under the same explicit approval and off-limits rules as any other main-thread
> action; any task whose target folder differs from that root **always** routes to the
> exact-rooted child (D4), regardless of task size or read-only status — no one-off
> exception. General-purpose, unattended subagent automation remains unproven, and the
> durable, code-only tick process below — once built — still favors the child driver for
> that reason. This note updates guidance only; it does not change the supervisor
> implementation contract, which does not exist yet.
>
> **Status note (2026-09-30), supersedes the routing sentence above for today's loop:**
> the entry is `loop-dispatcher` (dispatcher tier). It runs `loop-architect` as a
> `runSubagent` call in the user's window and routes `WRONG AGENT` / `CONSULT_NEEDED` replies
> (`.github/agents/loop-dispatcher.agent.md`, `tests/unit/agents/dispatcher-gate.test.ts`).
> The architect's driver dispatches the worker with `code chat -m` into an already-open repo
> window. The exact-rooted child route is **not in use**: `code chat` ignores
> `--user-data-dir` (spike table below, VERIFIED FAIL), a child profile's Copilot returned
> 403 on 2026-09-30, and the supervisor does not dispatch. Paths below naming `~/dev/bot`
> are historical evidence from the repository's previous location, not paths to use.

The durable driver is the **code-only** `supervisor/` tick process (D3/D5), with no LLM
and no approvals — the bounded, per-dispatch watcher described in D6 is a separate, time-boxed
mechanism armed around a dispatch, not a capability of this durable process itself. It
persists state and advances other items when nobody is around.
Chat main thread is only an enqueuing/monitoring/reporting front end, never a worker.
Its only allowed actions are (a) in-workspace `read_file`/`grep`/`list_dir`, (b) edits
under `bot/tmp`, (c) terminal commands *already matching* the main profile's
`chat.tools.terminal.autoApprove` rules (dispatching `code chat`, `cc` status and driver
scripts), and (d) a `runSubagent` call for an appropriately scoped, per-request task confined
to the current active root — not only read-only, per the status note above — e.g. judge
reading tmp. A task whose target folder differs from the current active root is never a
main-thread subagent (see routing decision below).

**Routing decision — user, 2026-09-29 (see D4, DESIGNED, not built):** when the task's target
folder differs from the current active root (in a multi-root workspace, "current" means
whichever root is the active target context for the task, not merely any other open root),
**always** open or reuse the exact-rooted child (verified PID/profile/workspace/nonce, D4) —
never a main-thread subagent, regardless of task size or read-only status; this is what
avoids the outside-folder file-read prompt for paths under that folder, with no truly
one-off exception. A main-thread subagent remains permitted only for same-folder (same
active root) work, under that root's own explicit approval and off-limits rules. This does
not change the durable driver's own child-only mandate for git/gh/build/install/test/Jira/
GitHub writes, and it does not cover terminal, web, or other-tool confirmations.

**ASSUMED from session experience, narrowed 2026-09-29:**
subagent confirmations surface in the MAIN window; whether they block the parent is still
**ASSUMED** pending a broader S16 run, but a narrow proof (§8) showed one such confirmation
approved by a pre-armed watcher without a person watching, for a call outside this
workspace. Durable, unattended work — real-repo edits, git/gh, installs/builds/tests,
Jira/GitHub writes — still runs in child windows by default, not via main-thread subagents:
general-purpose unattended subagent approval/containment is **not** proven. A child opens
the target repo or a scratch clone under `bot/tmp`. Multiple children need distinct portable
dirs/user-data-dirs (S17). Anything truly requiring a person is parked as `needs_human`
**with evidence**; tick immediately continues other items and produces one end report of
parked items. No turn waits for an answer.

**D15 — Model error detection and substitution (DESIGNED).**
Classify a child session's **last request** as `ERRORED` when it carries an error result:
“Sorry, no response was returned”, rate limit/quota, model unavailable, server error,
cancelled or empty response. Exact JSONL error field/value is **UNKNOWN** (S15). Before
retrying, inspect `tmp/<KEY>-report.md`, child-repo git status, the ledger and timeline;
a dropped final message can follow real work (**ASSUMED** from session experience), so
never duplicate a completed mutation based on chat text alone.

**VERIFIED** C-bis step 1 CLI parser excerpt:
`options:{_:...,mode:...,"add-file":...,maximize:...,"reuse-window":...,"new-window":...,profile:...,help:...}`;
`code chat` has no model flag. **VERIFIED** Spike 0 viii(a), installed-source inspection
(§8 viii: `It&&this.switchModelByQualifiedName(It)`): selecting an agent applies its first *available*
model, so an available-but-erroring model never falls through. **DESIGNED:** `cc models
apply` emits a single-model variant per registry tier model (e.g. `loop-worker.m-<slug>`)
instead of the redundant `.t2/.t3/.t4` tier variants; each variant's `model:` list has exactly
one model. Record the selected model **per dispatch**; on error, use the next model in the
same tier from `registry/model-tiers.json`. Rate limit gets **one** same-model retry with
bounded backoff; other errors substitute immediately. Same-tier substitution consumes no
D11 escalation rung; after tier exhaustion climb D11; after every tier is exhausted park
with evidence and continue other items. Pin fidelity and error detection remain **UNKNOWN**
until S15; this does not claim working substitution.

## 4. Architecture

Components, by directory (new unless noted):

| Component | Path | Role |
|---|---|---|
| Supervisor core | `supervisor/tick.ts` (proposed) | The one idempotent entry point; everything else is called from here |
| Item sources | `supervisor/sources/{manual,plan-file,jira}.ts` (proposed) | D9 pluggable intake, deduped by key |
| Recovery ladder | `supervisor/stall.ts` (proposed) | D6 detection + D15 errors, bounded retry and park-and-continue |
| Bounce-back handler | `supervisor/pr-review.ts` (proposed) | D2 |
| Loop-instance manager | `supervisor/vscode-instance.ts` (proposed) | D4/D14: route per-repo/item portable/user-data pairs; verify roots before teardown |
| Resource lifecycle | `supervisor/cleanup.ts` (proposed) | D7/§5: register ownership; stop watcher/dispatch/child, remove by-products, verify absence and retry failures |
| Dedicated profile | `supervisor/profile/settings.template.json` (proposed) | D4 child approve-all plus generated off-limits deny rules; S13–S18 gate containment |
| Model variant generation | `cc models apply` | D15: single-model variants only, verified by `--check` |
| CLI | `supervisor/cli.ts` (proposed), `npm run supervise` | D5, D8 |
| State | `src/store/migrations/00XX-supervisor.sql` (proposed) | §5 — lives in `cc`'s existing store, per D3 |
| Dashboard board | `dashboard/pages/supervisor.ts` (proposed) | D8 monitor, reading `src/store/` only (never `supervisor/**` — see D3 gap above) |
| MCP extension | `src/mcp/` (existing dir; new read-only tool) | D8, extend `cc_status` per `.github/instructions/central-command.instructions.md` |

State diagram for one item (D8 board columns, plus the edges D2/D6 add):

```mermaid
stateDiagram-v2
    [*] --> queued
    queued --> spec_red: architect triages + writes locked spec (LOOP.md §3/§4.1)
    spec_red --> needs_human: fails triage (LOOP.md §4.1) — not loopable
    spec_red --> working: spec locked, verifier confirmed red (iteration 0)
    spec_red --> judge: vague requirement or open question (D11)
    judge --> spec_red: decision recorded
    working --> green: verifier exit 0, tests grown, digests intact
    working --> stalled: no verifier/diff/session progress in N min (D6)
    working --> stalled: last child request ERRORED (D15)
    stalled --> working: nudge or fresh session succeeds (rungs 1-2)
    stalled --> working: instance relaunched (rung 3)
    stalled --> needs_human: ladder exhausted (rung 4)
    stalled --> needs_human: off-limits pending or every model exhausted (D4/D15)
    green --> pr_open: commit, push, PR opened
    pr_open --> working: CI red (D2) — worker fixes directly, no new spec
    pr_open --> spec_red: testable review comment (D2) — architect writes a new red test
    pr_open --> judge: untestable review comment (D2, D11)
    judge --> working: judge folds trivial fix into next re-arm
    judge --> needs_human: judge verdict CRITICAL (D11)
    pr_open --> needs_human: bounce count = 3 (D2)
    pr_open --> needs_human: PR closed unmerged (D2)
    pr_open --> awaiting_approval: closeOn=merged, CI green + approved (D1)
    pr_open --> done: closeOn=ready, CI green + mergeable (D1)
    awaiting_approval --> done: external merge observed, ticket resolved
    needs_human --> queued: human answers -> reopen as follow-up item (D10)
    needs_human --> working: human answers -> note appended, desired=run (D8)
    done --> [*]

    queued --> paused: desired=paused (D8)
    working --> paused: desired=paused, takes effect at a safe point
    paused --> queued: desired=run
    paused --> working: desired=run
    queued --> cancelled: desired=cancelled
    working --> cancelled: desired=cancelled
    stalled --> cancelled: desired=cancelled
    cancelled --> [*]
```

`needs_human` is drawn as reachable from every intermediate state, not just `stalled` and
`pr_open`, matching D6/D2's own wording ("Each rung counted and budgeted", "Max 3
bounce-backs... then `needs_human`"). It is a **parked** state, never a blocking wait:
the tick moves to other items and the final report collects parked evidence (D14).

## 5. Data model

Proposed new tables, added by a new migration (`src/store/migrations/00XX-supervisor.sql`,
following the numbering convention already visible in `src/store/migrations/0007-loop-runs.sql`):

- **`supervisor_items`** — one row per unit of work on the board: `key` (dedupe target, D9),
  `source` (`manual`/`plan-file`/`jira`), `repo`, `state` (the diagram above), `desired`
  (`run`/`paused`/`cancelled`, D8), `bounce_count` (D2, `CHECK (bounce_count <= 3)`),
  `close_on` (`merged`/`ready`, D1, set at creation from per-repo config, never inferred),
  `loop_run_id` (nullable FK into the *existing* `loop_runs.id`), timestamps.
- **`supervisor_events`** — append-only, one row per state transition or ladder rung, carrying
  the evidence that justified it (session file path, verifier tail, CI check name, error and
  audited command). This is the audit trail for §8's "needs_human with evidence" requirement — without it, a
  `needs_human` row is an assertion, not a finding, which `pr-review-verification.instructions.md`
  (a different but related instruction in this workspace) treats as worthless.
- **`supervisor_dispatches` (proposed)** — one row per child dispatch: `item_key`,
  `session_path`, registry tier, `model`, agent variant, attempt and nonce (D15). A model
  column on `loop_runs` alone is insufficient for architect/judge turns before a run exists.
- **`supervisor_heartbeat`** — single row (or one per resident process), `last_tick_at`, read
  by the `StartCalendarInterval` watchdog (D5) to decide whether to restart.
- **Owned-resource ledger** — per item/dispatch records for each created child root PID and
  start time, profile and portable path, watcher PID, scratch clone/worktree registration,
  generated session, spec/report/log/probe path and any other temporary artifact, with
  creator and cleanup state. Register *before* starting a process or creating a path where
  possible; on crash, reconcile only paths/PIDs proven to belong to this supervisor.
  Terminal item state does not imply cleanup succeeded: pending/failed cleanup remains
  visible and is retried. Keep a small durable cleanup receipt/event (resource class,
  count, outcome and any failure) in `supervisor_events`, not the scratch files themselves.

**Teardown acceptance contract (DESIGNED, not built).** A terminal item passes cleanup only
when the ledger has no live owned processes/watchers, no owned temporary paths remain
(including child session and profile storage), and the target repo's user-owned state and
deliverables are untouched. Check this on success, cancellation, error, forced child
termination and supervisor restart; a negative control leaves a fake owned artifact or live
child and must fail the check. Stale, pre-existing scratch from earlier experiments is not
assumed to belong to a new supervisor run: inventory and offer a separate, explicit
one-time cleanup after verifying ownership, rather than sweeping `tmp/` or killing unrelated
VS Code instances. The durable database, committed code and audit/decision records are
intentional outputs, not by-products; unneeded secret-bearing profile data is not retained.

**Why new tables, not a query over `actions` or over `loop_runs`.** `DESIGN.md` §8 states the
precedent directly and its reasoning generalizes: *"An earlier draft had a separate
`queue.jsonl`. That was a mistake: it duplicates rows that already exist in the audit record...
Instead, `actions` carries `resolution`, `resolved_at`, `resolved_by`, and the approval inbox is
[a] `SELECT`."* That precedent applies when the rows in question **already exist** as
`actions` — a supervisor item is not an action (it is not a single proposed mutation under
`cc`'s policy engine; `DESIGN.md` §19 invariant 2, "default is queue", governs `actions`
specifically). The closer precedent is `loop_runs` itself, whose own migration comment already
drew this boundary once: `0007-loop-runs.sql`: *"These are NOT `actions`. An action is a
mutation this system performs under policy... A loop run is the opposite: an observation of
work a human started, recorded after the fact... the executor never reads it."* A
`supervisor_item` is one level further out again: `loop_runs` records one verifier-driven
attempt; `supervisor_items` records the **lifecycle around zero or more** such attempts (spec
writing, PR review bounce-backs, human answers) that `loop_runs` was never shaped to hold — a
single item may accumulate several `loop_run_id`s (fresh session, D6 rung 2) or none yet
(`queued`, `spec_red`). Folding that lifecycle into `loop_runs` would mean adding columns
(`bounce_count`, `desired`, `source`) to a table whose own comment says it exists to be an
*observation*, not a *control surface* — which is exactly the queue/table distinction
`DESIGN.md` §8 warns about, just one layer up.

## 6. Human interface

| Action | Mechanism | Notes |
|---|---|---|
| Create | Chat `/loop <key> <brief>` | Enqueues only; architect, analyst, judge with tools and worker run in child windows (D9a/D14) |
| Create | CLI `npm run supervise -- add <key> --repo=<r> --brief="…"` | D9a |
| Create | Dashboard form | D9a |
| Create | Plan-file unchecked boxes | Auto-discovered, queued in file order (D9b) |
| Create | Jira `loop`-labelled tickets assigned to the user | Auto-discovered (D9c, label is `loop`, decided) |
| Start | Automatic | One queued item starts per repo at a time, by priority (D8) |
| Control | `supervise pause\|resume\|cancel\|retry\|bump <key>` + matching dashboard buttons | Sets `desired` only; `tick()` reconciles (D8) |
| Unblock | Dashboard "Needs you" inbox, evidence attached | Parked item only; driver continues others and reports all parked items once; later human Answer (note appended, `desired=run`) or Drop (D6/D14) |
| Monitor | Dashboard `/supervisor` board | Columns match the state diagram (§4); existing `/loops` page stays read-only exactly as today (`dashboard/pages/loops.ts` comment: *"there is no button here and there must never be one... a 'run loop' control would be exactly that"* [invoking a model] — the new board's buttons set `desired`, they do not invoke a model, so this does not reopen that constraint, but the distinction should be stated in code, not just here) |
| Monitor | Per-item timeline | Links durable `loop_runs`, PR and stored session summary (§5 `supervisor_events`); scratch chat files are removed on terminal cleanup |
| Alert | macOS notification on `needs_human` | Held during quiet hours (D5); morning digest line |
| Monitor | `cc_status` MCP tool | Extended, read-only, per `.github/instructions/central-command.instructions.md` ("Use it instead of guessing... Report the mirror's age") |

## 7. Invariant changes needed in `AGENTS.md` — wording proposals only (not applied)

`AGENTS.md` is not edited by this document, per instructions. Proposed wording, for the user to
apply or reject:

1. Under "Layout", add a Layer 6 row: `supervisor/` | Orchestrates loop items end-to-end;
   the only code allowed to call `code chat` outside a human's own session; imports from
   `src/store/` only, never the reverse.
2. Extend the existing rule *"`src/mcp/` never imports `src/executor/`"* (`AGENTS.md`, Layout
   table footnote / `DESIGN.md` §19 invariant 12) with a parallel one:
   *"`src/**` and `dashboard/**` must not import `supervisor/**`. An agent editing the mirror
   or the dashboard cannot reach into loop orchestration, as a property of the code."*
   (Widened from the D3 wording to also cover `dashboard/`, per the gap noted in §3.)
3. `DESIGN.md` §19 invariant 9 currently reads *"It never invokes a language model. There is no
   headless path to one (§13)"* — but §13 itself was already corrected once (*"This section
   previously asserted... The premise was wrong"*) to say a headless path **does** exist via
   `code chat`. The invariant's *conclusion* (cc itself never invokes a model) should stay, but
   its stated *reason* is now false and should read: *"It never invokes a language model. A
   headless path exists (§13) but is deliberately not used here; the supervisor (a separate
   program, see supervisor/) is where headless dispatch lives, and it never treats model output
   as a decision — only verifier exit codes, CI, and Jira/GitHub state do."* Leaving the old
   wording in place invites a future reader to re-derive "no headless path exists" and build on
   that false premise a second time.

**Status (§11): proposal 3 is APPLIED** — `DESIGN.md` §19 invariant 9 was updated in this
commit to the wording above. **Proposals 1 and 2 are decided** but intentionally not applied
yet: they will be added to `AGENTS.md` in the build step that first creates `supervisor/`
(§10, build order), so `AGENTS.md` never describes code that does not exist.

## 8. Spike 0 — results (2026-09-28/29)

The excerpts below are verbatim **command and key output** from the Spike 0 reports;
their original falsifiers and full probe records are in `tmp/SPIKE0-{A,B,C}-report.md`
(disposable). Verdicts and the decisive proof live **here**. `VERIFIED` describes the
observed result, including failed hypotheses; it does not mean the original claim passed.

| # | Claim / falsifier | Result (verbatim evidence excerpt and report section) |
|---|---|---|
| i | `--user-data-dir` routes `chat`; portable symlink isolates routing | **VERIFIED FAIL** direct flag: `Warning: 'user-data-dir' is not in the list of known options for subcommand 'chat'`; `AFTER DED 2 HITS []` (A probe 3). **VERIFIED PASS** portable routing after sign-in: `VSCODE_PORTABLE=/Users/jay.quach/dev/bot/tmp/spike0-portable '/Applications/Visual Studio Code.app/Contents/Resources/app/bin/code' chat -m ask 'SPIKE0-CTER-SIGNIN-9c14: Reply with ROUTED-9c14 only.'` → `AFTER DED COUNT 5`, `AFTER MAIN COUNT 625`, `REQUEST 1 modelId copilot/auto agent github.copilot.default responseKinds ['mcpServersStarting', None] responseTextLengths [11] modelState {'value': 1, 'completedAt': 1790660450439}` (C-bis route 2, C-ter 0). Model shown is selected, not proof of backend-served model. |
| ii | Per-profile auto-approval without editing main profile | **VERIFIED** after human terminal-warning consent: `touch /Users/jay.quach/dev/bot/tmp/spike0-c5.txt` → `TARGET True`, `MODE {'modeId': 'agent', 'permissionLevel': 'default'}`, `TOOLS [('run_in_terminal', {'type': 1}, {'commandLine': 'touch /Users/jay.quach/dev/bot/tmp/spike0-c5.txt'})]` (C-quinque 2); `MAIN_SHA_AFTER 329b7b46faccfc5b89e57f86c6978878629d2e99e6475edb440aa5f326dc6b9c MAIN_SHA_UNCHANGED True` (C-quater cleanup). Global opt-in remains **UNKNOWN**: `CONSENT [('chat.tools.terminal.autoApprove.warningAccepted', 'true')]` and no global key (C-quinque 1). No main-profile control command was dispatched. |
| iii | Detect pending confirmation uniquely | **VERIFIED** live waiting: `touch /Users/jay.quach/dev/bot/tmp/spike0-c2.txt` → `STATE {'value': 4} WAIT 1790660482927`; `TOOL_META {'kind': 'toolInvocationSerialized', 'isComplete': True, 'toolCallId': 'toolu_01GS61p1tBAfzQfcFw6SLD34', 'toolId': 'run_in_terminal'}`; `toolSpecificData.confirmation {'commandLine': 'touch /Users/jay.quach/dev/bot/tmp/spike0-c2.txt'}` (C-ter C2 and source follow-up). **VERIFIED relic caveat** after KILL/relaunch: `C2_POST_RELAUNCH {'value': 4} [(True, None, True)]` (C-ter C6). File age and instance-start check required; `pendingRequests`/`isComplete` do not discriminate. |
| iv | TERM cleanly tears down dedicated live work without touching main | **VERIFIED** for executing `sleep`: `ps -p 57571,1306,38917 -o pid,ppid,command` → dedicated root and `sleep 600` child; `SIGNAL_SENT SIGTERM 57571`; at 19.3s main 1306 remained, dedicated root and sleep were absent (C-quinque 4). **VERIFIED** TERM insufficient with outstanding request: `SIGNAL_SENT SIGTERM 35309` → `PIDS_AFTER 1306 [main Code]; 35309 [dedicated Code]`; then `DEDICATED_ONLY_SIGKILL 35309` (C-ter C5/C6). GUI quit sheet is **UNKNOWN**. |
| v | PATH shim or terminal rule map prevents unauthorized execution | **VERIFIED FAIL** PATH: `command -v git -> /usr/bin/git (exit 0)` and `gh pr merge 999999 -R kod88vn/grove -> GraphQL: Could not resolve to a PullRequest with the number of 999999. (repository.pullRequest) (exit 1)` (C-quinque 3); `/usr/bin/git --version` → `ABSOLUTE_BYPASSED_SHIM True` (C-quater control). **VERIFIED** one unlisted non-default command pends: `command -v gh` → `modelState {'value': 4}`, `run_in_terminal isConfirmed None`, `terminalCommandOutput None` (C-sexies S5). **VERIFIED** S3 unlisted `echo spike0-s3 > /Users/jay.quach/dev/bot/tmp/spike0-s3.txt` ran: `state {'value': 1, 'completedAt': 1790662332400}`, `confirmed {'type': 1}`, target exists (C-sexies S3). `echo` is actually built-in approved by default: installed `workbench.desktop.main.js` grep returned `default:{cd:!0,echo:!0,ls:!0,dir:!0,pwd:!0,cat:!0,head:!0,tail:!0,findstr:!0,wc:!0,tr:!0,cut:!0,cmp:!0` (dispatcher source grep). **UNKNOWN** deny-over-allow precedence: S2 `gh pr merge 999999 -R kod88vn/grove` and S4 `/usr/bin/git --no-verify status` were pending (`state {'value': 4}`, `confirmed None`; C-sexies S2/S4), but neither matched an allow rule. |
| vi | Nested dispatched architect can dispatch judge | **VERIFIED** no nested dispatch exposed in B's actual tool list: `functions.{apply_patch,create_file,read_file,run_in_terminal,grep_search,file_search,semantic_search,...}`, `multi_tool_use.parallel`; `no runSubagent, dispatch, or subagent-dispatch function exposed` (B vi). Top-level architect dispatch is supported by its agent contract; headless top-level capability remains **ASSUMED** (S10). |
| vii | Agent can discover its own model | **VERIFIED** request-selected only: `kind:2,k:['requests'],v:[{requestId,modelId,...}]` → all 9 appended request records `modelId: 'copilot/claude-opus-5.5'` (B vii). `main.jsonl` contains no resolved-model event; backend-served model is **UNKNOWN**. |
| viii | Model pins, picker overrides, CLI visibility and handoffs | **VERIFIED from installed source** (B viii): `refreshCustomPromptModes()` → `if(!n.visibility.userInvocable||!n.enabled)continue;`; `findModeByName(e)` searches custom modes; `_switchToAgentByName(e.agent)` handles handoff; mode observer `It&&this.switchModelByQualifiedName(It)` applies pin when agent changes. Hence hidden headless variants cannot be selected with `code chat -m`; a human model override after agent choice persists until next agent change. Live handoff click is **UNKNOWN**. |
| ix | Every outside-folder read requires a grant | **VERIFIED FAIL for `list_dir` only**: `list_dir /Users/jay.quach/dev` → `bot/`, `grove/`, `web-storefront-engine/` without confirmation (B ix). Outside terminal/edit permissions remain **UNKNOWN** per operation; add workspace folder, approve when prompted, or clone into bot/tmp. |
| x | `code chat` accepts a model flag | **VERIFIED FAIL**, C-bis step 1 installed CLI parser: `options:{_:...,mode:...,"add-file":...,maximize:...,"reuse-window":...,"new-window":...,profile:...,help:...}` — no model flag; CLI `--user-data-dir` does not route `chat`. D15 requires an agent variant to pin each alternate. |

Additional `ASSUMED` facts: reported 86/83/2/1 `loop_runs` figures (§1);
resident-process `launchd` `KeepAlive` behavior (D5); B's current tool list is not
proof all top-level contexts lack a dispatch tool. No `VERIFIED` verdict here claims a
working supervisor or a universal security boundary.

### Spike 0b — follow-up gates (not run)

| Probe | Claim to falsify | Falsifier / control |
|---|---|---|
| S7 | Legacy narrow-map deny overrides a matching allow | Positive control: allow harmless `gh` and `git commit`; deny `gh pr merge` and `--no-verify`; forbidden variants must pend. This does **not** prove S13 global precedence. |
| S8 | Legacy built-in write defaults can be overridden | Set `echo:false` and `chat.tools.terminal.blockDetectedFileWrites:"all"`; a new agent-run `echo … > scratch` must pend and leave target absent, while allowed read succeeds. This is not the D4 primary policy. |
| S9 | Non-terminal MCP cannot merge unattended | In dedicated profile trigger an MCP tool call and observe pending, or disable MCP with an installed-source-verified setting and prove no MCP merge tool is offered. |
| S10 | Headless top-level architect can consult judge | `code chat -m loop-architect` with a consult dispatch; inspect resulting judge artifact and selected request model; absence triggers D11 fallback. |
| S11 | Portable cold start routes correctly | With no dedicated process running, invoke portable `code chat` and check nonce appears only in dedicated store; failure requires explicit launch first. |
| S12 | Short forms cannot evade denies | Positive controls plus `commit -n`, `push -f`, `-c core.hooksPath`, `+ref`, `HUSKY=0` must pend (never send a real destructive command). |
| S13 | Generated deny regex overrides **global approve-all** | With both `chat.tools.global.autoApprove:true` and `chat.permissions.default:"autoApprove"`, prove a harmless matching `gh`/`git` command runs unattended, while simulated off-limits `gh pr merge`/denylist and system/secret reads **do not execute** and leave a probe marker absent. Any forbidden marker or confirmed forbidden command falsifies precedence; pend alone without the positive control does not prove it. Never target a real PR or secret. |
| S14 | Approve-all containment with sandbox on/off and SSH | With synthetic private-key/.env fixtures and harmless protected-path probes, verify **no** secret content or system write escapes via terminal, edit, or non-terminal tools for *each* sandbox setting; positive control: permitted workspace write executes. Then authorized SSH git push to an isolated test remote succeeds for the chosen setting. A leaked synthetic secret, protected write, or failed authorized push falsifies the chosen configuration. No real secret printed or system file modified. If no setting meets both, park the capability and escalate the design question, never disable protection silently. |
| S15 | Detect errors and honor a single-model pin | Force a child error with a quota-denied model or controlled network interruption; compare errored and successful JSONL **last requests**, identify a discriminating error field, check artifacts before retry. Generate a `loop-worker.m-<slug>` variant and observe selected request model matches its one-element pin; an error with no detectable field or selection of another available model falsifies the design. Confirm one rate-limit retry and same-tier substitution without consuming a D11 rung; failures falsify substitution. |
| S16 | Subagent confirmation blocks parent | From a controlled main-thread subagent, request an innocuous command requiring confirmation; if main remains runnable while the subagent pends, the ASSUMED blocking claim is false. Never approve an unsafe call; record where the prompt surfaces and park/stop the probe. **Narrow related result, 2026-09-29:** a main-thread `runSubagent` reading `~/dev/harvester/package.json` was approved by a pre-armed, narrowly scoped watcher (AX press, `pressResult=0`) without a person watching, and returned `PROBE_READ_OK` — so the confirmation is not inherently unapprovable. Whether the parent turn stays runnable while pending, and general-purpose unattended approval/containment, remain **UNKNOWN**. |
| S17 | Two child windows route independently | Open two distinct portable/user-data pairs simultaneously, one per repo/item, dispatch distinct nonces and confirm each appears **only** in its intended JSONL store, both profiles stay independent, and stopping either leaves the other and main alive. Any cross-route, collision or wrong termination falsifies concurrency. |
| S18 | Child approve-all survives relaunch | After one-time human sign-in/warning acceptance, run a harmless child write without a click, tear down only the verified child, relaunch with the same profile and run a second harmless write unattended. A pending second request, lost consent or touched main profile falsifies persistence. Never synthesize consent storage. |

## 9. Risks

| Risk | Note |
|---|---|
| D4 approve-all blast radius | **DESIGNED, not contained yet:** a worker may execute **anything not off-limits** without a human prompt, including code it just wrote that can spawn commands through `child_process`. Generated terminal denies, D6 kill/park, audit and repo hooks limit some paths but do not form a proven pre-execution security boundary. S13/S14 must falsify containment before unattended writes; if containment fails park, do not route the forbidden action through supervisor code. |
| D4 non-terminal tools | Terminal denies do not govern edits, web or MCP. Grove's `.vscode/mcp.json` registers a GitHub MCP server which may expose merge; whether MCP pends is **UNKNOWN** (S9/S14). Disable unverified write-capable MCP in the child with an installed-source-verified setting; post-hoc command audit cannot see all tool effects. |
| D4 sandbox trade-off | **ASSUMED from prior sessions:** sandbox denies `~/.ssh` reads, protecting keys but breaking SSH git. Sandbox off widens exposure to SSH keys and tokens; S14 must test synthetic secrets and an authorized SSH push before choosing. Neither mode is automatically safe. |
| D4 residual risk (4): credentials | Only a merge-incapable token actually prevents merging. This is a user-owned credentials change, not required for D4. |
| D4 residual risk (5): GUI quit sheet | **UNKNOWN**; KILL on verified root is the fallback. |
| D4 residual risk (6): cold start | `VSCODE_PORTABLE` with no running instance is **UNKNOWN** (S11). |
| D4 residual risk (7): first use | Each new profile needs human Copilot sign-in and terminal-warning acceptance. Supervisor must not forge consent storage. |
| S13/S14 gate | Global approve-all deny precedence and secret/system containment are **UNKNOWN**: C-sexies S2/S4 pended without matching an allow control. If falsified, stop the unsafe child capability, park with evidence and revisit the design; do not shift risky mutations onto the main thread. |
| D15 error gaps | Exact JSONL error signature, pin fidelity of single-model variants, and retry idempotence are **UNKNOWN** (S15); inspect disk and ledger before re-dispatch. |
| D14 isolation | A child may still show a fresh sign-in/warning or an unexpected confirmation (S18); classify/park without waiting. Main-thread subagent blocking is **ASSUMED** in general — a 2026-09-29 narrow proof (§8) showed one confirmation approved unattended by a pre-armed watcher, but general containment is unproven; per-window concurrency **UNKNOWN** until S17. |
| Removing the human diff-review checkpoint at green | `LOOP.md` §6 calls this out as deliberate: *"those are the steps where a mistake is expensive and hard to reverse, and they are the steps a human is best placed to sanity-check."* D10 removes it in favor of after-the-fact spot-checks; consistent with the user's stated tradeoff ("cheaper to fix later than to sit and wait") but should be named as a conscious reversal, not a silent one |
| Guard wording gap (`src/**` vs `dashboard/**`) | Resolved by D3 widening (§11) — the rule now covers `dashboard/` and `bin/` |
| `launchd` `KeepAlive` semantics unverified in this environment | §5/§8 — only one-shot firing and `StartCalendarInterval` catch-up semantics have been read/verified (`DESIGN.md` §12, `STACK.md`); a resident daemon is a different `launchd` feature |
| Autonomous commit/push without the LOOP.md checkpoint could push something a bounce-back can't detect (e.g. tracked build output going stale) | `LOOP.md` §6 names this exact failure class: *"Regenerate tracked build output... or the PR is inconsistent with its own source."* A CI-red bounce may not catch a build artifact drift if CI doesn't rebuild it. Mitigated by the mandatory Opus referee (D10, D11), whose phase-4 review reads the shipped artifact, not just CI. |
| Bounce-back triage (D2, "testable" vs "not") is itself a model judgment | Verified mechanically by red-at-iteration-0 (D2): the architect's classification is checked by whether it can produce a spec that fails at iteration 0, not taken on its own word |
| `closeOn=ready` "done" does not mean merged | Must be worded carefully everywhere in UI/notifications so it is never read as "shipped" — conflating the two was exactly the failure `AGENTS.md` "Finish the loop" section already worries about: *"a PR merges, everyone moves on, and the ticket stays Open"* |

## 10. Build order

1. **Spike 0** (§8) — ran 2026-09-28/29; results and D4/D6/D11 decisions above.
1a. **B1–B8 entry-agent slice** — built at HEAD: `models self`, rank-based variants,
  registry interactive list, `loop-analyst`, entry preflights, prompt and meta-spec;
  this document and the guides record the shipped behavior.
1b. **Spikes S7–S18** (§8) — legacy controls plus revised child approval, secret/system
  containment, model errors, subagent blocking, concurrency and relaunch; **S13/S14/S17/S18
  gate unattended child writes**, S15 gates automatic substitution. If containment fails,
  park that capability and revise design, never perform it in the main chat instead.
2. Data model (§5) — migration, no behavior yet; lets `supervisor_events` start recording
  manually-triggered test runs during spike work. Record `model` for **each dispatch**.
3. `tick()` skeleton + D7 resource ledger and teardown first (reap dead `loop_runs`, kill
  verified orphaned instances, remove owned temporary by-products and prove absence) —
  the smallest slice that does not yet dispatch a child. Exercise success, cancel, failure,
  pause/resume, crash/restart and halt; a leftover owned resource must fail the gate.
4. D14 child router and approve-all profile with D4 off-limits containment; isolate one
  repo/item per instance before allowing concurrency. Keep CLI front end enqueue-only.
5. D15 `cc models apply` single-model variants, pin check, dispatch recording, artifact
  inspection, bounded backoff and same-tier substitution, then D11 escalation.
6. D9a manual intake + `queued → spec_red → working → green` in a child, no PR/bounce yet.
7. D6 stall/error/pending classifier and kill/park/continue, then D2 PR bounce-backs and
  D1 `closeOn` handling; no user wait in any transition.
8. D8 dashboard board and final parked-items report; D9b/D9c intake; notifications.
9. Install/halt lifecycle: stop resident and watchdog jobs before removing their owned
  launch configuration; drain owned children/watchers and temporary paths, verify zero
  remains, and surface any unsafe-to-delete resources for manual recovery. Include a
  one-time, ownership-checked inventory of older spike leftovers; do not blanket-delete
  pre-existing `tmp/` contents.

## 11. Recorded decisions (judgment 2026-09-28; user revisions 2026-09-29)

| Question | Decision | Why |
|---|---|---|
| D3 guard wording gap | Widen to `{src,dashboard,bin}/** must not import supervisor/**` | `dashboard/` is the path most likely to read supervisor state for the board; leaving it out makes the boundary a convention, not a property of the code (`DESIGN.md` §19 invariant 12) |
| §7 AGENTS.md proposals | Proposal 3 applied now (`DESIGN.md`); proposals 1–2 decided, applied when `supervisor/` first exists | `AGENTS.md` should never describe code that does not exist yet |
| D6 stall window N | 10 minutes, plus a hard ceiling of `MAX_ITER × POLL_LIMIT × 5s + 10min` | The driver's own budget (`scripts/loop.sh` line 30, 6 min/iteration) fires first on a merely slow turn; the supervisor only needs to catch what the driver cannot |
| D1 awaiting-approval notice timing | Board immediately; one notification at 24h; daily digest line after that | Never a stall, but silence for days reads as one without some signal |
| D9c Jira label name | `loop` | Labels are created on first use in this Jira instance; no admin step required |
| D1 per-repo `closeOn` | grove = `merged`, the first configured entry | Only grove has an external auto-merge policy documented (`grove/AGENTS.md`); other repos are enrolled by adding a config entry (D12) |
| Scope of repos/tasks | any repo, any task (user, 2026-09-28) | D12 |
| D10 approval-gate removal | Accepted, with a mandatory mitigation | The phase-4 `oracle`-tier referee (D11) is reject-only and mandatory in the supervisor, so *some* judgment gate survives even with human pre-approval off |
| D2 bounce-back triage verification | Verified mechanically, not by model say-so | "Testable" means the architect can produce a spec that is red at iteration 0 (`cc loop start` refuses an already-green verifier); failure to do so within one turn reclassifies the item as untestable |
| Spike 0 go-ahead | Approved to run | All five original items plus new item vi are falsifiable by a command; none require a design change to attempt |
| Model routing | Registry `architect` tier for architect/driver (currently GPT-6 Sol); `oracle` tier for `loop-judge` (currently Claude Opus 5.5); `worker` tier for `loop-worker` (currently GPT-5.6 Luna) | Updated by the 2026-09-28 coding-benchmark re-tier; `registry/model-tiers.json` is the source of truth for priorities and price bands |
| D4 routing / containment — **revised by user 2026-09-29** | Child approve-all, generated off-limits denies and layered audit/hooks; S13/S14/S18 pending, no PATH shim | C-quinque 2 confirmed unattended touch; C-sexies S3 disproved fail-closed narrow-map assumption; S2/S4 never proved precedence |
| D6 pending — **revised** | `value=4` + unconfirmed serialized tool + nonce + instance-age/mtime guard; off-limits kill/park; otherwise one settings/relaunch retry then park; add `ERRORED` | C-ter observed pending and stale value-4 relic; error field **UNKNOWN** (S15) |
| D7 teardown — **user requirement 2026-09-29, DESIGNED** | Own and inventory every temporary by-product, remove it on item exit or supervisor halt, verify absence and retry failures; preserve only intentional deliverables and durable evidence (§5) | Previous D7 covered orphan instances and some worktrees but not profiles, sessions, watchers, logs, probes or crash leftovers. Do not sweep unowned pre-existing scratch. |
| D11 consult — **revised, main-subagent scope loosened 2026-09-29** | Tool-using architect/analyst/worker/judge in child by default; a main-thread subagent (including judge) is permitted for an appropriately scoped, per-request task, not only read-only in-workspace (see D14 status note); no human wait | B vi had no dispatch tool in nested context; S10 remains open; S16 narrowly addressed 2026-09-29 (see §8) but the general case is still open |
| D13 entry | Two entry agents with task-fit STOP, model-cost warning, repo/resume preflight | B vii/viii/ix, B1–B8 at HEAD; supervisor intake remains unbuilt |
| Variant suffix | Model slug (`loop-worker.m-<slug>`, `loop-architect.m-<slug>`); variants stay visible for CLI lookup | B viii installed custom-mode lookup excludes hidden agents; tier-only variants retired 2026-09-30 |
| D14 driver — **user-authorized 2026-09-29, DESIGNED** | `supervisor/` tick is durable no-LLM dispatcher; chat main thread enqueue/monitor/report only; park human items and continue others | Main subagent confirmation blocking **ASSUMED** in general (S16 narrowed by a 2026-09-29 proof, see §8); concurrent child routing **UNKNOWN** (S17) |
| D15 model errors — **user-authorized 2026-09-29, DESIGNED** | Artifact check, one backoff retry for transient rate limit, same-tier single-model substitution, then D11 ladder, then park | CLI model flag absent and first-available pin behavior **VERIFIED** (§8); error signature/pin variant **UNKNOWN** (S15) |
| Child-folder routing + approval watcher — **user decision 2026-09-29, DESIGNED, not built** | Always open/reuse a child VS Code instance rooted at the exact target folder when it differs from the current workspace (D4/D14: verify PID/profile/workspace/nonce before reuse, never cross-reuse); this routing avoids only the outside-folder file-read prompt for paths under the routed target, not other confirmation classes. Arm a bounded (~3 min) low-overhead watcher around dispatch that approves only an individually matched and verified, one-time prompt from the classes that still occur after routing — terminal commands, reads outside the routed target, or an initial web-fetch request when the target is fully identifiable — fails closed on any web-fetch result needing human content review, an ambiguous match, or an off-limits/unknown target, and re-arms per dispatch rather than running open-ended (D6) | User, verbatim: "always open/reuse a child VSCode instance if it works on a different folder to avoid approval. the watcher loops still needs to run for a few minutes to check for approval permissions"; implementation and probing are both pending — only the narrow S16 proof (§8) exists, S13/S14 containment is still **UNKNOWN**, and AX-watcher resource cost is **not measured** |

## 12. Reserved for the user

The user authorized D14/D15 and the D4/D6 changes. Existing judgments remain recorded;
the code driver never waits for a user answer:

(a) Answered 2026-09-28: the design is repo- and task-agnostic (D12).

(b) Spike 0 ran with the user's go-ahead (2026-09-28/29); results in §8. On hold lifted.

(c) Optional, user-only: a merge-incapable token for the dedicated instance (residual risk 4).

(d) **OPEN QUESTION FOR USER:** D4 retains the compiled denylist and D1 `gh pr merge`
prohibition beyond “only security” because both are existing invariants. Should either
recorded invariant change? **UNKNOWN** until the user decides; park an item that requires
changing either, keep driving all other work, never silently relax them.

## Committing

Command sequence, cwd `/Users/jay.quach/dev/bot`, branch `feature/central-command`, no
remote — this stays local. Executed under `requestUnsandboxedExecution=true` because the
pre-commit hook needs `npx` (`~/.nvm/.../bin`, outside the sandbox root).
