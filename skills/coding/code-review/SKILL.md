---
name: code-review
category: coding
tags: [review, quality, security, bugs, audit]
execution-mode: tool-call
description: 'Review code for correctness, security, style, and maintainability. Use when asked to review a PR, audit a file, check for bugs, or improve code quality. Covers any language.'
argument-hint: 'File path, PR number, or code snippet to review'
---

# Code Review

## When to Use
- "Review this file/function/PR"
- "Find bugs or security issues in this code"
- "Check if this follows best practices"
- Pre-commit or pre-merge quality checks

## Procedure

1. **Understand context** — read the file(s), related tests, and any linked issue/PR description.
2. **Check correctness** — verify logic, edge cases, and error handling.
3. **Check security** — look for OWASP Top 10 issues: injection, broken auth, insecure data exposure, etc.
4. **Check maintainability** — naming clarity, function size, duplication, dead code.
5. **Check style** — consistency with surrounding code; flag only meaningful deviations.
6. **Summarize findings** — group by severity.

## Output Format

Use the following severity levels:

| Level | Meaning |
|-------|---------|
| 🔴 Critical | Security vulnerability or data loss risk — must fix |
| 🟠 Major | Bug or design flaw that will cause incorrect behavior |
| 🟡 Minor | Code smell, readability issue, or missed best practice |
| 🟢 Suggestion | Optional improvement, not a problem |

```
## Review: <filename or PR title>

### 🔴 Critical
- **Line N** — description + suggested fix

### 🟠 Major
- ...

### 🟡 Minor
- ...

### 🟢 Suggestions
- ...

### Summary
Overall quality: <Good / Needs Work / Significant Issues>
```

## Notes
- Focus on substance over style. Don't nitpick formatting if a linter handles it.
- Always suggest a concrete fix, not just the problem.
- If the code is good, say so clearly.
## Grove Pipeline Contract (after reviewing a PR)

1. Fix real findings on the same branch and push. For findings you disagree
   with, reply to the thread explaining why, then resolve the thread.
2. Once the diff is clean and tests + build pass, post your verdict — the
   body must start with `## AI Code Review` (this marker identifies
   agent-performed reviews and is what the gate and `pr-auto-merge` accept):
   - someone else's PR: `gh pr review <number> --approve --body "## AI Code Review …"`
   - your own PR: GitHub forbids self-approval, so
     `gh pr review <number> --comment --body "## AI Code Review …"`
3. Wait for `pr-auto-merge` — the gate requires that review on the head SHA,
   0 unresolved threads, and a green `PR CI` run. If it doesn't fire within
   ~15 minutes, merge yourself: `gh pr merge <number> --squash --delete-branch`.
4. There is no paid AI review in CI: your review *is* the review the pipeline
   waits for (see AGENTS.md, "Code Review (Agent-Performed, Free)").
