# ADR-002 — Short-circuit when planning pass produces final answer

## Status
Accepted

## Context
After tool execution, some models produce a complete final answer inside the planning pass (non-streaming) response rather than deferring it to the streaming second pass. Launching the second streaming pass in that case resulted in a thinking-only stream with no content — causing the UI to hang waiting for words that would never arrive.

## Decision
After the tool-planning loop completes, if `planningResult.message.content` is non-empty and there are no remaining tool calls, emit `{ thinkingDone }` + `{ word: plannedAnswer }` + `[DONE]` immediately and close the stream without starting the streaming second pass.

## Consequences
- Eliminates the thinking-only hang on models that answer in the planning pass.
- The streaming second pass is still launched for models that return an empty planning content.
- Verified by regression tests in `__tests__/integration.test.js` ("Route: planning pass short-circuit").
