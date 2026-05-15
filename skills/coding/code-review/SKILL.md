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