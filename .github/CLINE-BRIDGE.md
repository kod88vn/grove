# Copilot ↔ Cline Bridge

This document explains how GitHub Copilot and Cline share MCP configuration in the Grove workspace.

## Architecture

```
┌─────────────────────────────────────────────────────┐
│                  .vscode/mcp.json                   │
│  (Copilot source of truth - uses npx/CDN installs) │
└──────────────────────┬──────────────────────────────┘
                       │ defines shared servers
                       ▼
┌─────────────────────────────────────────────────────┐
│              .vscode/mcp-shared.json                │
│ (Shared server definitions using portable commands)  │
└──────────┬───────────────────────┬──────────────────┘
           │                       │
           ▼ (sync script)         ▲
┌─────────────────────────┐       │
│ .vscode/cline_mcp_      │       │ edit this file to add/remove
│ settings.json           │◄──────┘  shared servers; Copilot reads
│ (generated, gitignored) │  sync   mcp-shared.json directly.
└─────────────────────────┘
```

## Files

| File | Purpose | Who reads it |
|------|---------|-------------|
| `.vscode/mcp.json` | Copilot's MCP config (uses `npx` CDN installs) | GitHub Copilot |
| `.vscode/mcp-shared.json` | Shared MCP server definitions using portable `npx`, `uvx`, and Docker commands | Sync script → Cline |
| `.vscode/cline_mcp_settings.json` | Generated Cline settings (auto-generated, gitignored) | Cline |
| `.vscode/sync-cline-mcp.js` | Sync script that converts shared → Cline format | Developer |
| `.github/copilot-instructions.md` | Copilot behavioral instructions, skills workflow | GitHub Copilot |

## Shared Servers (in mcp-shared.json)

| Server | Purpose |
|--------|---------|
| `context7` | Focused library/framework documentation |
| `github` | GitHub API (PRs, issues, code search) |
| `playwright` | Browser automation & UI testing |
| `git` | Git operations (status, diff, log) |
| `sequentialthinking` | Chain-of-thought reasoning tool |

## Workflow: Adding a Shared Server

1. Edit `.vscode/mcp-shared.json` to add the new server entry
2. Run `node .vscode/sync-cline-mcp.js` to regenerate Cline settings
3. Commit `.vscode/mcp-shared.json`; the generated Cline settings are gitignored

## Workflow: Adding a Cline-Only Server

1. Edit `.vscode/sync-cline-mcp.js` and add the server to `CLINE_ONLY_SERVERS`
2. Run `node .vscode/sync-cline-mcp.js` to regenerate Cline settings
3. Commit the sync-script change; the generated Cline settings are gitignored

## Sync Script

```bash
# Generate Cline settings from shared config
node .vscode/sync-cline-mcp.js

# Preview without writing
node .vscode/sync-cline-mcp.js --dry-run
```

## Manual Cline Setup (one-time)

If you prefer not to use the sync script, copy the generated settings:

```bash
# Copy generated Cline settings to Cline's global storage
cp .vscode/cline_mcp_settings.json \
   ~/Library/Application\ Support/Code/User/globalStorage/saoudrizwan.claude-dev/settings/cline_mcp_settings.json
```

Or paste the `mcpServers` object from `.vscode/cline_mcp_settings.json` into Cline's MCP configuration UI.

## Notes

- `.vscode/mcp-shared.json` is tracked in git; `.vscode/cline_mcp_settings.json` is gitignored
- Copilot reads `.vscode/mcp.json` (CDN-based `npx` installs)
- Cline reads `.vscode/cline_mcp_settings.json` (generated from portable command-based server definitions)
- The sync script maps server names from `mcp-shared.json` to Cline's `mcp-*` naming convention
- Always run the sync script after editing `.vscode/mcp-shared.json`