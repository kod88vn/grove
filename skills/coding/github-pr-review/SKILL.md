# GitHub PR Review Workflow

## Purpose

Automated code review workflow for when Nora is already working on a specific PR. It looks at the latest change request on that PR, fixes the issue, and resubmits for review.

## When to Use

Use this skill when:
- Nora is working on a specific PR and needs to address the latest change request
- A reviewer has left new feedback on an active PR
- The most recent comment/request needs to be addressed before merge

## Procedure

### Step 1: Identify the PR Branch

Nora is already working on a feature branch. Get the current branch name:
```bash
git rev-parse --abbrev-ref HEAD
```

### Step 2: Find the PR Number for This Branch

```bash
gh pr list --head <branch-name> --state open --json number --jq '.[0].number'
```

### Step 3: Get the Latest Change Request

Get reviews sorted by newest first, take only the latest:
```bash
gh pr review <pr-number> --json body,author,state,createdAt --jq 'sort_by(.createdAt) | last'
```

Get the latest comment on the PR:
```bash
gh pr comments <pr-number> --json author,createdAt,body --jq 'sort_by(.createdAt) | last'
```

### Step 4: Analyze ONLY the Latest Change Request

Parse the most recent feedback:
- What specific issue was raised?
- Which file/line was commented on?
- What fix does the reviewer suggest?

### Step 5: Fix ONLY This Issue

Address ONLY the latest change request:

1. **Read relevant code** — examine the file/line mentioned
2. **Make minimal fix** — address only what was requested
3. **Run tests** — ensure no regressions (`npm test`)
4. **Run build** — verify compilation if applicable (`npx next build`)

### Step 6: Commit and Push

Commit with the PR reference:
```bash
git add <changed-files>
git commit -m "Address latest review feedback on PR #<number>"
git push origin <branch-name>
```

## Output Format

```
## GitHub PR Review Summary

### PR Details
| Field | Value |
|-------|-------|
| Branch | <branch-name> |
| PR # | <pr-number> |

### Latest Change Request
- Comment by @reviewer at <timestamp>
- File: <filename> (line <N>)
- Issue: <description>

### Fix Applied
- <specific change made>

### Result
✅ Changes pushed to branch `<branch-name>`
- [ ] Awaiting reviewer approval
```

## Required Tools

1. **GitHub CLI (`gh`)** — to fetch PR details and reviews
2. **code-review** — to analyze the specific code change needed
3. **build verification** — run `npx next build` after fixes

## Error Handling

| Error | Response |
|-------|----------|
| No active PR found for branch | Report: "No open PR found for this branch" |
| `gh` CLI not installed | Use GitHub API with PAT instead |
| Rate limited | Wait 60 seconds, retry |
| No new change requests found | Report: "No active change requests on this PR" |
| Changes fail tests | Run tests locally, fix before pushing |

## Example

```
Nora is working on branch: feature/login
1. Find PR number:
   gh pr list --head feature/login --state open
   Result: #42

2. Get latest review:
   gh pr review 42 --json body,author,state,createdAt
   Latest: @bob requested changes "Change button text to 'Sign In'"

3. Read code at apps/login/components/SignInButton.js

4. Fix the button text and verify tests pass

5. Push changes:
   git commit -m "Address latest review feedback on PR #42"
   git push origin feature/login