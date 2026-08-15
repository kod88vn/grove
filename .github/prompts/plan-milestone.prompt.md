---
description: "Turn a vague request into a set of milestones that can each be proven complete by a command. Use at the start of a project, or whenever a request is too big for one session."
mode: agent
argument-hint: "The goal to break down"
---

# Plan Milestones

Break `${input:goal}` into milestones and write them into `docs/MILESTONES.md`.

Do not write any implementation code in this session. Planning and building in the same
breath is how scope silently expands and how gates get written to match whatever was built.

## A milestone is only valid if all five hold

1. **Vertical** — delivers observable behaviour end to end, not a layer.
2. **Small** — one session. If it needs two, it is two milestones.
3. **Gated** — one command whose output proves it works.
4. **Observable** — the required observation is specific enough that the result cannot be
   argued into passing. "It works" is not an observation. "Exit code 0 and the response
   contains a non-empty `id`" is.
5. **Ordered** — depends only on earlier milestones.

If you cannot write the gate command, you do not understand the milestone yet. Split it
further until you can.

## Procedure

1. **Establish the vocabulary.** Read `AGENTS.md`. If a term in the goal is undefined
   there, that is your first question, not an assumption.

2. **Verify the unknowns.** For every external dependency the goal implies, delegate to
   `docs-researcher` and record the results in `docs/STACK.md`. A plan built on a
   hallucinated API is worse than no plan — it looks executable.

3. **Find the thinnest end-to-end slice.** M1 should touch every layer and do almost
   nothing. It proves the wiring, which is where the surprises live.

4. **Order by risk, not by comfort.** Put the part most likely to be wrong first, while
   changing direction is still cheap.

5. **Write the gate before the scope.** For each milestone, write the gate command and the
   required observation *first*, then define scope as "whatever makes that observation true".

6. **Name what is deferred.** An explicit deferral list is what stops helpful scope creep.

## Output

Fill in the milestone table and per-milestone sections of `docs/MILESTONES.md`, then report:

```
MILESTONES   <n> milestones, <the first one named>
RISK ORDER   <why this order — what is being de-risked first>
GATES        <one line per milestone: command → observation>
DEFERRED     <what is explicitly not being built>
QUESTIONS    <the ambiguities that need a human answer before M1 starts>
UNKNOWNS     <what could not be verified, and what would verify it>
```

Then **stop**. Wait for approval before starting M1.