# grove

Monorepo for the Grove family's AI tools and skill library, managed with Turborepo.

## Structure

```
grove/
├── apps/
│   ├── games/              # educational games workspace
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

### Reminders

Workspace boundary for the Grove reminders app. See [apps/reminders/README.md](apps/reminders/README.md).

### Orchestrator

Intent-first orchestration service that is being expanded into the control plane for skill selection, tool routing, MCP integration, and schema-enforced structured outputs. Current baseline includes skill-manifest driven planning, `/orchestrate` execution, strict weather and dashboard schema validation routes, typed MCP unavailability refusals, and route-level audit logging. See [apps/orchestrator/README.md](apps/orchestrator/README.md) and [apps/orchestrator/DESIGN.md](apps/orchestrator/DESIGN.md).

### AI Skill Library

Skill + MCP catalog with a scaffold CLI for creating ready-to-use coding workspaces. See [apps/ai-skill-library/README.md](apps/ai-skill-library/README.md).

## MCP servers

- **Context7 MCP** (`context7`): Retrieves focused library and framework documentation context for coding tasks.
- **Playwright MCP** (`playwright`): Browser automation, page inspection, screenshots, and UI verification for coding workflows.

Configured in `.vscode/mcp.json`. Reload VS Code to activate.

## Skills

Available under `.github/skills/`. Copilot will discover them automatically.

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
