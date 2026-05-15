# Architecture

## Goal

The orchestrator is the control plane for Nora and future Grove apps requiring reliable AI-assisted behavior.

It must classify intent first, load only relevant skills, execute deterministic or MCP tools, enforce structured output contracts, and refuse fabrication.

## Current State

Implemented baseline includes:

- intent/classification and planning modules
- skill manifests and selective skill loading
- tool registry and MCP gateway abstraction
- weather and dashboard structured-data schema validation
- orchestration route and strict data routes
- structured audit logging
- nightly digest composer foundation with a free email-to-text delivery helper
- nightly digest worker module with scheduled local-time execution and sender adapter boundary

Current gap:

- broader MCP provider coverage beyond current executor/HTTP bridge path
- broader structured schemas beyond weather + dashboard baseline
- advanced delivery retries, dead-lettering, and multi-channel fanout

## Core Principles

- no giant global system prompt
- no prose for widget/data paths
- deterministic tools before model synthesis for live/factual data
- schema validation before returning structured payloads
- provenance-aware execution and typed refusal behavior

## Execution Pipeline

1. Request arrives
2. `classifier` determines intent/surface
3. `planner` selects skill set, tool plan, schema, verification policy
4. `skillRegistry` resolves selected skill instructions
5. `toolRegistry` executes local, external, or MCP tools
6. `responseValidator` enforces schema/refusal
7. `auditLogger` writes structured request event
8. Response returns typed data, chat plan, or typed refusal

The nightly digest slice reuses the same composition/validation pattern via a separate worker entrypoint and free-first delivery adapter.
