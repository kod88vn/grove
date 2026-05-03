# virtual-tutor

This project was scaffolded by `create-turborepo` from the [ai-skill-library](https://github.com/kod/my-recipes).

## Structure

```
virtual-tutor/
├── apps/
│   ├── ai-skill-library/   # skill server (copied from source repo)
│   └── virtual-tutor/         # consumer app
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
# start the skill server
node apps/ai-skill-library/bin/skill-lib.js serve

# in another terminal, start the consumer app
npm --prefix apps/virtual-tutor run dev
```

## MCP servers

- **Context7 MCP** (`context7`): Retrieves focused library and framework documentation context for coding tasks.
- **Playwright MCP** (`playwright`): Browser automation, page inspection, screenshots, and UI verification for coding workflows.

Configured in `.vscode/mcp.json`. Reload VS Code to activate.

## Skills

Available under `.github/skills/`. Copilot will discover them automatically.
