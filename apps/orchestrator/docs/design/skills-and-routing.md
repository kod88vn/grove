# Skills And Routing

## Request Modes

- `chat`
- `structured_data`
- `local_tool`
- `mcp_tool`
- `reject`

Each execution plan includes:

- `route`
- `intent`
- `surface`
- `skillSet`
- `toolPlan`
- `responseMode`
- `schemaName`
- `verificationPolicy`

## Skill Manifest Model

Required fields:

- `schemaVersion`
- `id`
- `purpose`
- `instructions`
- `triggerPatterns`
- `allowedTools`
- `modelProfile`
- `responseMode`
- `schemaName`
- `verificationPolicy`
- `allowProse`

Validation source:

- `src/skills/schema.json` (JSON Schema, enforced at registry load)

Current baseline skills:

- `weather_widget`
- `dashboard_profile`
- `general_family_chat`
- `planning_reasoning`
- `local_time`
- `search_and_summarize`

## Tool Strategy

Preferred order for live/factual tasks:

1. local deterministic tool
2. MCP-backed tool
3. external API adapter
4. model prose only when explicitly requested

If structured-data schema cannot be satisfied, return typed refusal/degraded payload. Never fall back to prose.

## UI Contracts

- weather widgets consume strict weather JSON
- dashboard cards consume strict dashboard JSON
- prose chat is allowed only for `chat` route
