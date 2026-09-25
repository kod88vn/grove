# LOOP.md — loop engineering

How a ticket becomes merged code without a human driving each turn: an agent writes, a
machine judges, and the judgment is one that the agent cannot forge.

This is not a design document. Everything below has been run. The worked examples at the
bottom are two real loops against `~/dev/web-storefront-ui` that ended in PR #181.

---

## 1. Using it again

Pick **`loop-architect`** in the Chat mode picker, in this workspace, and type what you need:

```
WS-6673
the fragments package has no storybook coverage and it should
```

Either form works — a ticket key, or a sentence. `/loop <same thing>` still works from any
agent and does the same job; it is a shim that reads the agent file. Prefer the agent: it
pins the model and stays in force across phases 0–5, where the prompt governs one message.

| | `loop-architect` agent | `/loop` prompt |
| --- | --- | --- |
| Model | pinned by the agent | whatever the picker says |
| Lifetime | the whole job, including the referee pass | one message |
| Source of truth | `.github/agents/loop-architect.agent.md` | reads that same file |

The first thing it does is **triage** (§4.1) and then hand you a table of the assertions it
intends to write. Correct a row or say yes. You are not asked to write a test — see §3.

Four roles. Only two are models, and the one that decides pass or fail is not:

| Role | Who | Runs | Decides |
| --- | --- | --- | --- |
| **Architect** | Opus, in your session | once | what "done" means — turns your requirements into a failing test |
| **Worker** | `loop-worker`, cheap model, headless | once per iteration | how to make it pass |
| **Gate** | no model | every 5s | **whether it passed** — exit code and checksums |
| **Referee** | Opus, in your session | once | whether the pass is the one you wanted |

The Gate sits between the Worker and the Referee, so **Opus never sees a red run**. It is not
in the polling loop and is not woken between iterations. That is the whole reason a loop with
a four-turn budget does not cost four expensive turns.

Architect and Referee are the same agent — `loop-architect`, phases 0–2 and 4–5.
`LOOP.html` is all of this explained for someone who has never done it.

The worker's model is pinned in `.github/agents/loop-worker.agent.md` frontmatter and
dispatched with `code chat -m loop-worker`. Change the model by editing that one line. If the
agent name ever fails to resolve, `code chat` falls back to the default agent on whatever the
window last used — the loop still runs, it just quietly costs what this design exists to
avoid. Check the model picker on your first run.

### 1.1 Driving the driver by hand

The prompt does this for you. Do it yourself when you are debugging the loop itself.

| Value | What it is | Example from WS-5985 |
| --- | --- | --- |
| `REPO` | absolute path to the target repo | `/Users/jay.quach/dev/web-storefront-ui` |
| `SPEC` | the file the agent must not edit | `.../storybookCoverage.test.tsx` |
| `verify()` | the command whose exit code *is* "done" | `./node_modules/.bin/jest` |
| `BASELINE` | a number that must grow, never shrink | `787` tests |
| `TASK` | the briefing, written for a stranger | see §3 |
| `MAX_ITER` | how many agent turns you are willing to buy | `4` |

If you cannot fill in `verify()` as a **single command that exits non-zero today**, stop.
You do not have a loop yet, you have a wish. Go write the spec first (§3).

### 1.2 Running one

```bash
cp scripts/loop.sh tmp/<ticket>-loop.sh   # the template, with the ledger wired in
$EDITOR tmp/<ticket>-loop.sh              # change the block marked CHANGE THESE
bash tmp/<ticket>-loop.sh                 # runs unattended; prints a verdict
```

`scripts/loop.sh` is the only driver to copy from. The two WS-5985 scripts left in `tmp/`
predate the ledger and judge in bash — they still work, but they record nothing, so a run
started from them will not appear at `/loops`.

Run it from a VS Code terminal with a window open on **this** repo. The driver opens the
*target* repo in its own window and talks to that one. Scratch files live in `tmp/`, which
is gitignored — see `.github/instructions/scratch-space.instructions.md`.

It ends by printing `passed` or `failed` and the reason, and leaves the same verdict at
`/loops` for later. There is no third outcome and no partial credit.

### 1.3 What the template does

The shell runs the verifier and reports two facts — an exit code and a test count. It does
**not** decide whether the run passed. That judgement lives in `cc loop record`, which
re-checksums the spec itself, so a driver script that has been edited mid-run cannot talk its
way to a green.

Its shape, so you know what you are editing:

| Section | What it is | Do you touch it? |
| --- | --- | --- |
| `CHANGE THESE` block | `REPO`, `TICKET`, `SPEC`, `BASELINE`, `MAX_ITER`, `POLL_LIMIT` | yes, every time |
| `verify()` | the command whose exit code is "done"; sets `RC` and `TOTAL` | yes — it is jest by default |
| `TASK` | the briefing sent each turn (§3) | yes, and it is the part that decides the outcome |
| iteration 0 | runs `verify`, then `cc loop start` — which **refuses an already-green loop** | no |
| the while loop | dispatch, poll, `cc loop record`, stop when the state is not `red` | no |
| the tail | `cc loop finish`, then the diff | no |

For a loop that also guards a config file — like loop 2 in §5, which had to stop the agent
loosening the lint rules — add `--config=<path relative to $REPO>` to `loop start` and pass
`--suppressions=<count>` to both `start` and `record`.

### 1.4 Watching it

```bash
npm run cc -- serve        # http://127.0.0.1:4747/loops
npm run cc -- loop status  # the same list, in a terminal
```

`/loops` lists every run with its state, turns used against budget, and stop reason. Clicking
a run shows each iteration and the verifier output from the last one — which is the thing you
actually want when it failed. The page is read-only and always will be; see §8.

### 1.4.1 Always report status — so the user knows not to intervene

A running loop looks exactly like an idle window that someone forgot about. If the user
cannot tell the difference, they click into it, type in its chat, or edit a file in `REPO`,
and the next `code chat -r` dispatch lands somewhere else or the verifier reads a tree the
worker did not write. So whoever starts a loop — the architect or a human — reports status
at three points, every time, without being asked:

| When | Say |
| --- | --- |
| **Start** | `LOOP RUNNING — hands off.` The run id and `http://127.0.0.1:4747/loops/<id>`, `REPO`, the worker window, and the worst-case end: `MAX_ITER` × `POLL_LIMIT` × 5s (defaults 4 × 72 × 5s ≈ 24 min). |
| **Blocked** | Anything that needs the user — an unsandbox prompt, a trust prompt, an `ABORT`. Name the exact action, and say that everything else is still hands-off. |
| **End** | `LOOP FINISHED — safe to use the windows again.` The verdict from `cc loop status`, quoted, not recalled. |

Until the end message, the user should not touch these:

- the VS Code window open on `REPO`, or its chat;
- which VS Code window has focus — `code chat -r` sends the prompt to the last active window;
- any file under `REPO`;
- the terminal running the driver.

This is not a running commentary. Say nothing between start and end unless something is
blocked: the dashboard is the progress view, and the reporter polling on the user's behalf
would put an expensive model back into the loop (§7.1).

### 1.5 After a PASS

The loop stops at green. It deliberately does **not** commit, push, or open a PR — see §6.
Finish by hand or in a normal chat session, then close the ticket:

```bash
npm run cc -- resolve         # lists tickets whose PR merged
npm run cc -- resolve --apply
```

Work is done when the ticket is closed, not when the code is written.

---

## 2. What a loop actually is

Four parts. Remove any one and it stops being a loop.

```
        ┌──────────────── driver (bash, outside the session) ─────────────────┐
        │                                                                     │
  iteration 0 ──▶ verify() ──RED──▶ dispatch agent turn ──▶ poll verify() ────┤
        │             │                  (code chat)            │             │
        │           GREEN                                     GREEN           │
        │             │                                         │             │
        │          ABORT — nothing was proved              PASS, stop         │
        └─────────────────────────────────────────────────────────────────────┘
```

| Part | Purpose | Why it must be this way |
| --- | --- | --- |
| **Verifier** | a command whose exit code decides done | the agent reports; the exit code *decides*. Never let a summary be the stop condition. |
| **Lock** | sha-256 over the acceptance criteria | the cheapest way to pass a test is to edit the test |
| **Driver** | bash, running **outside** the chat session | a stop condition evaluated inside the thing being judged is not a stop condition |
| **Budget** | `MAX_ITER`, `POLL_LIMIT` | a model looping confidently looks exactly like a model making progress |

The load-bearing idea: **the agent never says whether it succeeded.** It is not asked. The
driver runs the repo's own suite and reads `$?`. That is the entire difference between this
and asking an agent to do something and believing the answer.

### Why the driver lives outside the session

`chat.agent.maxRequests` is a budget, not a stop condition — it cannot tell success from a
confident loop. Chat hooks would have been the natural place for loop control (`PreToolUse`
can deny a call outright), but they are **unavailable on this machine**: the Copilot org flag
`chat_preview_features_enabled=false` forces `ChatHooks` off and `chat.useHooks` is
`disallowConfigurationDefault`, so it cannot be re-enabled from settings. Five probes fired
zero hooks. See `DESIGN.md` §13.

So the loop is driven by a process the agent does not control and cannot see.

---

## 3. Requirements in, spec out

**You do not write the spec.** You write requirements — the same prose you would put in a
Jira ticket — and phase 1 of the prompt translates them into an executable spec. That
translation is the Architect's entire job, and it is the reason the entry point runs on an
expensive model while the grinding runs on a cheap one.

| You supply, in prose | The Architect turns it into | When |
| --- | --- | --- |
| "flag real differences, ignore noise" | a test feeding fixture HTML pairs and asserting the emitted verdict | phase 1 |
| an adjective — "fast" | a number: the suite must finish under five minutes | phase 1 |
| a rule — "don't hardcode selectors" | a test that fails on any `data-testid` declared outside `pom.ts` | phase 1 |
| something genuinely ambiguous | **one** message of questions, each carrying a proposed default | phase 0 |

So a loop starts from a ticket, not from a test file. What the ticket has to contain is
**observable behaviour** — something that is true or false about the running system. If the
requirement is an opinion, no amount of model quality turns it into a spec; §4.1 is the
triage that says so before you spend the budget.

### The ordering phase 1 follows

Not negotiable, and the driver enforces the second step whether you like it or not:

1. **Write the acceptance criteria as an executable spec.** For WS-5985 that was
   `storybookCoverage.test.tsx` — a test asserting `.storybook/main.ts` scans the fragments
   glob, and that both new stories render real DOM under `composeStories` in jsdom.
2. **Run it. Watch it fail.** This is iteration 0 and the driver aborts if it passes. A spec
   that has never been red proves nothing about the work it claims to cover.
3. **Lock it.** `shasum -a 256`, recorded before the first agent turn.
4. *Then* start the loop.

### What goes in `TASK`

Write for someone who has never seen the ticket. Include:

- the ticket key and one-line intent
- the path to the spec, and that it is the definition of done
- concrete, numbered requirements — file paths, not adjectives
- where to find existing patterns to imitate (`follow the CSF style already used in …`)
- the prohibitions, explicitly: do not edit the locked spec, do not add suppression
  comments, do not delete or weaken existing tests
- the verify command, spelled out

Each turn also receives the **current verifier output**, sliced to the lines that matter
(`grep -E "^(  ●|Cannot find module|Tests:)"`). Feeding back the whole log wastes the turn's
context on noise.

---

## 4. Anti-cheat: the states that are not RED and not GREEN

Exit code 0 is necessary, not sufficient. Every way to make a suite pass without doing the
work gets its own terminal state, and every one of these is a **FAIL**:

| State | Detects | How |
| --- | --- | --- |
| `TAMPERED` | the spec was edited to match the code | sha-256 over the locked file, re-read every poll |
| `SHRUNK` | tests were deleted to make the suite pass | total test count must exceed `BASELINE` |
| `CFG_TAMPERED` | guard limits raised instead of code fixed | sha-256 over `ai-guard.config.json` |
| `SUPPRESSED` | `eslint-disable` added instead of a fix | count occurrences before, compare after |

These were not hypothetical. They are the four cheapest paths to a green suite, which is
exactly why each is checked on every poll rather than once at the end.

A design note worth keeping: the checks are all **cheap and re-run continuously**. Checking
integrity only at the end lets a run burn its whole budget before you learn it was invalid.

### 4.1 Work that cannot be looped

Most tickets are not loopable, and filing them as loops wastes a budget discovering that.
A ticket qualifies only if **all four** hold. Triage before you write a spec, not after.

| Test | Fails when | Example |
| --- | --- | --- |
| The verifier is **local** | done is decided by a remote system | "prove the Jenkins stage ran" — the answer lives on a build server, not in `$?` |
| The verifier is **red today** | the named gate already passes | `yarn lint && yarn test` is green on `main`, so it can never signal completion |
| The deliverable is **machine-checkable** | the output is prose | a design document. No exit code can judge an argument. |
| The inputs **exist** | the agent would have to invent data | a cohort list that has not been supplied. It will invent it. |

Two consequences that are easy to get wrong:

- **Naming the repo's existing suite as the gate is the most common error.** `yarn test`
  passing does not mean your ticket is done; it means your ticket is not represented in it.
  The loop needs a *new* assertion that fails now. `cc loop start` enforces this by refusing
  a verifier that already exits 0 — that refusal is the design working, not a bug.
- **When the deliverable IS tests, you cannot lock the tests.** Writing a Playwright suite
  means the worker is writing the thing the spec would normally be. Lock a *meta-spec*
  instead: a test asserting the suite exists, covers the required cases, runs inside its time
  budget, and uses no hardcoded selectors. That file the worker must not touch.

A ticket that fails the triage is not a worse ticket. It is work for a normal chat session
with a human reading the output, which is most work.

---

## 5. Two real runs

### Loop 1 — WS-5985, the feature

Spec: `packages/@wse/fragments/src/storybookCoverage.test.tsx`, locked at
`d916486b19864e291089f5bce441e427e33de124720154c5dbd8e97df70dc727`.

```
verifier: RED  →  iteration 1  →  GREEN after 90s
Test Suites: 70 passed
Tests:      797 passed        (baseline 787 — grew by 10)
spec integrity: INTACT
```

Independent confirmation, because a passing jest is still jest: the Storybook build emitted
201 entries, 4 of them the new fragment stories
(`fragments-navfragmentslot--default/--docs`,
`fragments-rendernavigationfragment--default/--docs`).

### Loop 2 — unblocking the repo's own pre-commit gate

The first commit attempt was refused by husky. Two violations, both **pre-existing on `main`**
in a file WS-5985 never touched (proven with a stash control, not assumed):
`NavigationBarView.tsx` at 725 lines against a 700 limit, and `shouldRenderPerksControl()`
taking 5 parameters against a limit of 4.

That is a second loop, not a workaround. Locked `ai-guard.config.json`, counted
`eslint-disable` occurrences, floor of 797 tests:

```
cfg lock : 3c6bf7e3f8aecd37...   eslint-disables: 7
verifier: GUARD_RED  →  iteration 1  →  GREEN after 50s
✓ quality:check passed
Test Suites: 71 passed
Tests:      801 passed
cfg integrity : INTACT
line count    : 692 (limit 700)
```

The fix was a responsibility-based split — three pure predicates extracted to
`Navigation/utils/navigationVisibility.ts` with 15 new assertions — not shaving lines to get
under a number. That distinction was stated in `TASK`, and the checksum lock is what made it
enforceable rather than aspirational.

**Note the shape:** `--no-verify` was never used and is on the compiled denylist
(`src/core/policy/denylist.ts`). When a gate refuses, you loop on the gate. You do not
negotiate with it.

---

## 6. What the loop deliberately does not do

It stops at a green verifier. It does not commit, push, open a PR, or touch Jira.

Not an omission. Those are the steps where a mistake is expensive and hard to reverse, and
they are the steps a human is best placed to sanity-check — the diff gets read once, by a
person, before it leaves the machine. After loop 2 that review caught nothing, which is the
outcome you want and not a reason to remove the step.

Two things that review must cover, both learned the hard way in this repo:

- **Audit the diff for logic drift.** Extracted code must be verbatim. Read the moved
  expressions against the originals.
- **Regenerate tracked build output.** `packages/@wse/fragments/lib/` is committed. Rebuild
  and amend it in, or the PR is inconsistent with its own source.

---

## 7. Known limits

| Limit | Detail |
| --- | --- |
| Needs a window | every successful `code chat` probe fired with VS Code already open. Fully-quit behaviour is **unverified**. A cold-start probe is still outstanding. |
| Worker model comes from frontmatter | `code chat --help` on 1.121.0 offers `-m <mode-or-custom-agent>` and **no `--model` flag**, so the worker's model is pinned in `.github/agents/loop-worker.agent.md` frontmatter. Verified 2026-09-23 that the pin is honoured: `probe-astra` and `probe-gemini` (identical except `model:`) resolved to `copilot/gpt-6-astra` and `copilot/gemini-3.8-flash`, read from `result.metadata.resolvedModel` in the session record, not self-report. |
| One repo at a time | the driver opens a window on `REPO` and dispatches there. Two concurrent loops on two repos will interleave windows. |
| `copilot` CLI is not an option | installed at `1.0.81`, but every `-p` invocation returns `Access denied by policy settings`. `code chat` is a different binary and is not blocked. |
| The sandbox is not a boundary | escalation out of it is per-command and silent. From an escalated run, `~/.ssh/id_ed25519` was readable and `$JIRA_DC_TOKEN` was in the environment. Loop only on repos you would hand the agent anyway. |
| Polling costs a full suite run | `POLL_LIMIT=72` at 5s means up to 72 jest runs per iteration. Fine for a 90s suite; reconsider for a 10-minute one. |

Same-window dispatch (`code chat -r` into the window you are working in) was tried on
2026-09-23 and reverted on 2026-09-24, after it was suspected in a VS Code crash. Every
worker turn landed in the user's own window, so its chat history and renderer memory grew
with the loop. The cause was never confirmed. The driver opens a separate window again.

### 7.1 Why not subagents

The first three limits above come from `code chat`. Dispatching `loop-worker` as a subagent
instead would delete them all at once — no window, no one-repo rule, and the model pin works
there too. It is the obvious idea and it is the wrong one.

**A subagent returns its result into the parent turn.** So something expensive is awake for
every iteration, reading every red run. A four-iteration loop costs four expensive turns —
precisely the cost §1 exists to delete. Forcing the parent to re-run the verifier itself does
not help: the cost is the wake-up, not the judgement.

Two smaller things go with it. The checksum lock works because the driver is **a file** — a
model orchestrating inside a chat turn leaves no artifact to checksum, and nothing proves it
ran the verifier every iteration rather than skipping one. And a subagent chain only exists
inside a live turn, so there is nothing to start in a background terminal and walk away from.

The one case where the trade flips: a two- or three-iteration job you intend to watch anyway.
You are paying for the turns regardless, so the window rules are pure friction. For anything
you start and leave, use the script.

=======

## 8. Driving it from the dashboard

Two different questions live here, and they have opposite answers.

**Watching a loop: yes.** `/loops` shows every recorded run, its iterations, and the verifier
output from the last one, built from the `loop_runs` and `loop_iterations` tables that
`cc loop start|record|finish` write. That is what §1.4 covers.

Two properties of those tables are worth not losing:

- **`finish` cannot be told the answer.** `finishPassed` is a guarded UPDATE that only
  applies when a green iteration is already on record *under the spec digest the run was
  started with*. A caller that decided the loop passed writes nothing. `outcome` is
  `CHECK IN ('passed','failed')`, and `CHECK ((outcome IS NULL) = (finished_at IS NULL))`
  keeps a half-closed run from existing at all.
- **They are not `actions`.** Nothing here went through the executor, because nothing here
  mutated anything. The executor's capability list stays two items long — `merge` and
  `resolve` — and that shortness is the security property (DESIGN.md §19).

**Starting a loop from a button: no, and deliberately not.** The invariant is that this
system never invokes a language model; a "run loop" control is precisely that, and it would
mean a cron-reachable path from a queued action to an agent editing another repository. A
loop is started by a human in a terminal. The page exists to make that watchable afterwards,
which is the part that was actually missing.

The design for the sanctioned middle ground already exists: `chat:handoff` (`DESIGN.md` §13,
roadmap R12, **not built**). Its shape is deliberate and worth preserving:

1. a task emits `chat:handoff` carrying the facts it already gathered
2. on approval the executor performs only the **deterministic prep** — create the isolated
   `git worktree`, write a briefing to `data/handoffs/<action-id>.md`
3. the action moves to resolution `awaiting-human`; the dashboard surfaces a copy-pasteable
   invocation
4. **a human starts the agent** — manual by construction
5. the agent's mandatory closing step writes the result back with
   `npm run cc -- record-outcome --action <id> --status applied|abandoned`

Step 5 is load-bearing. Without it, work done in Chat is invisible to `actions` and the audit
trail has a hole exactly where the mutations happened.

The driver's own files remain the deepest record: every run writes `verify.txt`, `guard.txt`
and `cli-<n>.out` under `tmp/<ticket>/`. `/loops` stores the tail of the verifier output, not
the whole of it.
