---
description: "Refactor a file or package to restore clean abstraction layers, split oversized files, and remove mixed levels of abstraction. Use when a file exceeds 300 lines, a function exceeds 50, or a review flagged a layer violation."
mode: agent
argument-hint: "Path to refactor"
---

# Refactor for Abstraction

Refactor `${input:target}` so it obeys this project's layer and size rules.

## Non-negotiable

This is a **behaviour-preserving** change. Run the tests first and record the result. The
same tests must pass afterwards, unchanged. If you need to change a test, you are changing
behaviour — stop and say so.

## Procedure

1. **Record the baseline.**
   ```sh
   yarn test
   ```
   Paste the output. If it is not green before you start, stop and report that instead.
   Refactoring on top of a red suite means you can never prove what you broke.

2. **Name the responsibilities.** List every distinct thing the file currently does.
   More than one entry means more than one reason to change.

3. **Assign each responsibility to a layer.**

   ```
   L5 delivery   apps/*/app, apps/*/components
   L4 use-cases  apps/*/src, apps/hooks
   L3 adapters   apps/*/lib (external deps)
   L2 ports      interfaces in lib/ or apps/*
   L1 rules      pure functions in lib/ or apps/*
   L0 schema     types and validation only
   ```

4. **Split by responsibility, never by line count.** Each new file owns one concept and is
   named after it. No `utils`, `helpers`, or `common`.

5. **Separate the levels of abstraction.** In every function, the body must read at a single
   altitude. Extract detail into named functions until the top-level function reads as a
   sequence of intentions.

6. **Introduce a port if a vendor leaked upward.** Define the interface in the ports layer,
   move the SDK call into an adapter, and inject it. Add an in-memory fake.

7. **Verify.**
   ```sh
   npx next build && yarn test
   ```

8. **Get reviewed.** Delegate to the `code-reviewer` subagent and fix every BLOCKING finding.

## Constraints

- Do not add functionality. Do not fix unrelated bugs. Do not reformat untouched code.
- Do not delete a test to make the refactor easier.
- Do not add any suppression comment anywhere.
- Do not add doc comments to code whose behaviour you did not change.

## Report

```
BEFORE   <file> <n> lines, <n> exported functions, largest function <n> lines
AFTER    <file list with line counts and assigned layer>
MOVED    <what changed layer, and why it was in the wrong place>
PORTS    <any new interface introduced>
TESTS    <baseline result> → <final result>, unchanged: <yes/no>