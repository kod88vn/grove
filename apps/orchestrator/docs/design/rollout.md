# Rollout Status

## Slice 1: Weather Skill + Strict Schema

Status: Implemented

- `weather_widget` skill manifest
- planner-selected `structured_data` weather path
- strict `weather_v1` validation
- regression test rejecting prose payloads

## Slice 2: Planner + Registries

Status: Implemented

- `classifier` and `planner`
- `skillRegistry` + `toolRegistry`
- selected-skill prompt-pack loading tests

## Slice 3: MCP Gateway

Status: Implemented baseline

- MCP gateway supports injected executor and HTTP bridge endpoint
- typed refusal remains when unavailable (`MCP_TOOL_UNAVAILABLE`)

## Slice 4: Nora Routed Behind Orchestrator

Status: Implemented baseline

- Nora client calls `/orchestrate`
- selected `skillPromptPack` injected into system prompt

## Slice 5: Dashboard Structured Data

Status: Implemented baseline

- `dashboard_profile` skill + `dashboard_v1` schema
- `GET /dashboard-data` strict schema route

## Slice 6: Audit And Production Controls

Status: Implemented baseline

- structured JSONL audit events for `/plan`, `/weather`, `/orchestrate`, `/dashboard-data`
- advanced metrics/SLO dashboards pending
