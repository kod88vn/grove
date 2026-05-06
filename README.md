# grove

Monorepo for the Grove family's AI tools and skill library, managed with Turborepo.

## Structure

```
grove/
├── apps/
│   ├── ai-skill-library/   # skill + MCP catalog with scaffold CLI
│   ├── orchestrator/       # intent, skill, tool, and schema control plane for Nora and future apps
│   └── nora/               # AI-powered house steward (Next.js 16)
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

AI-powered house steward built with Next.js 16, Tailwind CSS, and streaming responses from a local Ollama LLM. See [apps/nora/README.md](apps/nora/README.md).

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
