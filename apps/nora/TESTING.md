# Testing the Chat Flow

## Unit & Integration Tests

Run the test suite:

```bash
cd apps/nora
yarn test:ci
```

### What's covered

**`__tests__/lib.test.js`** — pure utility unit tests (run fast, no network/Ollama required):
- `normalizeQuery` — whitespace trimming, empty string handling
- `normalizeUrl` — URL hygiene, security: rejects `javascript:`, `file://`, `data:` protocols
- `parseXmlToolCalls` — XML `<tool_call>` extraction (ADR-003 fallback path)
- `extractToolCalls` — structured + XML tool-call detection

**`__tests__/chat.test.js`** and **`__tests__/integration.test.js`** — SSE stream parsing, state machine transitions, word buffering, edge cases.

### Architecture validation

```bash
yarn arch:check   # fail on circular dependencies in app/api/chat/lib
yarn arch         # print Mermaid module dependency graph
```

## Manual E2E Test

After `yarn dev` is running, in another terminal:

```bash
cd apps/nora
node test-manual.mjs
```

This will:
1. Send a message to your local Ollama
2. Parse the entire SSE stream
3. Print all events received
4. Validate the flow worked correctly

## Common Issues to Check

### ❌ No response generated
- Check: Is Ollama reachable? `curl http://grove:11434/api/tags`
- Check: Tool-planning pass returns tool calls (add `console.log` to `chatStream.planTools`)
- Check: `streamFinalAnswer` is called after tool results are appended

### ❌ Web search results empty
- Check: DuckDuckGo HTML endpoint reachable from your network
- Check: HTML parser finding `<a class="result__url">` selectors (DuckDuckGo may change markup)

### ❌ deep_research stalls
- Check: `research.js` `planResearchAngles` returns 4 queries (log the planning response)
- Check: Each angle's `readWebpage` result has content (some sites block headless fetches)

### ❌ Status events not showing in UI
- Check: `{ status }` events are emitted from `emit()` in chatStream.js
- Check: `app/page.js` handles `{ status }` events and updates the active assistant message state
- Check: `ChatMessage` renders `status` in the thinking bubble while streaming

## Debugging Steps

1. **Check raw SSE stream**: `node test-manual.mjs` — prints every SSE event
2. **Unit test a specific util**: `yarn test --testPathPattern lib.test.js`
3. **Check Ollama directly**:
   ```bash
   curl -X POST http://grove:11434/api/chat \
     -H "Content-Type: application/json" \
     -d '{"model":"qwen3.5:9b","messages":[{"role":"user","content":"Hi"}],"stream":true}'
   ```
4. **Check architecture**: `yarn arch:check` to verify no circular deps were introduced
