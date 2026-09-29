# LOOP.md — loop engineering

How a ticket becomes merged code without a human driving each turn: an agent writes, a
machine judges, and the judgment is one that the agent cannot forge.

The driver and entry-agent preflights exist. The supervisor does **not**; see the box below.
The worked runs in §5 are historical examples against `~/dev/web-storefront-ui`.
The revised supervisor design (D14/D15) is a **target, not a current capability**.

---

## 0. How to use it

### 0.1 Six steps

1. Open a **new chat session** (`+` in the Chat view), so a prior task cannot supply the wrong context.
2. Pick the agent for your task from §0.2. A wrong pick **STOPS** and names the right agent; it does not quietly switch roles.
3. Pick the model recommended in §0.2 **after** picking the agent. You may pick any model. The agent warns once if the *selected* model costs more than the task's tier, then continues. It checks `npm run --silent cc -- models self --session-log=<VSCODE_TARGET_SESSION_LOG> --tier=<tier>` against `npm run --silent cc -- models pick <tier>` (see `src/config/models-command.ts`). Agent re-selection reapplies its pin; `models self` cannot prove which backend served a request.
4. Type the **goal and repository** (path or name resolving to `~/dev/<name>`). A key alone does not tell the agent which repo to use. The only preflight question allowed is a missing repo.
5. **Today:** for an outside folder, add it to the workspace (to edit), approve individual unsandboxed terminal prompts, or scratch-clone a review target under bot/tmp. Read-only `list_dir` outside the workspace did not require a grant in Spike 0; other operations may prompt. There is no universal permission dialog. A repo already in this workspace needs no folder addition; approve only actual prompts.
6. Let the agent work. An architect reports `LOOP RUNNING — hands off.` with the run link and `LOOP FINISHED` with the ledger verdict (§1.4.1). Watch the dashboard instead of touching the worker window, files or driver. An analyst writes an incremental `tmp/<KEY>-report.md` and returns its answer, plan or review draft. If a command pends, the agent names the one approval needed; if the window closes, use §0.4.

### Target flow (designed, not built)

1. A human picks the entry agent in the main window and enqueues a goal; main chat only
   dispatches, monitors and reports. Durable `supervisor/` tick code (no LLM) keeps moving
   without a human; the main chat is **never** the place repo or network work is performed.
2. Architect, analyst, worker and tool-using judge run in separate child windows, one per
   repo/item, each with its own portable dir and user-data-dir. A main-thread judge subagent
   may only read in-workspace files. Subagent confirmation blocking is **ASSUMED** pending a
   spike. Web fetches, git/gh, builds/tests, installs, writes and outside-folder reads are
   child-only. The child opens the target repo or a scratch clone under bot/tmp; there is no
   main-thread outside-folder permission step.
3. Child profile self-approval is **designed** using approve-all, not UI clicking or forged
   consent. **VERIFIED** C-quinque 2 in the [design evidence](agent-docs/superpowers/specs/2026-09-28-loop-supervisor-design.md#8-spike-0--results-2026-09-2829):
   `TARGET True`, `run_in_terminal isConfirmed {'type': 1}` without a human click in that
   probe; global approve-all and off-limits containment are **UNKNOWN** until S13/S14/S18.
   System-file writes, secret reads/printing, compiled denylist operations and `gh pr merge`
   remain off-limits; the last two are existing invariants awaiting an explicit user decision.
4. A pending/denied off-limits call kills that child and parks the item in `needs_human` with
   evidence. Other unexpected pending calls get one fresh-session retry, then park. Driver
   immediately works other items and ends with one parked-items report; it never waits for
   a user answer. Model errors trigger artifact inspection, one rate-limit retry, same-tier
   single-model substitution, then tier escalation; exhaustion parks and continues. All
   recovery behavior is **designed, not built** (D6/D14/D15).

**Today, avoid approval stalls:** prefer approval-free main-thread paths. Do not leave a
main-thread subagent that may prompt running when you walk away; use an already-open target
window for the existing loop and check actual pending prompts when present.

### 0.2 Which agent?

| Task | Pick | Recommended model / tier |
| --- | --- | --- |
| Implementation, reproducible bug (red test first), checkable doc change, feedback on **your** PR, resume of those | `loop-architect` | GPT-6 Sol / architect |
| Planning, **someone else's** PR review (draft, not post), investigation without a reproducible bug | `loop-analyst` | GPT-6 Sol / architect |
| Research, a question, prose documentation | `loop-analyst` | Gemini 3.8 Flash / dispatcher |

The agent files at `.github/agents/` implement this task-fit preflight. `loop-judge` is a
consult/referee, not a human entry pick; `loop-worker` and its `.t2/.t3/.t4` variants are
driver-only. `loop-architect.t4` is a generated escalation variant, not an entry pick.
Variants remain visible because hiding them prevents `code chat -m` from finding them in
the installed VS Code mode lookup (Spike 0 B viii); their preflight refuses casual use.
`/loop <goal and repo>` is a one-message shim to architect, not a persistent agent choice.

**Wrong agent example:** choose `loop-architect` and type `Review PR #50 in grove; repo
~/dev/grove.` → `WRONG AGENT: this is code review. Pick loop-analyst with GPT-6 Sol.`
It offers “Not loopable — investigate or plan instead”; nothing is reviewed in that turn.

**Overpriced example:** choose `loop-analyst`, select Claude Opus 5.5, and type `What does
cc stalls do? Repo ~/dev/bot.` → `You picked Claude Opus 5.5 (oracle); this task needs
dispatcher: switch to Gemini 3.8 Flash.` It continues to answer. That is a warning about
the **selected** model, not a claim about backend billing.

### 0.3 Prompts you can paste

Each prompt below includes a repo (or a resume key whose driver records the repo). Models
are recommendations from `registry/model-tiers.json`; the preflight checks selected-model
cost. “Preflight approval” means approve an actual terminal unsandboxed prompt if shown,
not a blanket grant **today**. Each permission cell also describes the **unbuilt target**;
target children self-approve permitted work, never off-limits work. The examples are
**templates**, not claims that these tasks or PRs exist.

| Task | Agent · model | Exact prompt text | Permission step |
| --- | --- | --- | --- |
| Implementation from a ticket | `loop-architect` · GPT-6 Sol | `WS-6673 in ~/dev/web-storefront-ui.` | Today: add repo/use loop window; approve outside-folder `git -C` prompt. Target: repo child self-approves permitted preflight and work. |
| Plain-description implementation | `loop-architect` · GPT-6 Sol | `grove: the homeworks review page should show each submission's percentage next to its score. Repo ~/dev/grove.` | Today: workspace folder; approve real preflight prompt. Target: grove child self-approves; non-Clover key, no Jira. |
| Bug fix, red repro | `loop-architect` · GPT-6 Sol | `Bug in ~/dev/grove apps/games: tic-tac-toe shows 'Nora wins' on a draw. Reproduce it as a failing test, then fix.` | Today: workspace folder; approve preflight if prompted, red repro first. Target: child runs repro/build without main approval. |
| Planning | `loop-analyst` · GPT-6 Sol | `Plan grove HOMEWORK_PLAN.md phase 2 as loopable items; repo ~/dev/grove; write tmp/GROVE-HW2-plan.md with a §4.1 triage verdict per item.` | Today: workspace folder; approve preflight prompt. Target: analyst child reads/writes; main only monitors. |
| Review someone else's PR | `loop-analyst` · GPT-6 Sol | `Review PR #2442 in clover/web-storefront-engine under pr-review-verification. Repo ~/dev/web-storefront-engine. Draft to tmp/rv2442-review.md; do not post.` | Today: scratch clone under bot/tmp with SSH approval; human posts. Target: child clones/reviews under bot/tmp; posting others' review remains human-only/parked. |
| Address feedback on your PR | `loop-architect` · GPT-6 Sol | `WS-6673: PR #181 in web-storefront-ui has review comments — run phase 6 until merged. Repo ~/dev/web-storefront-ui.` | Today: add repo/use loop window; approve terminal/SSH prompts. Target: child handles own PR; external merge remains outside driver (D1). |
| Debug / investigate without repro | `loop-analyst` · GPT-6 Sol | `Investigate why the grove homeworks review page sometimes displays a blank score; repo ~/dev/grove. Record evidence and a reproduction path, but do not change code yet.` | Today: workspace folder; approve preflight if prompted. Target: analyst child investigates; main does not run tests. |
| Research question | `loop-analyst` · Gemini 3.8 Flash | `In ~/dev/web-storefront-engine, where is the retail-zone rewrite defined and which cookie selects it? Cite file:line.` | Today: read tools need no folder grant; approve terminal grep if prompted. Target: child handles outside reads/web; no main approval. |
| Prose docs | `loop-analyst` · Gemini 3.8 Flash | `Document the /homeworks/review API contract from grove AGENTS.md in apps/homeworks/README.md; repo ~/dev/grove; branch + PR.` | Today: workspace folder; approve preflight/push prompts. Target: child writes, verifies and pushes own branch; no main prompt. |
| Resume after closed window | `loop-architect` · GPT-6 Sol | `resume GROVE-P04; repo ~/dev/grove.` | Today: reopen repo window; approve preflight if prompted; recover `REPO=` from saved driver. Target: tick resumes child from artifacts, not chat memory. |
| Resume after escalation / needs_human | `loop-architect` · GPT-6 Sol | `resume GROVE-P04; repo ~/dev/grove. The last run said CONSULT_NEEDED or needs_human; read the consult/judgment and ledger, then continue from the actual artifacts.` | Today: workspace folder; approve real preflight prompt; never bypass pending approval. Target: child resumes only after evidence/decision; parked items do not block others. |

### 0.4 Resuming safely

In a **new** chat choose the same entry agent and send `resume <KEY>; repo <path>.` For
an architect, inspect `tmp/<KEY>*`, `npm run cc -- loop status`, the target branch and
PR state (if remote); a saved driver can supply `REPO=`. A consult without judgment goes
to `loop-judge`; a committed spec without driver resumes at arm; a passed run without PR
resumes at referee; an open PR resumes at feedback. An unclosed row with a dead driver
is **not** a pass: record the stale row and start a new run. An analyst resumes from its
incremental report but rechecks actual files. Artifacts outrank chat recollection.

> **Designed, not built yet — supervisor / dedicated instance.** `supervisor/`, the
> portable-profile instance manager, pending/error classifier, crash reaper, autonomous
> intake, model substitution, dashboard board and migrations are design only. Spikes
> S13–S18 gate the new approval, isolation and error behavior. Today's driver still needs an already-open
> target window (§1.2); do not assume automatic teardown, unattended approvals or
> auto-resume after a closed window.

---

## 1. Running a manual loop again

For the manual loop specifically, choose **`loop-architect`** using §0's preflight and
name the target repo with your goal, for example:

```
WS-6673 in ~/dev/web-storefront-ui.
```

Either a ticket or a plain description works **with a repo**. `/loop <same goal and repo>`
still works as a one-message shim; prefer selecting the persistent entry agent. The model
pin is a default, not a lock: you may change the selected model after choosing the agent.

| | `loop-architect` agent | `/loop` prompt |
| --- | --- | --- |
| Model | pinned by the agent | whatever the picker says |
| Lifetime | the whole job, including the referee pass | one message |
| Source of truth | `.github/agents/loop-architect.agent.md` | reads that same file |

After §0 preflight it **triages** (§4.1) and then sends the assertions table it intends
to write, and any open questions, to `loop-judge` rather than to you directly — only a
decision `loop-judge` marks `CRITICAL` reaches you (`.github/agents/loop-architect.agent.md`,
"Escalation"). You are not asked to write a test — see §3.

Six roles across intake and the loop. The gate that decides pass or fail is not a model:

| Role | Who | Runs | Decides |
| --- | --- | --- | --- |
| **Analyst** | `loop-analyst`, dispatcher or architect tier by task | as needed, outside the grind | research, investigation, planning, prose docs or review drafts; hands loopable work to Architect |
| **Architect** | registry `architect` tier by default, in your session today; child in target | once | what "done" means — turns your requirements into a failing test |
| **Judge** | `loop-judge`, registry `oracle` tier; child for tools in target, main subagent only for read-only in-workspace analysis | per judgment call | open questions, bounce-back triage disputes, and the phase-4 referee verdict |
| **Worker** | `loop-worker`, cheap model, headless | once per iteration | how to make it pass |
| **Gate** | no model | every 5s | **whether it passed** — exit code and checksums |
| **Referee** | `loop-architect`, consulting `loop-judge` for the verdict; child in target | once | whether the pass is the one you wanted |

The Gate sits between the Worker and the Referee, so **the expensive judge model (`loop-judge`,
the `oracle` tier) never sees a red run**. It is not in the polling loop and is not woken between
iterations. That is the whole reason a loop with a four-turn budget does not cost four
expensive turns.

Architect and Referee are the same agent — `loop-architect`, phases 0–2 and 4–5.
`LOOP.html` is all of this explained for someone who has never done it.

The worker's default model comes from `registry/model-tiers.json`, stamped into agent
frontmatter by `cc models apply`; the driver dispatches `code chat -m loop-worker` and
checks the agent file exists first (`scripts/loop.sh`). Change the **registry**, not the
generated agent line. A missing custom mode can silently select the default; check the
model picker on your first run.

**Target, not built:** the supervisor tick dispatches architect/analyst, worker and
tool-using judge to children, each with its own portable/user-data pair per repo/item.
Main chat enqueues and monitors only, without git, gh, web fetches, outside reads,
builds or tests. A stopped child parks its item; the driver continues.

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

Run it from a VS Code terminal with a window open on **this** repo. The driver talks to an
**already-open** window on the *target* repo and refuses to start (`ABORT — no open window`)
without one: a window it opens itself cannot be closed reliably, and one folder per item left
nine orphan windows on 2026-09-27. Keep one loop folder per repo and switch branches inside it
(`git -C <folder> switch -c <branch> <base>`) rather than adding a worktree per item. Scratch
files live in `tmp/`, which is gitignored — see `.github/instructions/scratch-space.instructions.md`.

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

**A stray session is not a block — ignore it, never close a window, and never wait for the
user.**
A stray is an extra chat session, one that landed in the wrong window, or a duplicate from a
double-run command. The verifier alone decides each iteration, so a stray costs at most one
turn of budget and the loop carries on regardless. The user may not be there, so nothing here
waits on them:

1. **Find it.** Look for a new `.jsonl` under any
   `~/Library/Application Support/Code/User/workspaceStorage/*/chatSessions/` newer than the
   dispatch. That hash folder's `workspace.json` names the window's folder — verified
   2026-09-24, every store maps back (`"folder": "file:///…/harvester/tmp/trials/…"`). If the
   folder is `REPO`, it is not a stray.
2. **Ignore and discard it.** Do not close its window — no automated close is safe: `code` has
   no close flag, System Events cannot reach fullscreen or other-Space windows, and
   `kill -TERM` on the renderer raises a confirmation box on a real loop window (2026-09-27).
   Do not read it, resume it, or count its output. Do not stop to ask.

Whichever way it went, list it in the end message as a one-liner: the window, and that it was
left open. The run's **own** window is never closed: `scripts/loop.sh` only runs
against a window that was already open on `$REPO` (see §1.2), and reuses it for the next item.
The steps above apply only to a **stray** session that lands in some other window mid-run.

### 1.5 After a PASS

The loop stops at green. It deliberately does **not** commit, push, or open a PR — see §6.
Finish by hand or in a normal chat session: rebase onto the base branch, commit, push, and
open the PR.

**Green is not merged.** Then comes the review round (architect phase 6). Poll the PR, and
triage every review finding by proving it or disproving it. Each real behavioural finding
becomes a new red spec and a re-armed run (`<KEY>b`) on the same branch. A false finding
gets an evidence reply, not a code change. Repeat until the PR is merged. PR #50 is the
case that added this rule: the gate passed, the build passed, and the page still
prerendered blank.

Once the PR is merged, close the ticket:

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
translation is the Architect's entire job. The Architect runs on the registry's `architect`
tier by default and does not carry the judgment calls itself: a genuinely ambiguous
requirement, an open default, or the phase-4 referee verdict is escalated to `loop-judge`
(the `oracle` tier), which decides rather than bouncing the question back — only a
`CRITICAL` verdict from `loop-judge` reaches you
(`.github/agents/loop-architect.agent.md`, "Escalation").

| You supply, in prose | The Architect turns it into | When |
| --- | --- | --- |
| "flag real differences, ignore noise" | a test feeding fixture HTML pairs and asserting the emitted verdict | phase 1 |
| an adjective — "fast" | a number: the suite must finish under five minutes | phase 1 |
| a rule — "don't hardcode selectors" | a test that fails on any `data-testid` declared outside `pom.ts` | phase 1 |
| something genuinely ambiguous | a consult to `loop-judge`, each question carrying a proposed default | phase 0 |

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

## 6a. Model tiers — which model plays which role, and how it changes

Every role in a loop (`loop-worker`, `loop-architect`, `loop-judge`) is pinned to a model in
`registry/model-tiers.json`, not hardcoded in the agent file. Four tiers, lowest to highest:
`worker`, `dispatcher`, `architect`, `oracle`. Each tier lists its models in priority order —
the primary, then same-tier alternates only. A fallback never crosses into a higher tier by
accident; that silent 10x-priced fallback is exactly the bug this registry replaced.

**When pricing or the model catalogue changes:**

1. Edit `registry/model-tiers.json` by hand — add a model, move a primary, adjust a
   `maxOutputPrice` band.
2. Run `npm run cc -- models` to review: it lists every registered model with its current
   catalogue price and status (`ok` / `missing` / `over-band`), plus in-band candidates not
   yet registered, and flags any agent file whose frontmatter disagrees with the registry.
3. Run `npm run cc -- models apply` to stamp the agent files' `model:` lines from the
   registry. `npm run models:check` (part of `npm run verify`) fails the gate if a `model:`
   line was hand-edited out of sync with the registry — that check is what makes a stray pin
   visible instead of silently shipping.

**Escalation — any role, triggered by doubt, not just failure.** If a loop iteration fails,
exhausts its budget, comes back `shrunk`, the referee rejects a diff, `loop-judge` reports low
confidence, or a human or another agent doubts a result: redo the same role one tier higher
with `npm run cc -- models pick <role> --escalate=1` (stack further on repeated failure,
capped at `oracle`), and record `role, from→to model, trigger` in `tmp/<KEY>-decisions.md`.

**Target D15 (designed, not built):** check artifacts/ledger before treating a missing chat
reply as failure. Rate limit gets one bounded same-model retry, then a different single-model
`.m-<slug>` variant **within the tier**, without using an escalation rung. Only after the
tier is exhausted climb D11. `code chat` cannot switch models with a flag; an available but
erroring first choice does not fall through. Exact JSONL error signature and pin fidelity
are **UNKNOWN** until S15. After every tier is exhausted, park and continue other items.

`loop-worker` is dispatched headlessly (`code chat -m <agent>`), and `code chat --help`
(checked 2026-09-29) has no model-override flag — only `-m/--mode`, which selects an *agent
file*. So escalating the worker means dispatching a different file, not a different flag.
`cc models apply` generates one variant file per tier above `loop-worker`'s own —
`loop-worker.t2.agent.md` (dispatcher), `.t3` (architect), `.t4` (oracle) — each identical to
the base file except its `name:` and `model:` lines, kept in sync by the same `--check` gate.
`scripts/loop.sh` reads `WORKER_AGENT` (default `loop-worker`) to pick which one to dispatch;
set it to `loop-worker.t2` etc. on a re-arm instead of hand-editing the worker agent file.

`loop-architect` is a **top-level entry agent**, not normally a `runSubagent` call.
`cc models apply` also generates `loop-architect.t4.agent.md` for oracle-tier headless
escalation (rank suffix, not “second variant”); a human may instead reselect the base
architect and choose a different model in the picker. A top-level architect consults
`loop-judge`; when itself dispatched as a subagent and unable to nest-dispatch, it writes
`tmp/<KEY>-consult.md` and returns `CONSULT_NEEDED` for the dispatcher to handle. The
judge is a leaf already at `oracle`; it cannot escalate itself, so a truly critical
decision reaches the user. See the built preflights and D11 in the supervisor design.

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

**Target additional reason (ASSUMED; S16 pending):** a subagent's tool confirmation can
surface in the main window and block the parent when nobody is around. Only read-only
in-workspace subagent analysis belongs there; tool-using work runs in a child window.

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

**Today, starting a loop from a button: no, and deliberately not.** The invariant is that this
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

**Target (designed, not built):** the separate `supervisor/` code process may take queued
items from a board and dispatch children; buttons only set desired state. `cc` and its MCP
remain read-only with respect to models; the main chat only enqueues, monitors and reports.
Anything requiring a person is parked while other items progress.

The driver's own files remain the deepest record: every run writes `verify.txt`, `guard.txt`
and `cli-<n>.out` under `tmp/<ticket>/`. `/loops` stores the tail of the verifier output, not
the whole of it.
