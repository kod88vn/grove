# ADR-001 — Tool planning in non-streaming first pass

## Status
Accepted

## Context
Ollama can stream tokens as they are generated, but tool calls require reading the complete model response before executing anything. If we start streaming immediately, there is no safe point to intercept a tool call mid-stream.

## Decision
The first Ollama request always uses `stream: false` so the full response can be inspected for `tool_calls` before any SSE events are emitted to the browser. Only the final prose answer uses `stream: true`.

## Consequences
- Tool calls are detected reliably regardless of how long the model takes to generate them.
- Latency before first token is higher when the model decides to search (one extra synchronous round-trip).
- `num_predict: 1024` caps the planning pass to prevent runaway thinking tokens from stalling the response.
