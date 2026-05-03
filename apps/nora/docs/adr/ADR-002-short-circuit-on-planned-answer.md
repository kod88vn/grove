# ADR-002 — Short-circuit when planning pass produces final answer

## Status
Deprecated

## Context
After tool execution, some models produce a complete final answer inside the planning pass (non-streaming) response rather than deferring it to the streaming second pass. Launching the second streaming pass in that case resulted in a thinking-only stream with no content — causing the UI to hang waiting for words that would never arrive.

The chat flow was later revised to always use the second streaming pass for final prose generation, which simplified behavior and event sequencing.

## Decision
After the tool-planning loop completes, if `planningResult.message.content` is non-empty and there are no remaining tool calls, emit `{ thinkingDone }` + `{ word: plannedAnswer }` + `[DONE]` immediately and close the stream without starting the streaming second pass.

## Consequences
- Historical note only. Current implementation no longer short-circuits.
- Final answers now consistently come from the streaming second pass.
