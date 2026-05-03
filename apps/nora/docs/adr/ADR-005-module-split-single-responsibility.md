# ADR-005 — Module split: one responsibility per file

## Status
Accepted

## Context
The original `app/api/chat/route.js` grew to 662 lines and contained: HTTP handler, system prompt, tool schemas, argument parsing, XML parsing, Ollama client, history compression, web search, HTML parsing, webpage reader, fallback query builder, tool-planning loop, and SSE streaming — all in one file. This violated the Single Responsibility Principle and made any change risky due to unrelated concerns being coupled.

## Decision
The route was split into focused modules under `app/api/chat/lib/`:

| Module | Single responsibility |
|--------|-----------------------|
| `constants.js` | Config and magic values |
| `tools.js` | Tool JSON Schema definitions |
| `prompt.js` | System prompt composition |
| `toolCalls.js` | Tool-call extraction and argument normalization |
| `ollama.js` | Ollama HTTP transport and history compression |
| `web.js` | Web search, webpage reading, HTML utilities |
| `chatStream.js` | Tool-planning loop and SSE orchestration |

`route.js` is now a thin controller (10 lines): validate input, delegate to `chatStream`.

## Consequences
- Each module can be read, tested, and changed in isolation.
- Cross-module imports are one-directional: orchestration imports adapters, adapters do not import orchestration.
- New tools or data sources require only a new branch in `chatStream.executeToolCall` and a new module if the concern is genuinely new.
- Behaviour is fully preserved; all existing tests pass at the same baseline.
