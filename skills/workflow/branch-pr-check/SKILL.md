# Branch-PR Check Skill

## Purpose

Verify whether the current branch has an open pull request before proceeding with work. This prevents creating duplicate PRs or pushing to stale branches.

## Procedure

When asked to address code review or fix a bug, first verify an open PR exists for the current task:

### Step 1: Get Current Branch Name
```bash
git rev-parse --abbrev-ref HEAD
```

### Step 2: Check for Open PRs

Using GitHub CLI:
```bash
gh pr list --head <branch-name> --state open
```

Or using GitHub API:
```bash
curl -sH "Authorization: Bearer $GITHUB_TOKEN" \
  "https://api.github.com/repos/<owner>/<repo>/pulls?head=<owner>:<branch-name>&state=open"
```

### Step 3: Interpret Results

**If an open PR exists:**
- Record the PR number (e.g., `#123`)
- Record the PR URL
- Proceed with Case B workflow: checkout existing branch and push

**If no open PR exists:**
- Proceed with Case A workflow: create new branch and PR

## Error Handling

- If `gh` CLI is not available, use the GitHub API with a Personal Access Token
- If rate limited, wait or use an authenticated request
- If the branch name contains special characters, quote it properly

## Example Output

```
Found open PR #42: "Fix login bug"
PR URL: https://github.com/kod88vn/grove/pull/42
```

Or:

```
No open PR found for branch `fix/login-bug`.
Proceeding with new PR creation.