---
name: milestone-workflow
description: 'Run one milestone end to end with a verifiable outcome. Enforces plan-then-build-then-verify, layer discipline, size limits, and a real command-output gate before anything is called done.'
argument-hint: 'Milestone id, e.g. M1'
---

# Milestone Workflow

One milestone per session. Never two.

The scarce resource is not the model's ability to write code — it is your ability to trust
what it wrote. Every step below exists to convert a claim into evidence.

Milestones and their gates are defined in `docs/MILESTONES.md`. Do not invent scope.

## Procedure

### Step 1 — Orient (cheap)

Read `AGENTS.md` and `.github/copilot-instructions.md`. For anything else, delegate to
the `spec-lookup` subagent rather than reading the specification yourself. Large documents
must not enter the main context.

### Step 2 — Verify externals (anti-hallucination)

If this milestone touches any external API, CLI, library, or configuration key you have not
already verified **this session**, delegate to `docs-researcher` first. Then record the
finding in `docs/STACK.md` with today's date and a source URL.

Do not write a version number, model name, endpoint, or CLI flag from memory.

### Step 3 — Plan, then stop

Produce this and **wait for approval**. Planning before building is what makes the outcome
verifiable: the gate is agreed before there is any incentive to soften it.

```
MILESTONE  M<n> — <name>
DELIVERS   <one sentence of observable behaviour>
FILES      <path> — <layer L0-L5> — <one-line responsibility>
            ...
PORTS      <any new interface>
TESTS      <the specific behaviours that will be asserted>
GATE       <the exact command that will prove this is done>
OBSERVE    <what must appear in that output — specific enough to fail>
RISKS      <anything ambiguous, phrased as a question>
UNKNOWNS   <anything you could not verify — say so, do not guess>
```

If `RISKS` contains a real ambiguity, ask **one** question. Do not choose silently.
If `UNKNOWNS` is empty, look harder — an empty unknowns list is usually false confidence.

### Step 4 — Build

Work file by file. For each:

- Assign it to exactly one layer. If you cannot, the design is wrong — return to Step 3.
- Keep it under 300 lines and each function under 50.
- Keep one level of abstraction per function.
- Write the test alongside, not afterwards.
- No escape hatches, no `TODO`, no placeholder implementations.

Never import a third-party SDK outside the adapter layer (L3). Never let the rules layer touch
I/O, the clock, the environment, or randomness.

### Step 5 — Verify with real output

Run every universal gate and paste actual output:

```sh
npx next build
yarn test
node scripts/arch-check.mjs
node scripts/quality-check.mjs
```

Then the milestone's own gate command from `docs/MILESTONES.md`.

Delegate to `milestone-verifier` for an independent check. **You are not permitted to mark
a milestone complete on your own assessment.** The author never signs off on the audit.

### Step 6 — Review

Delegate to `code-reviewer`. Fix every BLOCKING finding. Re-run Step 5 afterwards — a fix
is a change, and an unverified change is an unverified milestone.

### Step 7 — Commit and stop

```sh
git add -A && git commit -m "M<n>: <what changed>"
```

Append a row to the completion log in `docs/MILESTONES.md`, then report:

```
DONE       M<n>
EVIDENCE   <the gate command and its real output>
CHANGED    <file list>
DEVIATIONS <anything built differently from the plan, and why>
NEXT       M<n+1> — <name>
```

Then **stop**. Do not begin the next milestone.

## Failure protocol

If a gate fails:

1. Report the failure with real output. Do not describe it as a warning.
2. Diagnose the cause. Do not retry the same approach.
3. Never weaken a test, never suppress a type error, never disable a lint rule to get green.
4. If blocked after two genuine attempts, stop and explain precisely what is blocking you.

A blocked milestone reported honestly is a good outcome. A green build that lies is not.

## Never do

- Claim tests pass without running them.
- Report a milestone done with a `TODO` in the code.
- Work on two milestones at once.
- Skip the plan step because the task "seems small".
- Change a test so the code passes.
- Edit `ai-guard.config.json` to make a violation disappear.