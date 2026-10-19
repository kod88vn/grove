# grove

Grove is a family-focused workspace for household assistance, learning, and coordination. It brings together Nora, a family assistant powered by local Ollama, with apps for homework, educational games, reminders, shopping lists, and developer skills. This Yarn monorepo is managed with Turborepo and uses Next.js apps with the Platformatic service mesh; get started with `yarn install` and `yarn dev` (Nora requires Ollama at `http://grove:11434`).

## Structure

```
grove/
├── apps/
│   ├── games/              # educational games workspace
│   ├── homeworks/          # homework tracker app workspace
│   ├── orchestrator/       # intent, skill, tool, and schema control plane for Nora and future apps
│   ├── reminders/          # reminder and routine app workspace
│   ├── shopping-list/      # shopping-list app workspace
│   └── nora/               # AI-powered chat app (Next.js 16)
├── .github/
│   ├── copilot-instructions.md
│   └── skills -> apps/ai-skill-library/skills
├── .skill-lib/
│   └── project.json        # project metadata
└── .vscode/
    └── mcp.json            # MCP server config
```

## Getting started

```bash
# install dependencies
yarn install

# install git hooks (runs automatically on install via prepare)
yarn prepare

# start Nora (AI house steward) — requires Ollama at http://grove:11434
yarn dev

# start the skill library server
node apps/ai-skill-library/bin/skill-lib.js serve
```

## Project plan

The active homework roadmap is in [HOMEWORK_PLAN.md](HOMEWORK_PLAN.md), and implementation status is tracked in [HOMEWORK_PROGRESS.md](HOMEWORK_PROGRESS.md).

## Utilities

```bash
# kill whatever is listening on one or more ports
yarn killp 3000
yarn killp 3000 4010
```

## Apps

### Nora

AI-powered family chatbot built with Next.js 16, Tailwind CSS, and streaming responses from a local Ollama LLM. See [apps/nora/README.md](apps/nora/README.md).

### Shopping List

Workspace boundary for the Grove shopping-list app. See [apps/shopping-list/README.md](apps/shopping-list/README.md).

### Homeworks

Workspace boundary for the Grove homeworks tracker app. See [apps/homeworks/README.md](apps/homeworks/README.md).

### Reminders

Workspace boundary for the Grove reminders app. See [apps/reminders/README.md](apps/reminders/README.md).

### Orchestrator

Intent-first orchestration service that is being expanded into the control plane for skill selection, tool routing, MCP integration, and schema-enforced structured outputs. Current baseline includes skill-manifest driven planning, `/orchestrate` execution, strict weather and dashboard schema validation routes, typed MCP unavailability refusals, and route-level audit logging. See [apps/orchestrator/README.md](apps/orchestrator/README.md) and [apps/orchestrator/DESIGN.md](apps/orchestrator/DESIGN.md).

## API Token Configuration

**API tokens are now configured in `~/.zshrc` (not `.env.local`).**

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

## Development SMS Test Page

The Grove app now includes a development-only test page for the nightly digest SMS/email-to-text flow:

- path: `/dev/sms-test`
- API proxy: `/dev-api/sms-test`
- orchestrator endpoint: `POST /nightly-digest/test`

This flow is gated to development mode and controlled by `ENABLE_SMS_TEST_PAGE`.

Values are read from `.env.local`, which is loaded automatically by the root `yarn dev` script.

`yarn dev` now starts orchestrator alongside the Next apps, so the SMS test page can reach `POST /nightly-digest/test` without a separate manual orchestrator startup step.

Important: a successful dry-run does not send anything to your phone. Real delivery requires SMTP credentials in `.env.local` such as `DIGEST_SMTP_HOST`, `DIGEST_SMTP_FROM`, and optionally `DIGEST_SMTP_USER`, `DIGEST_SMTP_PASS`, `DIGEST_SMTP_PORT`, `DIGEST_SMTP_SECURE`.

### AI Skill Library

Skill + MCP catalog with a scaffold CLI for creating ready-to-use coding workspaces. See [apps/ai-skill-library/README.md](apps/ai-skill-library/README.md).

## MCP servers

- **Context7 MCP** (`context7`): Retrieves focused library and framework documentation context for coding tasks.
- **Playwright MCP** (`playwright`): Browser automation, page inspection, screenshots, and UI verification for coding workflows.

Configured in `.vscode/mcp.json`. Reload VS Code to activate.

## Skills

Available under [`.github/skills/`](.github/skills/). Copilot will discover them automatically.

## Observability: OpenObserve Logging Stack

Grove runs [OpenObserve](https://openobserve.ai) on the production machine for centralized log collection, search, and dashboards. All apps write to a single `grove_all_logs` stream via Nora's `POST /chat/api/ingest` endpoint.

| Resource | URL |
|----------|-----|
| Dashboard (basic auth) | `http://grove:5081` via Tailscale |
| AI log query API | `GET /chat/api/nora/logs/query?level=error&limit=50` |
| Setup guide | [ops/openobserve/SETUP.md](ops/openobserve/SETUP.md) |
| Technical design | [ops/openobserve/DESIGN.md](ops/openobserve/DESIGN.md) |
| AI troubleshooting skill | [skills/observability/openobserve/SKILL.md](skills/observability/openobserve/SKILL.md) |
| Docker compose | [ops/openobserve/docker-compose.yml](ops/openobserve/docker-compose.yml) |

**Quick start:**
```powershell
cd ops/openobserve && docker compose --env-file .env up -d
# Dashboard at http://grove:5081, user: grove-admin
```

## Runner cleanup (Windows self-hosted)

If your self-hosted Windows runner fails to delete the previous workspace (EPERM locked file errors for native modules like `sharp`), use the PowerShell script below to stop Node, take ownership, and remove the workspace. You can run this manually on the runner host or wire the same steps into a `cleanup-runner` job in your CI workflow.

PowerShell (run elevated):

```powershell
# Stop Node processes that commonly hold native modules
Get-Process node -ErrorAction SilentlyContinue | Stop-Process -Force -ErrorAction SilentlyContinue || $null

# Path to the workspace — adjust if your runner uses a different path
$workspace = 'C:\Users\kod\dev\actions-runner\_work\grove\grove'

if (Test-Path $workspace) {
    takeown /f "$workspace" /r /d y
    icacls "$workspace" /grant Everyone:F /t
    Remove-Item -LiteralPath "$workspace" -Recurse -Force
}
```

Also included in this repo is an example GitHub Actions workflow: `.github/workflows/cleanup-runner-example.yml`. It demonstrates a `cleanup-runner` job that you can integrate into your main workflow by adding `needs: cleanup-runner` to your build jobs.

## AI Skill Reference

The following canonical skills define AI behavior. Each skill has detailed procedures in its own file:

| Skill | Location | Purpose |
|-------|----------|---------|
| **Code Review** | [`skills/coding/code-review/SKILL.md`](skills/coding/code-review/SKILL.md) | PR reviews, bug/security detection, quality checks |
| **Debugging** | [`skills/coding/debugging/SKILL.md`](skills/coding/debugging/SKILL.md) | Bug reproduction, root cause analysis, fix verification |
| **Unit Testing** | [`skills/coding/unit-testing/SKILL.md`](skills/coding/unit-testing/SKILL.md) | Jest/Playwright tests, BDD triage, TDD workflows |
| **CI Monitoring** | [`skills/ci/monitoring/SKILL.md`](skills/ci/monitoring/SKILL.md) | Diagnose CI failures, replicate locally, resolve transient issues |
| **OpenObserve Logging** | [`skills/observability/openobserve/SKILL.md`](skills/observability/openobserve/SKILL.md) | Centralized log query, search, dashboards — AI troubleshooting workflow for production errors
| **Terse Communication** | [`skills/workflow/terse-communication/SKILL.md`](skills/workflow/terse-communication/SKILL.md) | Brief, execution-first responses (default mode) |

When performing any of these activities, follow the procedure in the corresponding skill file.
