# AI Agents Overview

This document defines the roles and responsibilities of AI agents working within the Grove workspace.

## Core Directives

1. **Verify via Build**: Always run a full production build (`npx next build` or equivalent) after completing a task to catch syntax errors, type mismatches, or layout breakage that unit tests might miss.
2. **Test-First Triage (BDD)**: Follow BDD-style triage. Reproduce bugs in failing tests before fixing. See [BDD Bug Reproduction Policy](#bdd-bug-reproduction-policy) below.
3. **Keep Nora Thin**: Avoid bloating `apps/nora`. Place major capabilities in sibling apps and keep Nora as a thin consumer.
4. **Permanent Logs**: Maintain an audit log for non-deterministic bugs (gitignored).
5. **No Silent Failures**: Never suppress errors, return empty fallbacks, or mask failures with default values. Surface problems clearly so they get fixed at the source.
6. **No Direct Pushes to Master**: Never push directly to `master`. All changes MUST go through pull requests. See [Push Safety Policy](#push-safety-policy) below.
7. **A Loop Ends at Merge, One Loop at a Time**: A task is not done until its PR is merged. Keep checking the PR and resolving feedback until then, and do not start another task meanwhile. See [Loop Engineering](#loop-engineering-non-negotiable) below.

## Loop Engineering (Non-Negotiable)

A **loop** is one task carried from branch to merged PR. Pushing a branch or opening a PR is the middle of the loop, not the end.

**The loop finishes when the PR is merged.** Deployment verification is not part of the loop. Until the merge, the task is open, whatever the code looks like.

**Keep checking the PR.** After every push, and again whenever you return to the task, read the PR's live state rather than assuming it:

```bash
gh pr view <n> -R kod88vn/grove \
  --json state,mergeable,mergeStateStatus,headRefOid,reviewDecision,statusCheckRollup
gh pr view <n> -R kod88vn/grove --comments            # conversation comments
gh api repos/kod88vn/grove/pulls/<n>/comments         # inline review comments
```

Act on what it says, on the same branch (Branch Workflow Case B):

| PR state | Next move |
| --- | --- |
| A check failed | Read the failing job's log, reproduce locally, fix, push. See [CI Monitoring](skills/ci/monitoring/SKILL.md). |
| Checks pending | Wait, then check again. Pending is not passing. |
| Review comments or `CHANGES_REQUESTED` | Address every comment: fix it, or reply with the reason it should not change. Resolve the thread and re-request review. See [GitHub PR Review](skills/coding/github-pr-review/SKILL.md). |
| Merge conflict / `BEHIND` | Merge latest `master` into the branch (no force push), re-run tests, push. Also do this when the AI review flags code that only differs because `master` moved. |
| Green, bot-approved, 0 unresolved threads | `pr-auto-merge` merges it via [`merge-gate.mjs`](.github/scripts/merge-gate.mjs). If the gate refuses, its log says why; fix that. The loop is finished once `state` is `MERGED`. |
| Closed without merge | Stop and ask the owner. Do not reopen or recreate it on your own. |

Check that `headRefOid` equals your local `git rev-parse HEAD` before trusting any check result; a green check on an older commit proves nothing about the current one.

**Work on one thing at a time.**
- Exactly one open loop per agent. Do not start a new task, branch or PR until the current PR is merged or the owner explicitly parks it.
- One PR = one concern. Do not fold unrelated fixes into an open PR; note them and do them as the next loop.
- When reporting, say where the loop stands ("PR #n: waiting on review", "PR #n: CI failing on `build`"). Never report "done" for a PR that is not merged.

## Push Safety Policy (Non-Negotiable)

AI agents MUST NEVER push directly to `master`. All code changes go through pull requests.

**Why**: Direct pushes bypass:
- The pre-push hook (local guard) that runs affected tests + builds before `git push`
- The CI/CD pipeline ([`.github/workflows/deploy.yml`](.github/workflows/deploy.yml)) that validates tests, builds, Docker image, and health checks

**Required workflow:**
1. **Create a feature branch**: `git checkout -b fix/<short-description>` (or `ai/pr-<number>`)
2. **Make changes, commit, and push the branch**: `git push origin <branch-name>`
3. **Create a pull request** targeting `master` via GitHub (via the API or web UI)
4. **CI must pass** — tests + build on affected packages, Docker build + health check
5. **Merge the PR** — only then is `master` updated with verified code. A merged PR finishes the task.

**Pre-push hook**: The `.husky/pre-push` hook ([`.husky/pre-push`](.husky/pre-push)) automatically runs affected tests + builds before every push. If any test or build fails, the push is rejected with a clear error message.

**Developer/agent responsibility**: Always use `git push origin <branch-name>` instead of `git push origin master`. The pre-push hook will catch broken code before it ever reaches the remote.

## Branch Workflow (Non-Negotiable)

**First, check whether an open PR already exists for the current task.**

See [Branch-PR Check Skill](#branch-pr-check-skill) for detailed procedure.

### Case A — No open PR (new task)
1. **Fetch and rebase onto latest master**: `git fetch origin master && git checkout master && git rebase origin/master`
2. **Create a fresh branch**: `git checkout -b fix/<short-description>` (or `ci/<description>`, `feat/<description>`)
3. **Push the branch and open a PR** targeting `master`.

This prevents merge conflicts caused by stale branches based on outdated master state. Always start from the latest master, not from an old branch tip or another feature branch.

### Case B — Open PR already exists (fixing a broken PR or addressing code review)
1. **Run Branch-PR Check** — Use the [Branch-PR Check Skill](#branch-pr-check-skill) to verify the open PR is still active
2. **Check out the existing branch**: `git checkout <existing-branch>`
3. **Rebase onto latest master if needed**: `git fetch origin master && git rebase origin/master`
4. **Commit the fix/changes and push**: `git push origin <existing-branch>`

The open PR auto-updates — do NOT create a new branch or a new PR. Creating a new PR for a fix that belongs to an existing one fragments review history and leaves the original PR dangling.

**Important**: If the Branch-PR Check finds no open PR, switch to Case A workflow instead.

## BDD Bug Reproduction Policy (Non-Negotiable)

When ANY bug, regression, or unexpected behavior is reported:

1. **Write a failing test FIRST** — Before any code change, write a test that reproduces the bug. The test MUST fail initially (proving it actually catches the issue).
2. **Fix the code** — Make the minimal change to make the failing test pass.
3. **Verify all tests pass** — Run the full test suite to ensure no regressions.
4. **Run full build** — `npx next build` to catch any build-time issues.

**Rules:**
- DO NOT fix a bug without a failing test first (unless it's a UI-only change with no logic).
- DO NOT skip the failing-first step. If your test passes immediately, it's not a valid reproduction.
- DO NOT patch symptoms. Find and fix the root cause.
- For UI bugs without logic: document reproduction steps in a comment next to the relevant component, then fix.
- For non-deterministic bugs (race conditions, flaky tests): log to a gitignored audit file AND add targeted guards.
- Always remember to update tests before implementing a change

**Reference**: See also [`skills/coding/debugging/SKILL.md`](skills/coding/debugging/SKILL.md) and [`skills/coding/unit-testing/SKILL.md`](skills/coding/unit-testing/SKILL.md).

## Post-Deploy Verification (On Request)

After any PR is merged to `master`, the [`deploy.yml`](.github/workflows/deploy.yml) workflow triggers automatically. Verifying it is **not required to finish a task** — a merged PR finishes the loop. Run this only when the owner asks or a deploy failure is suspected:

1. **Check deploy workflow status** — Use GitHub MCP `get_commit` to see if the "deploy" check run passed
2. **Verify Nora container health** — Check `docker logs grove-live --tail 50` for errors
3. **Verify OpenObserve logging stack** — Check `docker compose --env-file ops/openobserve/.env ps` for both containers running
4. **Confirm changes are live** — Navigate to the relevant route and verify the change is visible

See [`skills/ci/post-deploy-verification/SKILL.md`](skills/ci/post-deploy-verification/SKILL.md) for the full procedure, output format, and rollback steps.

## AI Skill Reference

The following canonical skills define AI behavior. Each skill has detailed procedures in its own file:

| Skill | Location | Purpose |
|-------|----------|---------|
| **Code Review** | [`skills/coding/code-review/SKILL.md`](skills/coding/code-review/SKILL.md) | PR reviews, bug/security detection, quality checks |
| **Debugging** | [`skills/coding/debugging/SKILL.md`](skills/coding/debugging/SKILL.md) | Bug reproduction, root cause analysis, fix verification |
| **Unit Testing** | [`skills/coding/unit-testing/SKILL.md`](skills/coding/unit-testing/SKILL.md) | Jest/Playwright tests, BDD triage, TDD workflows |
| **Component Architecture** | [`skills/coding/component-architecture/SKILL.md`](skills/coding/component-architecture/SKILL.md) | React/Next.js component design and boundaries |
| **CI Monitoring** | [`skills/ci/monitoring/SKILL.md`](skills/ci/monitoring/SKILL.md) | Diagnose CI failures, replicate locally, resolve transient issues |
| **Post-Deploy Verification** | [`skills/ci/post-deploy-verification/SKILL.md`](skills/ci/post-deploy-verification/SKILL.md) | Verify deploy success after merge — check workflow status, container health, confirm changes are live |
| **OpenObserve Logging** | [`skills/observability/openobserve/SKILL.md`](skills/observability/openobserve/SKILL.md) | Centralized log query, search, dashboards — AI troubleshooting workflow for production errors |
| **Branch-PR Check** | [`skills/workflow/branch-pr-check/SKILL.md`](skills/workflow/branch-pr-check/SKILL.md) | Verify current branch has open PR before proceeding |
| **GitHub PR Review** | [`skills/coding/github-pr-review/SKILL.md`](skills/coding/github-pr-review/SKILL.md) | Automated PR review workflow — find open PRs, fix change requests, resubmit |
| **Terse Communication** | [`skills/workflow/terse-communication/SKILL.md`](skills/workflow/terse-communication/SKILL.md) | Brief, execution-first responses (default mode) |

When performing any of these activities, follow the procedure in the corresponding skill file.

## Naming Convention: Always Use "Nora"

**Refer to the AI assistant as "Nora", never as "AI" in user-facing text.**

- In game apps (e.g., `apps/games`), replace strings like "AI plays", "AI wins" with "Nora plays", "Nora wins".
- Internal code variable/function names (e.g., `aiSymbol`, `aiThinking`) may remain as-is for backward compatibility, but user-facing labels and messages must say "Nora".
- This rule applies to all apps except Nora itself where "Nora" is already the name.

## Ollama / AI Access Pattern

**Only Nora may call Ollama directly.** All other apps must call Nora's API routes.

- Ollama runs at `http://grove:11434` inside the Platformatic mesh and is only reachable from Nora's server-side code.
- Local/dev access to `http://grove:11434` depends on Tailscale connectivity; if Tailscale is disconnected, fail fast and restore connectivity.
- Do not implement or attempt localhost Ollama fallbacks (for example `http://localhost:11434`) in Nora routes or helpers.
- When a sibling app (e.g. `homeworks`, `games`) needs AI generation or grading, it POSTs to a Nora API route (e.g. `/api/nora-homework/exercise`).
- Nora routes follow the pattern in `apps/nora/app/api/nora-crossword/route.js`: import `callOllama` and `DEFAULT_MODEL` from `@/app/api/chat/lib/`, then return `Response.json(...)`.
- Sibling apps reach Nora via `process.env.PLT_NORA_URL` (default `http://localhost:3001` for local dev; resolved automatically in the Platformatic mesh in production).
- **Never** add `OLLAMA_HOST`, `OLLAMA_BASE_URL`, or direct `http://grove:11434` fetch calls to any app other than Nora.

## Prompt Failure Handling Policy

- For content generation failures (for example empty/invalid model output), fix the prompt contract and request parameters first.
- Add diagnostics (logs, traces, targeted tests) to identify why the model response failed.
- Do **not** implement fallback content or fallback response paths that mask model errors.
- Do **not** silently accept generation failure and substitute canned output.
- Retries are allowed, but final failure should surface clearly so prompt/model issues are corrected at the source.

## API Token Configuration

**API tokens are configured in `~/.zshrc` (not `.env.local`).**

### Required Tokens

Add these to your `~/.zshrc` file:

```bash
# GitHub Personal Access Token (for API access)
export GITHUB_PERSONAL_ACCESS_TOKEN="your-token-here"

# Anthropic API Key (for Claude models)
export ANTHROPIC_API_KEY="your-key-here"
```

After updating `.zshrc`, reload your shell or run:
```bash
source ~/.zshrc
```

### Old Configuration (removed from .env.local)

The following variables are no longer used in `.env.local`:
- `GITHUB_TOKEN` (replaced by `GITHUB_PERSONAL_ACCESS_TOKEN`)
- `ANTHROPIC_API_KEY` (moved to `.zshrc`)

Note: Other app-specific environment variables (e.g., SMTP settings for the nightly digest) may still be configured in `.env.local`.

## Workspace Standards

- **Linkification**: When mentioning files in chat, always use markdown links: `[path/to/file.ts](path/to/file.ts)`.
- **Documentation**: Update `DESIGN.md` and `README.md` immediately after any structural or capability change.

## No Integration Tests for SQLite/DB

**DO NOT write integration tests that test SQLite/Database layer code.** Integration tests for `lib/db/*` files (like `chats.test.js`, `messages.test.js`) are forbidden — they depend on native module compilation (`better-sqlite3`), race conditions with file locks, and environment-specific behavior that makes them unreliable in CI.

The SQLite layer is a well-tested library boundary. Unit tests for app logic (API routes, hooks, components) are sufficient coverage. Do not add new `.test.js` files under `lib/db/`.

## Side-by-Side Testing Rule

**Test files MUST live side by side with the production code they test, never in a separate `test/` directory.**

- Naming convention: `<module>.test.js` next to `<module>.js`, or `<module>.spec.js` for spec-style tests.
- For Next.js pages/routes: `app/page.js` → `app/page.test.js`, `app/api/foo/route.js` → `app/api/foo/route.test.js`.
- For Next.js components: `components/Header.js` → `components/Header.test.js`.
- For lib utilities: `lib/utils/foo.js` → `lib/utils/foo.test.js`.
- **Exception**: Do NOT write tests for SQLite/DB layer code (`lib/db/*`) — see "No Integration Tests for SQLite/DB" above.
- **No `test/`, `__tests__/`, or any other flat test directory is allowed.**
- Jest/Node test runners must be configured to discover `**/*.test.js` and `**/*.spec.js` files recursively within their app directories.
- When creating a new production file, create its test file alongside it immediately.

## Routing Contract (Critical)

Grove routing is layered. Do not treat app-local routes as globally reachable unless they are wired through the gateway/dev shell.

- `apps/homeworks` has `basePath: /homeworks`; its `app/library/page.js` resolves to `/homeworks/library` at the app level.
- Public top-level paths in production are controlled by `apps/gateway/platformatic.json` proxies.
- Public top-level paths in local dev (`yarn dev`) are controlled by `apps/grove/next.config.js` rewrites.
- For any new top-level route alias (example: `/library`), update both:
	- Gateway proxy mapping (`apps/gateway/platformatic.json`)
	- Grove dev rewrites (`apps/grove/next.config.js`)
- Within a single Next.js app, use `next/link` for internal navigation so `basePath` and client routing are handled correctly. Cross-app navigation through the gateway may use a normal `<a href>`.

## Homeworks App — Enterprise-Grade Standards (Non-Negotiable)

The `apps/homeworks` app is a production-grade data persistence system. All changes MUST follow these rules:

### Data Persistence (SQLite Only)
- **All homework submissions and reading sessions are stored in SQLite** via [`apps/homeworks/lib/db.js`](apps/homeworks/lib/db.js).
- The database file is at `apps/homeworks/data/homeworks.db` (gitignored).
- **Never use file-based JSON, in-memory Maps, or any other ad-hoc storage** for homework data.
- Use `better-sqlite3` with prepared statements, WAL mode, and foreign keys enabled.
- All API routes (grade, reading-history, review) MUST use the SQLite layer in `lib/db.js` and `lib/progress.js`.

### Public Access (No Auth)
- All homework data is **public**. No authentication or authorization is needed.
- The review page at `/homeworks/review` shows all submissions from the last 30 days.
- Every submission stores `student_id = 'public'`.

### Required Data Model
- **`submissions` table**: id, student_id, subject (math/english), type (reading/writing/problem-set), exercise_json, answers_json, score, max_score, percentage, feedback, details_json, created_at.
- **`readings` table**: id, student_id, passage, questions_json, lesson_key_point, domain, score, max_score, percentage, created_at.
- Both tables have indexes on `(student_id, created_at DESC)` and `created_at`.

### API Contract
- `POST /homeworks/api/grade` — Grade a submission, saves to SQLite.
- `POST /homeworks/api/reading-history` — Save a reading session to SQLite.
- `GET /homeworks/api/review?day=YYYY-MM-DD` — Get submissions + readings for a day (or last 30 days grouped).

### UI Guidelines
- **Keep it simple.** The review page is the primary interface for reviewing daily submissions.
- Remove unnecessary complexity from data persistence and review state. The SkillsLibrary is a supported feature at `/library`; do not couple it to submission persistence.
- Components should be clean, readable, and focused on displaying data (exercises, answers, scores).

### Testing & Build
- All changes to `lib/db.js` and `lib/progress.js` MUST include tests in side-by-side `.test.js` files.
- Run `npx next build` after any change to catch SQLite initialization or schema issues.

### AGENTS.md Enforcement
- Every AI agent working on homeworks MUST read this section before making changes.
- If a change would introduce file-based JSON or in-memory storage for homework data, reject it immediately.
- If a change adds auth complexity to the review page, reject it — data is public by design.
