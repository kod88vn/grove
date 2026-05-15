# Orchestrator

Intent-first routing service for Nora chat execution and the future control plane for selective skill loading, tool routing, and schema-enforced structured outputs.

## Status

Current implementation is a thin baseline:

- model-driven intent classification (local Ollama classifier with safe deterministic fallback)
- planner and skill registry for weather, local time, fast chat, reasoning, and factual lookup routes
- deterministic weather JSON route with schema validation
- local tool execution for simple commands
- tool registry abstraction for local, external API, and MCP tool plan execution
- MCP gateway with executable adapter path (injected executor or HTTP endpoint) and typed refusal behavior when unavailable
- structured audit logging to JSONL (`ORCHESTRATOR_AUDIT_LOG`)
- factual lookup plans normalized to executable `mcp_tool:factual_lookup` calls (legacy `tool_family:factual_lookup` still accepted)
- nightly digest composer foundation with a free AT&T email-to-text delivery helper
- nightly digest worker with local-time scheduling and pluggable sender adapters (dry-run + webhook)

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
- optional model-assisted second-stage classifier can disambiguate ambiguous chat prompts via the `intent_classifier` skill
- classification cache with in-process LRU hot cache + persistent SQLite backing store

Planned production architecture is documented in [docs/design/README.md](./docs/design/README.md). Routing is model-driven with deterministic safe fallback behavior.

## Routes

- `GET /health` - service health
- `POST /plan` - returns execution plan for a user message
- `POST /orchestrate` - resolves plan + executes tool plan when requested
- `GET /weather?location=<city,state>` - returns normalized weather JSON from deterministic upstream API (no LLM)
- `GET /dashboard-data` - returns normalized dashboard profile JSON (no prose)
- `POST /nightly-digest/test` - development-only nightly digest test send path (dry-run by default)

## Plan Routes

- `local_tool` - direct local tool execution, no model reasoning
- `fast_chat` - low-latency conversational response path
- `factual_tool` - tool-backed factual path with verification
- `reasoning` - full reasoning/tool planning path

## Planned Production Additions

- additional MCP adapters and richer capability metadata
- wider structured-data schemas beyond weather
- dashboard-focused orchestrated data routes and contracts
- nightly digest scheduler/runner, outbound delivery worker, and low-cost message delivery path
- deeper verification telemetry and SLO dashboards

## Model-Assisted Classification

The orchestrator supports model-backed classification for `/plan` and `/orchestrate`.

- classifier is called via `classifyIntentWithModel` and normalized to one of `local_tool | reasoning | factual_tool | fast_chat`
- invalid classifier output is ignored and deterministic safe fallback (`factual_tool/low`) is used
- local Ollama classifier is auto-wired in `startServer` when `OLLAMA_HOST` is set

Configure with `createServer({ intentClassifier })`, where `intentClassifier` is an async function returning:

```json
{
	"route": "factual_tool",
	"intent": "factual",
	"confidence": "medium",
	"reason": "current_event_request"
}
```

## Classification Cache

The orchestrator keeps classification results in a two-tier cache:

- in-memory LRU hot cache for repeat requests in the same process
- persistent SQLite store at `data/classification-cache.sqlite`

Quality gates:

- `local_tool` / `reasoning` / `fast_chat`: cached only when confidence is `high`
- `factual_tool`: cached only after successful orchestration with citation evidence (>= 1 URL source) and confidence `medium` or `high`

Environment knobs:

- `CLASSIFICATION_CACHE_PATH` - override SQLite path
- `CLASSIFICATION_CACHE_LRU_MAX` - max in-memory entries (default `500`)
- `CLASSIFICATION_CACHE_TTL_LOCAL_MS` - TTL for local route (default 180 days)
- `CLASSIFICATION_CACHE_TTL_REASONING_MS` - TTL for reasoning route (default 30 days)
- `CLASSIFICATION_CACHE_TTL_CHAT_MS` - TTL for fast chat route (default 30 days)
- `CLASSIFICATION_CACHE_TTL_FACTUAL_MS` - TTL for factual route (default 7 days)
- `OLLAMA_CLASSIFIER_PROMPT_VERSION` - included in cache key for prompt-version invalidation

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
yarn workspace @grove/orchestrator dev:nightly-digest
```

`dev:bridge-mode` sets `ORCHESTRATOR_MCP_EXECUTE_URL=http://127.0.0.1:4020/execute` so orchestrator can execute MCP calls through the local bridge.

`dev:nightly-digest` starts the scheduled digest worker process. By default it schedules for local `06:30` and waits for the next run.

## Nightly Digest Worker

The worker entrypoint is `src/nightlyDigestWorker.js` and runs the digest job as a scheduled background process.

Environment options:

- `DIGEST_RUN_HOUR_LOCAL` - local 24h run hour (default `6`)
- `DIGEST_RUN_MINUTE_LOCAL` - local run minute (default `30`)
- `DIGEST_RUN_ON_START` - run once immediately on process start (`1`/`true`)
- `DIGEST_PHONE_NUMBER` - destination phone number used for gateway address generation
- `DIGEST_CARRIER` - carrier slug (`att` default)
- `DIGEST_DRY_RUN` - enable no-cost dry-run sender (`1`/`true`)
- `DIGEST_SMTP_HOST` - SMTP host for real email-to-text delivery
- `DIGEST_SMTP_PORT` - SMTP port (default `587`)
- `DIGEST_SMTP_SECURE` - SMTP secure mode (`true` for SMTPS)
- `DIGEST_SMTP_USER` - SMTP username when auth is required
- `DIGEST_SMTP_PASS` - SMTP password or app password when auth is required
- `DIGEST_SMTP_FROM` - From address used for the email-to-text message
- `DIGEST_EMAIL_WEBHOOK_URL` - optional webhook endpoint for real email send
- `DIGEST_EMAIL_WEBHOOK_TOKEN` - optional bearer token for webhook auth

Delivery behavior:

- if `DIGEST_DRY_RUN` is enabled, delivery uses dry-run mode and records a simulated delivery id
- else if `DIGEST_SMTP_HOST` is set, delivery sends through SMTP to the carrier gateway address
- else if `DIGEST_EMAIL_WEBHOOK_URL` is set, delivery POSTs to that webhook with `{to, subject, text, metadata}`
- else the worker fails with a typed configuration error so misconfiguration is visible

Development-only test endpoint behavior:

- `POST /nightly-digest/test` is enabled only when `NODE_ENV !== production` and `ENABLE_SMS_TEST_PAGE !== false`
- endpoint runs the same nightly digest build/send path and returns payload + delivery result JSON
- endpoint defaults to dry-run mode unless request body sets `dryRun: false`

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
