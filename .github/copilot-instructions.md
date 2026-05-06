# GitHub Copilot Instructions

This is a scaffolded AI skill library workspace.

## MCP Servers

The following MCP servers are configured in `.vscode/mcp.json`:

- **Context7 MCP** (`context7`): Retrieves focused library and framework documentation context for coding tasks.
- **Playwright MCP** (`playwright`): Browser automation, page inspection, screenshots, and UI verification for coding workflows.

Prefer these servers for their respective tasks before falling back to general knowledge.

## Default Communication Style

Use the `terse-communication` skill by default in `full` mode for normal responses.

- Lead with the answer, fix, or decision.
- Keep responses concise and execution-focused.
- Expand detail when explicitly requested by the user.
- Temporarily switch to normal clarity for destructive operations, security guidance, or multi-step procedures where order matters.

## Skills

Skills are exposed in `.github/skills/` and sourced from `apps/ai-skill-library/skills/`.

## Skill Update Workflow

When asked to update skills, always treat `apps/ai-skill-library` as the canonical skill library and apply edits there first.

- Source of truth for skill content: `apps/ai-skill-library/skills/`
- Discovery path for Copilot: `.github/skills/` (linked to the library skills folder)
- If a skill update is requested, inspect existing skills in the library, then modify the matching skill files under `apps/ai-skill-library/skills/`.
- Prefer reusing existing workflow skills before creating new ones.
