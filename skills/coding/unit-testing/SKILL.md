---
name: unit-testing
category: coding
tags: [testing, unit, BDD, TDD, jest, playwright]
execution-mode: tool-call
description: 'Write and maintain unit tests following BDD-style triage. Use when adding tests, fixing broken tests, or implementing TDD workflows. Covers Jest, Playwright, and Next.js test patterns.'
argument-hint: 'File to test, failing test case, or feature description'
---

# Unit Testing

## When to Use
- "Write tests for this function"
- "Fix the failing test"
- "Add coverage for this module"
- TDD workflow: red → green → refactor

## Procedure (BDD-style Triage)

1. **Reproduce failure** — Run the failing test and read its output. Understand what it expects vs. gets.
2. **Check the assertion** — Is the test correct? If yes, the code is wrong. If no, fix the test.
3. **Fix the code** — Make minimal change to pass the test without breaking others.
4. **Run full suite** — Ensure no regressions introduced.

## Test Writing Rules

- Name tests descriptively: `should_<behavior>_<condition>`
- One assertion per concept; group related assertions.
- Arrange → Act → Assert structure.
- Use fixtures for shared setup data.
- Mock external dependencies (APIs, databases, Ollama).

## Groove-Specific Notes

- **Tests live side by side with source code ONLY.** `*.test.js` next to the module they test.
- **NEVER use `__tests__/` or `test/` directories.** This contradicts the side-by-side testing rule.
- Jest config: `apps/<app>/jest.config.cjs` (CJS mode). Configure to discover `**/*.test.js` and `**/*.spec.js`.
- Playwright E2E: `apps/nora/playwright.config.js` for browser tests.
- Ollama calls must be mocked — never hit the real endpoint in CI.

## BDD Bug Reproduction (Mandatory)

When fixing ANY bug or regression:

1. **Write a failing test FIRST** — The test must fail before your fix. This proves the test is valid.
2. **Fix the code** — Minimal change to make the failing test pass.
3. **Run full suite** — No regressions allowed.
4. **Build** — `npx next build` to catch build-time issues.

If you cannot write a test for the bug (e.g., purely visual/UI), document reproduction steps as a comment next to the relevant component.

## Output Format

For new tests:
```
### Tests Added/Updated
- [file](path): <what is tested>

### Test Command
```bash
cd apps/<app> && yarn test
```

For bug fixes (BDD):
```
### Bug Fix: <issue title>

#### Failing Test (Before Fix)
- [file](path): test that reproduced the bug — <description>

#### Root Cause
<what was wrong>

#### Fix
- [file](path): <what changed and why>

### Verification
- [ ] Failing test now passes
- [ ] Full test suite passes
- [ ] `npx next build` succeeds
```
