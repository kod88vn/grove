---
description: "Use when writing tests, adding fixtures, or verifying a milestone. Covers what is worth testing, fakes over mocks, determinism, and the ban on tests that assert nothing."
applyTo: "**/*.test.{js,jsx,ts,tsx,mjs,cjs}"
---

# Testing

## Tests are the verification layer, not a chore

In an AI-assisted workflow the test suite is the only thing standing between a confident
claim and a shipped defect. Weight it accordingly: test the things that would be expensive
to get wrong, not the things that are easy to write.

## What actually matters here

Rank the risks for this project and test in that order. Coverage percentage is not the goal;
covering the expensive failures is.

| Priority | What | Where |
| --- | --- | --- |
| 1 | The calculation or transformation that must never be wrong | `lib/`, core logic |
| 2 | The invariant that would be a business incident if violated | domain rules |
| 3 | The boundary that untrusted input crosses | API routes, parsers |
| 4 | Schema accepts and rejects real-world shapes | validation layers |

## Mandatory assertions

These encode findings from real data. They must exist and must never be weakened.

```js
it("exact input → exact output")
it("accepts the real-world record that lacks optional field")
it("rejects the invalid case that must never pass")
it("holds the frozen constant name to its known hash")
```

Write the expected values from the real source data, never from what the implementation
currently returns. A test written by reading the output is a screenshot, not a test.

## Rules

1. **Every exported function in the rules and schema layers gets a test.** Those layers are
   pure, so there is no excuse.
2. **Test behaviour, not implementation.** Never assert on a private function or a call
   count. If you must spy to test it, the seam is in the wrong place.
3. **Fakes, not mocks.** Implement the port interface with an in-memory fake. Mocking a
   vendor SDK tests your mock, not your code.
4. **No network in unit tests.** Record external responses as fixtures. Tests run offline,
   free, and deterministically. Re-recording is an explicit, manual command.
5. **A test with no assertion is not a test.** "It did not throw" is only acceptable when
   not throwing is the literal requirement being stated.
6. **Never change a test to make code pass.** If a test is wrong, say so and explain why
   before touching it. This is the single most common way an AI workflow silently rots.
7. **Name the scenario, not the function.** `rejects an override with no reason`, not
   `test patchDocument`.
8. **A new test must be able to fail.** Before committing, confirm it fails without the new
   code. A test that passes on an empty implementation verifies nothing.

## Determinism

Anything that varies between runs — time, randomness, iteration order, locale, floating
point formatting, compression timestamps — must be injected or frozen. A flaky gate is
worse than no gate: it trains everyone to re-run until green.

## Integration tests

Exercise the real boundary with fake adapters returning recorded fixtures. Required
scenarios: the happy path, each typed failure, and each rejection at the input boundary
(bad type, oversized payload, missing authorisation).

## Side-by-side placement (Grove rule)

Test files MUST live side by side with the production code they test.

- `apps/homeworks/components/MathExercise.js` → `apps/homeworks/components/MathExercise.test.js`
- `apps/nora/lib/db.js` → `apps/nora/lib/db.test.js` (unless excluded — see AGENTS.md)
- **No `test/`, `__tests__/`, or any other flat test directory is allowed.**

## Reporting

Never say "tests pass" without running them. Paste the command and its real output:

```sh
yarn test
# or for a specific app:
cd apps/homeworks && yarn test