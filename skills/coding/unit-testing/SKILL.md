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

- Tests live alongside source: `__tests__/` or `*.test.js` next to the module.
- Jest config: `apps/<app>/jest.config.cjs` (CJS mode).
- Playwright E2E: `apps/nora/playwright.config.js` for browser tests.
- Ollama calls must be mocked — never hit the real endpoint in CI.

## Output Format

```
### Tests Added/Updated
- [file](path): <what is tested>

### Test Command
```bash
cd apps/<app> && yarn test