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

## Procedure (BDD-style Triage)

1. **Reproduce** — Write or find a failing test that demonstrates the bug. If no test exists, create a minimal reproduction script first.
2. **Read logs** — Check application logs, browser console, network tab, and CI/CD output.
3. **Isolate** — Narrow down the scope: which file, function, or request is involved?
4. **Root cause** — Trace the error to its origin. Don't treat symptoms.
5. **Fix** — Make the smallest change that resolves the root cause.
6. **Verify** — Run existing tests. Ensure the reproduction case passes now.

## Output Format

```
## Debug: <issue title>

### Reproduction
Steps to reproduce:
1. ...
2. ...

### Logs / Evidence
- [paste key error messages or stack traces]

### Root Cause
<description of the actual cause, not the symptom>

### Fix
- [file](path): <what changed and why>

### Verification
- [ ] Test command that now passes
- [ ] Existing test suite status
```

## Notes
- Never patch symptoms. Always find the root cause.
- If a reproduction test doesn't exist, write one before fixing.
- For non-deterministic bugs (race conditions, flaky tests), log to a gitignored audit file and add targeted guards.