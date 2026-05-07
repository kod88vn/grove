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

- routing is **model-driven**: `classifyIntentWithModel` calls an injected classifier (default: `createOllamaClassifier`, single JSON call to local Ollama) and normalizes the response to one of `local_tool | reasoning | factual_tool | fast_chat`
- the deterministic `classifyIntent` is a **safe-default only** path used when no classifier is wired or the model call fails — it returns `factual_tool/low` for any non-empty input (research over destructive shortcuts)
- skill `triggerPatterns` are documentation only — they are not consulted by the classifier (kept on manifests so authors can hint intent to the model prompt in future iterations)
- the Ollama classifier is auto-wired in `startServer` whenever `OLLAMA_HOST` is set; tests inject their own stub via `createServer({ intentClassifier })`

Classification cache behavior:

- orchestrator uses a two-level cache in `src/classificationCache.js`:
	- hot in-memory LRU map for fastest repeats in-process
	- persistent SQLite store at `data/classification-cache.sqlite` (or `CLASSIFICATION_CACHE_PATH`)
- cache keys include normalized message + surface + classifier model + prompt version
- non-factual routes (`local_tool`, `reasoning`, `fast_chat`) are cached only when confidence is `high`
- factual route (`factual_tool`) is promoted to persistent cache only after successful tool execution with source evidence (at least one cited URL) and confidence `medium|high`
- factual results are never cached from classifier output alone; they require evidence-backed promotion via `/orchestrate`

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
