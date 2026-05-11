# Homework Generation Strategy

## Scope

This document defines how Nora serves homework generation for sibling apps through:

- `POST /chat/api/nora-homework/exercise`
- `POST /chat/api/nora-homework/grade`

It focuses on reliable exercise generation with Ollama for Grade 5 English and Math workloads.

## Architecture Contract

- Only Nora talks directly to Ollama.
- Sibling apps (for example `apps/homeworks`) call Nora via `PLT_NORA_URL`.
- Ollama host is configured by `OLLAMA_HOST` (default `http://grove:11434`).
- Local/dev connectivity to `grove:11434` depends on Tailscale.

## Generation Strategy

### 1) Split English Reading Into Two Calls

English reading is generated in two model passes to reduce failure probability and token pressure:

1. Generate passage JSON.
2. Generate question JSON using the generated passage.

This avoids large, mixed-shape responses in one completion.

### 1b) Rotate Passage Topics

Nora builds multiple randomized profile candidates across criteria, including:

- theme
- domain/subject
- tone
- style/form
- setting
- narrative perspective
- opening hook

Nora then selects the highest-coherence profile in-process (rule-scored) before passage generation.

Selected profile signatures are tracked in a short in-memory history window to avoid immediate repeats.

This reduces repeated passages across consecutive requests and keeps reading prompts fresh and varied.

### 2) Use Structured Output (`format`) With JSON Schema

Nora sends an explicit schema in the Ollama `format` field for each shape:

- passage schema (`{ passage: string }`)
- questions schema (`{ questions: [...] }`)
- writing schema
- math mixed schema

Nora also sets:

- `stream: false`
- `think: false`

This combination reduces non-JSON output and lowers empty/invalid payload rates.

### 3) Retry Transient Empty/Invalid Payloads

For each model call, Nora retries up to 3 attempts when payloads are:

- empty
- invalid JSON
- otherwise unparsable

After retries are exhausted, Nora returns `502` with the upstream error payload.

## Grading Strategy

`POST /chat/api/nora-homework/grade` follows the same reliability contract as exercise generation.

### 1) Subject/Type Specific Schemas

Nora grades with explicit structured output schemas by workload:

- English reading grading schema
- English writing grading schema
- Math mixed grading schema

### 2) Strict Response Contract

For grading calls Nora sends:

- `stream: false`
- `think: false`
- `format: <schema>`

This keeps grading payloads machine-parseable and avoids freeform response drift.

### 3) Retry Behavior

Nora retries transient empty/unparseable grading payloads up to 3 attempts.
If all attempts fail, the route returns `502` with the upstream failure message.

## Error and Status Behavior

- Nora route returns `400` for invalid request shape or unknown subject/type.
- Nora route returns `502` for exhausted upstream generation failures.
- Homeworks route preserves upstream Nora status codes where possible (for example Nora `502` remains `502`) to keep diagnostics accurate.

## Prompt Contract

System prompts for homework generation must:

- require JSON only
- require exact schema compliance
- forbid markdown and prose wrappers

If prompt changes are made, keep schema and prompt expectations aligned in the same change.

## Testing Strategy

Route-level integration tests should cover:

1. empty first response followed by success
2. persistent empty response leading to `502`
3. structured object content from Ollama accepted directly
4. request payload includes `think: false` and `format` schema

Homeworks API tests should cover:

1. success path shape
2. upstream Nora `502` preservation

Grading route tests should cover:

1. math mixed grading success with schema-formatted request
2. empty payload retry exhaustion returning `502`
3. Homeworks `/api/grade` preserving upstream Nora `502`

## Operations Checklist

When homework generation fails in dev:

1. Confirm Tailscale connectivity.
2. Verify Nora can reach `OLLAMA_HOST`.
3. Hit Nora route directly with curl:
   - `POST /chat/api/nora-homework/exercise`
4. Check returned status and error payload.
5. Run focused route tests before changing prompts.

## Change Rule

Any change to homework generation prompts, schemas, or retry/error behavior must update this file and relevant entries in:

- `docs/design/configuration.md`
- `docs/design/failure-modes.md`
- `apps/homeworks/README.md` (if client-visible behavior changes)
