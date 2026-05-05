# Testing the Chat Flow

## Unit & Integration Tests

Run the test suite:

```bash
cd apps/nora
yarn test:ci
```

### Coverage matrix

Every test file lives next to the production file it covers (1:1 mapping).  
`–` = no test yet (gap).

| Production file | Test file | Exported symbols tested |
|---|---|---|
| `app/globals.css` | `app/globals.test.js` | CSS regression (no `display:flex` on body) |
| `app/api/chat/route.js` | `app/api/chat/route.test.js` | `POST` |
| `app/api/chat/lib/chatStream.js` | `app/api/chat/lib/chatStream.test.js` | `streamResponse`, `requiresPreciseValue`, `requiresLiveData`, `requiresFactVerification`, `countReliableSources`, `countHighConfidenceSources`, `countTrustedSources`, `countTrustedTechSources`, `buildVerificationQueries`, `buildVerificationReport` |
| `app/api/chat/lib/prompt.js` | `app/api/chat/lib/prompt.test.js` | `withSystemMessage` |
| `app/api/chat/lib/toolCalls.js` | `app/api/chat/lib/toolCalls.test.js` | `normalizeQuery`, `normalizeUrl`, `parseXmlToolCalls`, `extractToolCalls` |
| `app/api/chat/lib/constants.js` | – | constants (no logic) |
| `app/api/chat/lib/logger.js` | – | `createLogger` |
| `app/api/chat/lib/ollama.js` | – | `chatOnce`, `streamChat` |
| `app/api/chat/lib/research.js` | – | `deepResearch` |
| `app/api/chat/lib/tools.js` | – | tool definitions (no logic) |
| `app/api/chat/lib/web.js` | – | `webSearch`, `readWebpage` |
| `app/api/chats/route.js` | – | `GET`, `POST` |
| `app/api/chats/[id]/route.js` | – | `GET`, `DELETE` |
| `app/api/me/route.js` | – | `GET` |
| `app/api/models/route.js` | – | `GET` |
| `app/layout.js` | – | layout (no logic) |
| `app/page.js` | – | `Home` |
| `components/ChatInput.js` | `components/ChatInput.test.js` | `ChatInput` |
| `components/ChatMessage.js` | `components/ChatMessage.test.js` | `ChatMessage` |
| `components/ChatSidebar.js` | `components/ChatSidebar.test.js` | `ChatSidebar` |
| `components/GreetingTrigger.js` | – | `GreetingTrigger` |
| `components/ModelSelector.js` | – | `ModelSelector` |
| `components/UserBadge.js` | – | `UserBadge` |
| `hooks/useChatMessages.js` | `hooks/useChatMessages.test.js` | greeting cache contract |
| `hooks/useChatHistory.js` | – | `useChatHistory` |
| `hooks/useModels.js` | – | `useModels` |
| `lib/useChat.js` | – | `useChat` |
| `lib/api/chat.js` | – | `sendMessage` |
| `lib/api/chats.js` | – | `getChats`, `createChat`, `deleteChat` |
| `lib/api/me.js` | – | `getMe` |
| `lib/api/models.js` | – | `getModels` |
| `lib/db/chats.js` | `lib/db/chats.test.js` | `createChat`, `getChats`, `deleteChat` |
| `lib/db/db.js` | `lib/db/messages.test.js` | `createDatabase` (via integration) |
| `lib/db/messages.js` | `lib/db/messages.test.js` | `saveMessage`, `getMessages`, `countFreshMessages`, `getOldestFreshMessages`, `replaceFreshWithSummary`, `getFreshMessagesForContext` |
| `lib/utils/message.js` | `lib/utils/message.test.js` | `createAssistantPlaceholder`, `applyStreamEvent`, `formatTimestamp`, `extractSources`, `dedupeSources`, `formatVerificationLabel` |
| `lib/utils/sseStream.js` | `lib/utils/sseStream.test.js` | `parseSseStream` |

Jest discovers co-located test files with `**/*.test.js` and ignores `.next/` and `node_modules/`.

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
2. **Unit test a specific module**: `yarn test --testPathPattern toolCalls.test.js`
3. **Check Ollama directly**:
   ```bash
   curl -X POST http://grove:11434/api/chat \
     -H "Content-Type: application/json" \
     -d '{"model":"qwen3.5:9b","messages":[{"role":"user","content":"Hi"}],"stream":true}'
   ```
4. **Check architecture**: `yarn arch:check` to verify no circular deps were introduced
