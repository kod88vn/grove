# LOOP.md — loop engineering

How a ticket becomes merged code without a human driving each turn: an agent writes, a
machine judges, and the judgment is one that the agent cannot forge.

This is not a design document. Everything below has been run. The worked examples at the
bottom are two real loops against `~/dev/web-storefront-ui` that ended in PR #181.

---

## 1. Using it again

Copy the template in §1.3, change six values, run it. That is the whole workflow.

### 1.1 The six values

| Value | What it is | Example from WS-5985 |
| --- | --- | --- |
| `REPO` | absolute path to the target repo | `/Users/jay.quach/dev/web-storefront-ui` |
| `LOCK` | the file the agent must not edit | `.../storybookCoverage.test.tsx` |
| `verify()` | the command whose exit code *is* "done" | `./node_modules/.bin/jest` |
| `BASELINE` | a number that must grow, never shrink | `787` tests |
| `TASK` | the briefing, written for a stranger | see §3 |
| `MAX_ITER` | how many agent turns you are willing to buy | `4` |

If you cannot fill in `verify()` as a **single command that exits non-zero today**, stop.
You do not have a loop yet, you have a wish. Go write the spec first (§3).

### 1.2 Running one

```bash
cp tmp/ws5985-loop.sh tmp/<ticket>-loop.sh   # start from a run that worked
$EDITOR tmp/<ticket>-loop.sh                 # change the six values
bash tmp/<ticket>-loop.sh                    # runs unattended; prints a verdict
```

Run it from a VS Code terminal with a window open on **this** repo. The driver opens the
*target* repo in its own window and talks to that one. Scratch files live in `tmp/`, which
is gitignored — see `.github/instructions/scratch-space.instructions.md`.

It ends by printing `passed` or `failed` and the reason, and leaves the same verdict at
`/loops` for later. There is no third outcome and no partial credit.

### 1.3 The template

The shell runs the verifier and reports two facts — an exit code and a test count. It does
**not** decide whether the run passed. That judgement lives in `cc loop record`, which
re-checksums the spec itself, so a driver script that has been edited mid-run cannot talk its
way to a green.

```bash
#!/bin/bash
set -u

CODE="/Applications/Visual Studio Code.app/Contents/Resources/app/bin/code"
CC="npm --prefix /Users/jay.quach/dev/bot run --silent cc --"
REPO="/absolute/path/to/target/repo"
SPEC="path/to/spec.test.ts"                 # RELATIVE to $REPO — checksum-locked
OUT="/Users/jay.quach/dev/bot/tmp/<ticket>"
TICKET="WS-0000"
BASELINE=0                                  # current test count; must GROW
MAX_ITER=4
POLL_LIMIT=72                               # x5s = 6 min per iteration

mkdir -p "$OUT"

# Sets RC and TOTAL. Judging happens in the ledger, not here.
verify() {
  ( cd "$REPO" && ./node_modules/.bin/jest --passWithNoTests > "$OUT/verify.txt" 2>&1 )
  RC=$?
  TOTAL=$(grep -oE "Tests:.*[0-9]+ total" "$OUT/verify.txt" | grep -oE "[0-9]+" | tail -1)
  TOTAL=${TOTAL:-0}
}

TASK="<the briefing — see LOOP.md section 3>"

echo "--- iteration 0: confirm the work is genuinely undone ---"
verify
RUN=$($CC loop start --ticket="$TICKET" --repo="$REPO" --spec="$SPEC" \
        --verifier="jest" --exit="$RC" --tests="$BASELINE" --budget="$MAX_ITER") || {
  echo "ABORT - refused to start: already green, or the spec is unreadable."; exit 1; }
echo "run $RUN — watch it at http://127.0.0.1:4747/loops/$RUN"

ITER=0
STATE=red
while [ "$ITER" -lt "$MAX_ITER" ]; do
  ITER=$((ITER + 1))
  echo "--- iteration $ITER of $MAX_ITER ---"
  FAILURES="$(grep -E "^(  ●|Cannot find module|Tests:)" "$OUT/verify.txt" | head -25)"

  "$CODE" "$REPO" >/dev/null 2>&1        # ensure a window on the target repo
  sleep 6
  "$CODE" chat -m agent -r "$TASK

Current verifier output:
$FAILURES" > "$OUT/cli-$ITER.out" 2>&1

  POLLS=0
  while [ "$POLLS" -lt "$POLL_LIMIT" ]; do
    sleep 5; POLLS=$((POLLS + 1))
    verify
    [ "$RC" -eq 0 ] && break
  done

  STATE=$($CC loop record --run="$RUN" --iteration="$ITER" --exit="$RC" \
            --tests="$TOTAL" --tail="$OUT/verify.txt")
  echo "iteration $ITER: $STATE"
  [ "$STATE" != "red" ] && break
done

$CC loop finish --run="$RUN"      # prints passed/failed and the reason
git -C "$REPO" status --porcelain
```

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

## 3. Writing the spec before the loop

A loop is only as good as the thing it polls. The ordering is not negotiable:

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
| One repo at a time | the driver opens a window on `REPO` and dispatches there. Two concurrent loops on two repos will interleave windows. |
| `copilot` CLI is not an option | installed at `1.0.81`, but every `-p` invocation returns `Access denied by policy settings`. `code chat` is a different binary and is not blocked. |
| The sandbox is not a boundary | escalation out of it is per-command and silent. From an escalated run, `~/.ssh/id_ed25519` was readable and `$JIRA_DC_TOKEN` was in the environment. Loop only on repos you would hand the agent anyway. |
| Polling costs a full suite run | `POLL_LIMIT=72` at 5s means up to 72 jest runs per iteration. Fine for a 90s suite; reconsider for a 10-minute one. |

---

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
