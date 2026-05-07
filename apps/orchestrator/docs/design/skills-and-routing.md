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

Routing behavior:

- classifier reads `triggerPatterns` from loaded skill manifests
- each matching pattern contributes to a weighted score per skill
- highest-scoring skill determines route intent metadata
- if no skill matches and prompt is question-like (`who/what/when/where/how`), classifier falls back to `factual_tool` for safer verification

Current baseline skills:

- `weather_widget`
- `dashboard_profile`
- `general_family_chat`
- `planning_reasoning`
- `local_time`
- `search_and_summarize`
- `intent_classifier`

## Tool Strategy

Preferred order for live/factual tasks:

1. local deterministic tool
2. MCP-backed tool
3. external API adapter
4. model prose only when explicitly requested

If structured-data schema cannot be satisfied, return typed refusal/degraded payload. Never fall back to prose.

### Factual Lookup Contract

- planner emits factual requests as `mcp_tool` with `name: factual_lookup`
- `arguments.query` is the user message for the lookup step
- tool registry accepts legacy `tool_family:factual_lookup` plans and normalizes them to the MCP factual lookup contract for backward compatibility

## UI Contracts

- weather widgets consume strict weather JSON
- dashboard cards consume strict dashboard JSON
- prose chat is allowed only for `chat` route
