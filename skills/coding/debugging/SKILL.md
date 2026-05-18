---
name: debugging
category: coding
tags: [debug, troubleshooting, logs, stack-trace, root-cause]
execution-mode: tool-call
description: 'Systematically debug issues by reproducing the bug, reading logs and stack traces, identifying root cause, and verifying fixes. Use when something is broken or behaving unexpectedly.'
argument-hint: 'Error message, stack trace, description of bug, or file to debug'
---

# Debugging

## When to Use
- "This isn't working" / "It's broken"
- Error messages, stack traces, or unexpected behavior
- Intermittent issues that need reproduction steps
- Performance regressions or timeouts

## Procedure (BDD-style Triage — Non-Negotiable)

1. **Reproduce with a test FIRST** — Write or find a failing test that demonstrates the bug. The test MUST fail before any fix. If no test exists, create a minimal reproduction script or side-by-side test file first. This is mandatory — never fix a bug without a failing test as evidence.
2. **Read logs** — Check application logs, browser console, network tab, and CI/CD output.
3. **Isolate** — Narrow down the scope: which file, function, or request is involved?
4. **Root cause** — Trace the error to its origin. Don't treat symptoms.
5. **Fix** — Make the smallest change that resolves the root cause.
6. **Verify** — The reproduction test must now pass. Run existing tests to ensure no regressions.

## Output Format

```
## Debug: <issue title>

### Reproduction
Steps to reproduce:
1. ...
2. ...

### Failing Test (Before Fix)
- [file](path): <test name or description of reproduction>

### Logs / Evidence
- [paste key error messages or stack traces]

### Root Cause
<description of the actual cause, not the symptom>

### Fix
- [file](path): <what changed and why>

### Verification
- [ ] Reproduction test now passes
- [ ] Existing test suite status: <pass/fail>
- [ ] `npx next build` succeeds
```

## Notes
- **Never patch symptoms.** Always find and fix the root cause.
- **A failing test is mandatory before any code change.** If you cannot write a test (purely visual/UI bug), document reproduction steps as a comment next to the relevant component.
- For non-deterministic bugs (race conditions, flaky tests), log to a gitignored audit file and add targeted guards.
- If the reproduction test passes immediately without your fix, it is NOT a valid reproduction — revise the test.