---
description: >
  Hard gate on posting a PR review. A review exists to move the PR forward, so every
  blocking claim must prove the CONSEQUENCE (not just the mechanism) with a command run this
  session, must show the broken path is reachable, and must carry a specific fix. Applies
  everywhere, because reviewing another repo's PR happens from any file in this workspace,
  and the shared reviewer skills (.copilot-config) cover posting mechanics but not claim
  validation.
applyTo: "**"
---

# A PR review must move the PR forward

The purpose of a review is to get the change merged in a better state. It is not to
demonstrate scrutiny, not to enumerate everything that could theoretically be wrong, and not
to hand the author a research project. **An unproven blocking claim is worse than saying
nothing**, because the author must stop, investigate, and disprove it — and they will trust
the next review less.

## The gate — no exceptions

**Do not post `REQUEST_CHANGES` unless every blocking finding satisfies all four:**

1. **Proven — the consequence, not the mechanism.** A command was run **this session**
   whose output would have come out differently if the finding were false. Paste that
   output. See the section below: proving how the code behaves is *not* proving that
   anything breaks, and only the second one may block.
2. **Reachable.** Evidence that the broken path actually executes in this codebase — a
   caller, a route, a test, a run. "This function throws when called" is not a finding
   until you show it gets called.
3. **Located.** An exact `file:line` that is present in the PR diff.
4. **Fixed.** A concrete fix the author can apply — the replacement code, or the exact
   command to run. Not "consider handling this", not "this should be validated".

If a finding fails any of the four, it is **not** blocking. Either downgrade it to a
non-blocking note phrased as a question ("is `x` guaranteed non-null here? I couldn't
confirm from the diff"), or drop it.

If **no** finding survives the gate, the verdict is `APPROVE`. Approving is a normal,
frequent outcome, not a failure to find something.

## Mechanism is not consequence

This is the specific way this gate has been passed while still being wrong. A command was
run, real output was pasted, the output was genuinely falsifiable — and the finding was
still baseless, because the command proved *how the code behaves* and the blocking claim
was about *what that costs*.

> Verified: `NODE_OPTIONS="…" && cmd` does not export, so the heap cap is not applied.
> Asserted, never measured: "the failure mode is an OOM-killed build."

The first is a fact about shell semantics. The second is a claim about a container's memory
limit, which was never looked at. **Only the second one justifies blocking, and it was
`ASSUMED`.**

So, before writing `Why it matters`, ask: *which command produced that sentence?* If the
answer is "none, it follows logically", the finding is `ASSUMED` and cannot block —
no matter how well-verified the mechanism underneath it is.

## Reality outranks your analysis

If the code you are about to block on **is already running in production**, already on the
base branch, or already copied across sibling repositories, then observed reality is
evidence *against* your impact claim. Before blocking you must reconcile the two:

- Say why the harm has not materialized yet, with evidence, **or**
- Accept that your impact model is wrong and downgrade to a question.

"It is already broken everywhere else" makes a finding *less* urgent to fix in this PR, not
more. It also means the right venue is a separate cleanup PR across all the affected repos —
say that, and approve this one.

**Corollary — a caveat that undercuts your own finding disqualifies it from blocking.** If
you find yourself writing "one thing I could not determine, and it changes how urgent this
is…", you have already established the finding is `ASSUMED`. Post it as a question. Writing
the caveat and blocking anyway is the worst of both: it looks rigorous and wastes the
author's time identically.

## Pre-existing gaps are not this PR's job

Before blocking on something missing, check whether the PR created the gap:

```sh
git diff --name-only origin/<base>...HEAD          # did it even touch the declaring file?
git show origin/<base>:<path>                      # was it already like this?
```

If the declaring file is untouched and the gap predates the branch, the PR is *advancing* an
incomplete rollout, not creating a defect. That is a note. Demanding a chore PR finish
someone else's half-done migration is scope creep, and it reads as obstruction however
carefully it is worded.

## Every finding states its confidence

Tag each finding, and never let an untagged assertion through:

| Tag | Means | May block? |
| --- | --- | --- |
| `VERIFIED` | Command run this session, output pasted below the claim | Yes |
| `ASSUMED` | Reasoned from the diff, not executed | No — phrase as a question |
| `UNKNOWN` | Could not determine | No — ask, do not assert |

Tag the **mechanism and the consequence separately**, because they are usually not the same
tag. `VERIFIED` mechanism + `ASSUMED` consequence is a non-blocking note, every time.

`VERIFIED` with no pasted output is a lie. This is auditable in constant time: the author can
scan for a `VERIFIED` with nothing beneath it.

## Every change request carries the fix

A blocking comment has this shape, and is rejected by this rule if it does not:

> **Blocking** — *what breaks, in one sentence*
>
> Why it matters: *the concrete consequence — data loss, 500, wrong total*
>
> Evidence: the command, and its real output, in a fenced block
>
> Fix: a fenced `diff` block showing the exact replacement lines

If you cannot write the fix, you do not understand the problem well enough to block on it.
Ask instead.

## Prohibited review content

- Restating the diff back to the author.
- Style opinions with no rule behind them in the repo's own config.
- "Consider…", "It might be worth…", "You may want to…" attached to a blocking finding.
  Blocking means "this must change and here is the change".
- Findings about code the PR did not touch, unless the PR breaks it — say which line breaks it.
- Repeating a claim from the PR description as if you had checked it. See below.
- More than one comment making the same point on different lines. Say it once, on the
  clearest instance, and name the other occurrences in that one comment.
- A blocking finding whose `Why it matters` line was reasoned rather than measured. If no
  command produced that sentence, it is a question, not a block.
- Blocking on an idiom the author says was copied from another repo, without first checking
  whether it is shipping there. Provenance does not make wrong code right, but it does move
  the fix to a cleanup PR and it disproves "this is about to break."

# Validating the claims themselves

These are the specific ways a review has already been wrong here. Do not infer any of them
from a green checkmark.

## "CI is green" must be proven, not inferred

`mergeable: CLEAN` and `gh pr checks` all-pass are NOT evidence a test stage executed. A stage
that was deleted, commented out, gated off, or never triggered reports nothing at all —
absence looks identical to success. Before claiming a PR's tests ran, check all three:

1. A build exists for the **current head SHA** (compare `headRefOid` to the build's commit).
2. The stage is present **and** its status is `SUCCESS`, not `NOT_EXECUTED` or absent.
3. The test report has **non-zero** pass counts — an empty suite can pass vacuously.

Equally: never block on "CI is failing" without naming the failing stage and the assertion.

## The diff you're reviewing may overstate the change

`gh pr diff` is a three-dot diff from the merge base — it can include code that is already on
the base branch (e.g. cherry-picked or duplicated commits), making the PR look bigger than
what actually lands. Blocking on code the PR did not introduce is the most direct way to waste
the author's time. Confirm the real delta first:

```sh
MB=$(git merge-base origin/<base> origin/<head>)
git log --oneline "$MB"..origin/<base>      # commits already on base, not part of this PR
git diff --stat origin/<base> origin/<head> # the actual two-dot delta
```

## Verify claims made in the PR description — don't just relay them

A PR body asserting "this fixes X" or "sets Y to Z" is a claim, not evidence. Check the actual
code on the base branch before repeating it in a review; a stale or wrong self-description in
the PR body does not get cleaned up on its own and will mislead the next reviewer too if it
goes unchallenged.

## A green test does not prove a fix works

To validate a fix, break it and watch the test fail: check out the pre-fix version of just the
changed file (leaving any new tests in place), run, confirm the expected tests go red, then
restore. A test that has never been observed failing proves nothing about the bug it claims to
cover.

## A falling error count can mean errors are being hidden, not fixed

`tsc` stops reporting semantic diagnostics once any file has a syntax error, so one unparseable
file (e.g. a botched merge-conflict resolution) can make an error count drop sharply while
real problems remain. Diff *which* errors changed (normalize and compare with `comm`), never
just the count. The same applies in reverse: do not blame the PR for errors that a control run
on the base branch also produces.

## Probe the real dependency; never grep its source for a marker

Grepping a package's source for a string answers a different question than running it. Import
the module and call it, with the fixture variants that actually exercise the path. Several
would-be blockers have died to a single `node -e` probe.

## Confirm branch and SHA immediately before the command you're about to cite

Fetching a branch is not checking it out. Print `git rev-parse --abbrev-ref HEAD` and
`git rev-parse HEAD` right before running the command whose output will be quoted in the
review — not once at the start of the session. A verification run on the wrong branch produces
a plausible pass that proves nothing.

## Re-reviews: prove the prior findings closed

Open with a **Resolved** section that names each earlier finding and pastes the command output
proving it is fixed, then new findings, then still-open, then explicitly what you are not
re-raising. Quote `git diff --stat <oldHead> <newHead>` so the author can see you read their
actual changes. Also read any merge commit's diff in that range — botched conflict resolutions
land there, not in the hand-written commits.
