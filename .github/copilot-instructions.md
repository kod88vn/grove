# GitHub Copilot Instructions

This is the Grove monorepo — a multi-app AI-powered workspace built on Next.js and Platformatic.

## MCP Servers

The following MCP servers are configured in `.vscode/mcp.json`:

- **Context7 MCP** (`context7`): Retrieves focused library and framework documentation for coding tasks.
- **Playwright MCP** (`playwright`): Browser automation, page inspection, screenshots, and UI verification.
- **GitHub MCP** (`github`): PRs, issues, code search, and repository operations on `kod88vn/grove`.
- **Git MCP** (`git`): Git operations (status, diff, log, commit).
- **Browser Tools MCP** (`browser-tools-mcp`): Browser console logs, network inspection, and debugging.
- **Sequential Thinking** (`sequentialthinking`): Chain-of-thought reasoning for complex problems.

Prefer these servers for their respective tasks before falling back to general knowledge.

## Skills

Skills are the source of truth for AI agent behavior in this workspace.

- **Canonical location**: `skills/<category>/<name>/SKILL.md`
- **Discovery path**: `.github/skills/` → symlink to `skills/`

### Available Skills

| Category | Skill | When to Use |
|----------|-------|-------------|
| coding | `code-review` | Review PRs, audit files, check for bugs, improve code quality |
| coding | `debugging` | Reproduce bugs, read logs, find root cause, verify fixes |
| coding | `unit-testing` | Write tests, fix failing tests, TDD workflows (Jest/Playwright) |
| coding | `component-architecture` | Design React/Next.js components, refactor UI, evaluate boundaries |
| ci | `monitoring` | Diagnose CI failures, replicate locally, resolve transient issues |
| ci | `post-deploy-verification` | Verify deploy success after merge — check workflow status, container health, confirm changes are live |
| workflow | `terse-communication` | Brief, execution-first responses (default mode) |

### Skill Update Workflow

When asked to update skills:
- Edit `skills/<category>/<name>/SKILL.md` directly — this is the canonical source.
- `.github/skills/` is a symlink and should not be edited manually.
- Prefer reusing existing skills before creating new ones.

## Default Communication Style

Use the `terse-communication` skill by default in `full` mode:
- Lead with the answer, fix, or decision.
- Keep responses concise and execution-focused.
- Expand detail when explicitly requested.
- Temporarily switch to normal clarity for destructive operations, security guidance, or multi-step procedures.

## Workspace Standards (from AGENTS.md)

1. **Verify via Build**: Run `npx next build` after completing tasks to catch syntax/type/layout errors.
2. **Test-First Triage (BDD)**: Follow BDD-style triage — reproduce bugs in failing tests before fixing. See [BDD Bug Reproduction Policy](../AGENTS.md#bdd-bug-reproduction-policy) below.
3. **Keep Nora Thin**: Avoid bloating `apps/nora`. Place major capabilities in sibling apps.
4. **Permanent Logs**: Maintain an audit log for non-deterministic bugs (gitignored).
5. **No Silent Failures**: Never suppress errors, return empty fallbacks, or mask failures with default values.
6. **No Direct Pushes to Master**: Never push directly to `master`. All changes go through pull requests. See [Push Safety Policy](../AGENTS.md#push-safety-policy) below.

## Push Safety Policy (Non-Negotiable)

AI agents MUST NEVER push directly to `master`. All code changes go through pull requests.

**Required workflow:**
1. **Create a feature branch**: `git checkout -b fix/<short-description>` (or `ai/pr-<number>`)
2. **Make changes, commit, and push the branch**: `git push origin <branch-name>`
3. **Create a pull request** targeting `master` via GitHub (via the API or web UI)
4. **CI must pass** — tests + build on affected packages, Docker build + health check
5. **Merge the PR** — only then is `master` updated with verified code

The pre-push hook ([`.husky/pre-push`](.husky/pre-push)) runs affected tests + builds before every push. If any test or build fails, the push is rejected.

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

**Reference**: See also [`skills/coding/debugging/SKILL.md`](../skills/coding/debugging/SKILL.md) and [`skills/coding/unit-testing/SKILL.md`](../skills/coding/unit-testing/SKILL.md).

## Post-Deploy Verification (Non-Negotiable)

After any PR is merged to `master`, the [`deploy.yml`](.github/workflows/deploy.yml) workflow triggers automatically. Before closing the task, verify the deployment succeeded:

1. **Check deploy workflow status** — Use GitHub MCP `get_commit` to see if the "deploy" check run passed
2. **Verify container health** — Check `docker logs grove-live --tail 50` for errors
3. **Confirm changes are live** — Navigate to the relevant route and verify the change is visible

See [`skills/ci/post-deploy-verification/SKILL.md`](../skills/ci/post-deploy-verification/SKILL.md) for the full procedure, output format, and rollback steps.

## Ollama / AI Access Pattern

**Only Nora may call Ollama directly.** All other apps must call Nora's API routes.

- Ollama runs at `http://grove:11434` inside the Platformatic mesh.
- Sibling apps (homeworks, games) POST to Nora API routes (e.g., `/api/nora-homework/exercise`).
- **Never** add `OLLAMA_HOST` or direct Ollama fetch calls to apps other than Nora.

## Prompt Failure Handling

- For content generation failures, fix the prompt contract and request parameters first.
- Add diagnostics (logs, traces, tests) to identify why the model response failed.
- **Do not** implement fallback content that masks model errors.


## Side-by-Side Testing Rule

Test files MUST live side by side with the production code they test, never in a separate `test/` directory.

- Naming convention: `<module>.test.js` next to `<module>.js`, or `<module>.spec.js` for spec-style tests.
- **No `test/`, `__tests__/`, or any other flat test directory is allowed.**

## Repository Defaults

- Default GitHub context: Owner `kod88vn`, Repo `grove`.
- When a user asks for PR/check/build status without specifying repo, assume `kod88vn/grove`.

## Build-Fix Workflow

- If asked to "fix build", first query GitHub MCP for relevant PR/commit status checks.
- Use failing check logs to scope the fix before making code changes.
- If no PR is provided, inspect the most recently updated open PR; if none exist, ask for a branch/commit.

## Cline Bridge

This workspace supports both GitHub Copilot and Cline AI agents. See [.github/CLINE-BRIDGE.md](../.github/CLINE-BRIDGE.md) for details on how MCP configuration is shared between both agents.

- Copilot reads `.vscode/mcp.json` (CDN-based `npx` installs)
- Cline reads `.vscode/cline_mcp_settings.json` (absolute paths to pre-installed servers)
- Shared servers are defined in `.vscode/mcp-shared.json` (canonical source)
- Run `node .vscode/sync-cline-mcp.js` after editing shared config to regenerate Cline settings