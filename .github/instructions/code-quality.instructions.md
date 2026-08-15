---
description: "Use when writing or reviewing any source file in this repository. Covers abstraction layers, file and function size limits, naming, error handling, and banned escape hatches."
applyTo: "**/*.{js,jsx,ts,tsx,mjs,cjs}"
---

# Code Quality

## Layer placement — decide this before you type

Grove is a monorepo. Every new file belongs to exactly one layer. If you cannot name the layer, you do not yet understand the change.

| Layer | Path | May import | Must not contain |
| --- | --- | --- | --- |
| L0 schema | types, interfaces, validation schemas | nothing but builtins | anything else |
| L1 rules | pure functions in lib/ or apps/*/lib | L0 | I/O, clock, env, randomness |
| L2 ports | interface definitions | L0, L1 | runtime code — interfaces and types only |
| L3 adapters | apps/*/lib (external deps) | L0–L2 | business rules |
| L4 use-cases | apps/*/src, apps/hooks | L0–L2 | vendor SDKs, direct adapter construction |
| L5 delivery | apps/*/app, apps/*/components | L0–L4 | business rules |

Third-party SDKs may be imported in **L3 only**. Everywhere else, depend on a port.

Why this matters more with AI than without: an agent optimises locally. It will reach for
the nearest capable import to finish the current function. Layers turn "nearest" into a
mechanical error instead of a slow architectural drift nobody notices for six weeks.

## Size limits

| Unit | Hard limit |
| --- | --- |
| File | 300 lines |
| Function | 50 lines |
| Parameters | 4 (else pass one options object) |
| Nesting depth | 3 |

When a file crosses 300 lines, split it by **responsibility**, never by line count.
A file named `utils` or `helpers` means the responsibility was never identified.
Name the file after the one concept it owns.

These numbers are also a context strategy: a file that fits in a single read is a file the
next agent can reason about completely instead of guessing at the parts it did not load.

## One level of abstraction per function

A function body should read as a sequence of statements at the same conceptual altitude.
Mixing orchestration with byte-level detail is the most common defect in AI-written code.

```
// BAD — policy, parsing and I/O interleaved in one body:
//   query the database, then hand-edit a string with a regex,
//   then render, then upload — four altitudes, one function.

// GOOD — every line is one named intention:
//   require the record, normalise it, render it, store it, record the result.
//   The details live in named functions one level down.
```

Test: read the function aloud. If you switch between "what the business does" and "how a
string is escaped", extract the lower level into a named function.

## Naming

- Name by intent: `requireApprovedEntry`, not `getEntry` or `fetchData`.
- Booleans read as assertions: `isLocked`, `hasApprovedEntry`, `requiresReview`.
- One exported concept per file; the filename is that concept.
- A barrel/index file re-exports only. Never put logic in it.
- No default exports — they break rename refactors and defeat grep.

## Types

- No untyped escape hatch (`any`). Use the unknown-and-narrow pattern.
- No non-null assertions (`!`). Handle the absent case.
- No casts except immediately after a runtime-validated boundary.
- Types are **derived** from the single schema definition, never hand-written in parallel.
- Prefer branded identifiers over bare strings so ids cannot be swapped by accident.

## Errors

Typed error classes should live in `lib/errors.js` (or per-app equivalent) and carry a stable `code` and a correlation id.

- Never throw a bare error whose only content is a prose message.
- Never swallow an error silently. Log with the correlation id, or rethrow typed.
- Never catch an error to make a test pass.

## Comments

Comment **why**, never **what**. If a comment explains what the code does, rename instead.
Do not add doc comments to code you did not change.

## Forbidden

- Direct console output — use structured logging (`console.error` for errors only).
- Environment access outside of `process.env` with explicit defaults.
- Clock, randomness, or I/O inside pure functions — pass them in.
- Commented-out code. Delete it; version control remembers.
- `TODO` in code you are reporting as complete.
- Suppression comments added to make a gate pass.