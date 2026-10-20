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

AI-powered family chatbot built with Next.js 16, Tailwind CSS, and streaming responses from the local LM Studio LLM server. See [apps/nora/README.md](apps/nora/README.md).

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

# Optional, local development only: enables the opt-in pre-commit AI gate
# (.husky/pre-commit). CI never uses a paid review API — code review is
# performed by the agent itself (see AGENTS.md, "Code Review (Agent-Performed, Free)").
export ANTHROPIC_API_KEY="your-key-here"   # optional; pre-commit hook skips without it
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

**Quick start** (on the host machine — credentials from `~/.grove/host.env` or your shell):
```bash
cd ops/openobserve && docker compose up -d
# Dashboard at http://grove:5081, user: grove-admin
```

## Hosting & Deployment

Grove is hosted on the **`grove` machine** (the Mac on the family tailnet). There is no GitHub self-hosted runner: the repo is public and the free plan cannot use self-hosted runners on public repos. Instead, CI validates on GitHub-hosted runners and a small daemon on the machine does the deploying:

- CI (free): `PR CI` runs tests + builds; the `Deploy grove` workflow tests, then asks the host daemon to deploy the exact commit.
- Host daemon (`ops/deploy/host-daemon.mjs`, kept alive by launchd): receives the webhook (via Tailscale Funnel) or polls GitHub, checks out the commit, builds the Docker image, swaps the live container (`http://grove` on the tailnet), runs health checks, pre-warms the local model, and reports back to GitHub as a commit status.
- Code review + merge: performed by the coding agent (free) — see AGENTS.md, "Code Review (Agent-Performed, Free)". No paid API key is used anywhere in the pipeline.

Setup on the host machine: `bash ops/deploy/install-host.sh` — full details in [ops/deploy/README.md](ops/deploy/README.md).

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
