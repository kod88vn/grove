# CI Monitoring Skill

When working with GitHub Actions CI/CD, follow this skill to diagnose and resolve failures.

## Workflow Overview

The Grove workspace has two CI pipelines:

### PR CI (`.github/workflows/pr-ci.yml`)
- **Trigger**: On pull request opened, synchronized, or reopened.
- **Runs on**: `ubuntu-latest`
- **Jobs**:
  1. `pr-ci` — Detects changed app packages, runs affected tests + builds via `yarn turbo test/build --filter=...`
  2. `pr-review` — Depends on `pr-ci`, auto-approves passing PRs and posts a comment
  3. `pr-auto-merge` — Depends on `pr-review`, auto-merges if no `do-not-merge` label and author is OWNER

### Deploy (`.github/workflows/deploy.yml`)
- **Trigger**: On push to `master` or merged PR.
- **Runs on**: `grove` (custom runner)
- **Jobs**: Tests, builds, Docker image build + tag, container swap, health check.

## Diagnosing CI Failures

### Step 1: Check which check run failed
Use GitHub MCP `get_check_runs` on the PR to identify the failed job.

### Step 2: Replicate locally
```bash
# Detect changed packages (same logic as CI)
BASE_SHA="$(git merge-base HEAD origin/master)"
HEAD_SHA=HEAD
git diff --name-only "$BASE_SHA" "$HEAD_SHA" \
  | grep '^apps/[^/]' | cut -d'/' -f1-2 | sort -u

# Run affected tests
yarn turbo test --filter=@grove/<package>

# Run affected build
yarn turbo build --filter=@grove/<package>

# If filter is empty, run full workspace
yarn turbo test
yarn turbo build
```

### Step 3: Common Failure Modes

#### better-sqlite3 compilation on ubuntu-latest
- The CI `pr-ci.yml` runs `npm rebuild better-sqlite3` before tests.
- If this fails, it's usually missing `node-gyp` build tools on the runner.
- **Fix**: Ensure `@turbo/coderabbit` or CI setup includes `python3`, `make`, `g++`.
- Local workaround: verify tests pass with local SQLite (`yarn turbo test --filter=@grove/homeworks --force`).

#### Transient infrastructure failures
- GitHub-hosted runners are periodically rebuilt; intermittent failures can occur.
- **Fix**: Force-push the branch (or send a trivial commit) to trigger a fresh CI run.
- Example: `git commit --allow-empty -m "ci: retry" && git push origin <branch>`

#### TypeScript errors in build
- Run `yarn turbo build --filter=@grove/<package>` to see the exact TypeScript compilation error.
- Check for missing type annotations, circular imports, or strict mode violations.

#### Test failures
- Run with `--force` to bypass cache: `yarn turbo test --filter=@grove/<package> --force`.
- Check for stale cache entries that may hide real failures.

## When to Manually Merge

Skip auto-merge when:
- The PR has a `do-not-merge` label.
- Tests/build pass locally but CI fails due to known transient infrastructure issues — after confirming the failure is NOT related to the PR changes.
- The author is not the OWNER (auto-merge only runs for OWNER-authored PRs).

## Post-Merge Verification

After merge, the `deploy` workflow runs. Verify:
1. Docker image builds successfully (`docker build -t grove:<sha> .`)
2. Container starts and responds to HTTP health checks
3. If health check fails, check `docker logs grove-live --tail 100`