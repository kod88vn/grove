# Orchestrator

Intent-first routing service for Nora chat execution and the future control plane for selective skill loading, tool routing, and schema-enforced structured outputs.

## Status

Current implementation is a thin baseline:

- lightweight intent classification
- planner and skill registry for weather, local time, fast chat, reasoning, and factual lookup routes
- deterministic weather JSON route with schema validation
- local tool execution for simple commands
- tool registry abstraction for local, external API, and MCP tool plan execution
- MCP gateway with executable adapter path (injected executor or HTTP endpoint) and typed refusal behavior when unavailable
- structured audit logging to JSONL (`ORCHESTRATOR_AUDIT_LOG`)
- factual lookup plans normalized to executable `mcp_tool:factual_lookup` calls (legacy `tool_family:factual_lookup` still accepted)

Slices 1-4 and 6 baseline are implemented:

- weather requests plan to `structured_data`
- the `weather_widget` skill manifest is loaded from `src/skills/weather_widget.json`
- `/weather` rejects prose or malformed payloads instead of passing them through
- planner metadata is driven by selected skill manifests instead of one global profile
- `/orchestrate` executes tool plans and returns typed failures for unavailable MCP tools
- factual chat routes now produce executable `mcp_tool` plans instead of non-executable tool-family placeholders
- Nora chat client calls `/orchestrate` and injects selected skill instructions into the system prompt
- `/dashboard-data` returns strict `dashboard_v1` structured payloads and rejects prose payloads
- audit events are emitted for `/plan`, `/weather`, and `/orchestrate`
- skill manifests are validated against `src/skills/schema.json` at load time

Planned production architecture is documented in [docs/design/README.md](./docs/design/README.md). That plan replaces the current regex-only routing with a classifier, planner, skill registry, tool registry, response validation, and audit logging.

## Routes

- `GET /health` - service health
- `POST /plan` - returns execution plan for a user message
- `POST /orchestrate` - resolves plan + executes tool plan when requested
- `GET /weather?location=<city,state>` - returns normalized weather JSON from deterministic upstream API (no LLM)
- `GET /dashboard-data` - returns normalized dashboard profile JSON (no prose)

## Plan Routes

- `local_tool` - direct local tool execution, no model reasoning
- `fast_chat` - low-latency conversational response path
- `factual_tool` - tool-backed factual path with verification
- `reasoning` - full reasoning/tool planning path

## Planned Production Additions

- additional MCP adapters and richer capability metadata
- wider structured-data schemas beyond weather
- dashboard-focused orchestrated data routes and contracts
- deeper verification telemetry and SLO dashboards

## MCP Adapter Contract

The orchestrator now supports concrete MCP tool execution in two modes:

- injected executor function via `createServer({ mcpExecutor })`
- HTTP endpoint bridge via `ORCHESTRATOR_MCP_EXECUTE_URL`

When using HTTP mode, the orchestrator sends:

```json
{
	"toolName": "web_search",
	"arguments": { "query": "latest chip news" }
}
```

Expected response shape:

```json
{
	"ok": true,
	"payload": {
		"results": [
			{ "title": "...", "url": "https://..." }
		]
	}
}
```

If no executor or endpoint is configured, the orchestrator returns typed refusal `MCP_TOOL_UNAVAILABLE`.

## Development

```bash
yarn workspace @grove/orchestrator dev
yarn workspace @grove/orchestrator dev:mcp-bridge
yarn workspace @grove/orchestrator dev:bridge-mode
```

`dev:bridge-mode` sets `ORCHESTRATOR_MCP_EXECUTE_URL=http://127.0.0.1:4020/execute` so orchestrator can execute MCP calls through the local bridge.

## Tests

```bash
yarn workspace @grove/orchestrator test
```

The rollout plan in [docs/design/rollout.md](./docs/design/rollout.md) and [docs/design/testing.md](./docs/design/testing.md) defines required new test areas for each implementation slice.

Current direct coverage includes:

- classifier and planner behavior
- local tool execution
- weather route behavior
- weather skill manifest loading
- skill manifest schema validation
- strict weather schema validation
- tool registry and MCP typed failure paths
- orchestrate route typed refusal behavior
- audit logger persistence and event shape
- dashboard-data strict schema validation and route behavior
