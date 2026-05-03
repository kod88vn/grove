# Nora — Developer Guides

> For the full architecture overview, SSE event contract, and design rationale see [DESIGN.md](./DESIGN.md) and [`docs/adr/`](./docs/adr/).

---

## How Tool Calling Works

The model does not have internet access by default. Tools are wired through an explicit planning loop in `app/api/chat/lib/chatStream.js`. Tool schemas live in `lib/tools.js`, argument parsing in `lib/toolCalls.js`, and web fetching in `lib/web.js`.

Here is the full flow.

---

### Step 1 — Declare the tool schema (`lib/tools.js`)

```js
export const WEB_SEARCH_TOOL = {
  type: 'function',
  function: {
    name: 'web_search',
    description: 'Search the public web for current information and return relevant sources.',
    parameters: {
      type: 'object',
      properties: {
        query: { type: 'string', description: 'The web search query.' },
      },
      required: ['query'],
    },
  },
}
```

The model only sees this schema. It never touches the JavaScript implementation.

---

### Step 2 — Inject a system prompt (`lib/prompt.js`)

`withSystemMessage()` prepends a system turn that tells the model:
- Which user intents warrant a tool call (time-sensitive facts, current events, prices, versions)
- How to behave after tool results arrive (answer from results, cite sources)

Without this, the model may ignore available tools.

---

### Step 3 — First pass: tool planning (non-streaming)

```js
// lib/chatStream.js — planTools()
const firstPass = await callOllama({
  model,
  messages: messagesWithSystem,
  stream: false,          // must be non-streaming to inspect the full response
  tools: TOOL_DEFINITIONS,
  options: { num_predict: 1024 },
})
```

`stream: false` lets the server read the complete response and detect `tool_calls` before emitting anything to the browser. `num_predict` caps planning tokens to prevent runaway loops. See [ADR-001](./docs/adr/ADR-001-tool-planning-non-streaming-first-pass.md).

---

### Step 4 — Execute tool calls on the server (`lib/chatStream.js`, `lib/web.js`)

```js
// chatStream.js — executeToolCall()
if (fn?.name === 'web_search') {
  const results = await webSearch(buildDatedQuery(rawQuery))
  followupMessages.push({ role: 'tool', tool_name: 'web_search', content: JSON.stringify({ results }) })
}
```

The server runs the tool; the model only declares intent. After execution the result is appended as a `role: 'tool'` message. The loop repeats up to `MAX_TOOL_PLANNING_PASSES` times (default 3).

---

### Step 5 — Short-circuit or stream final answer

If the planning pass already produced a complete text answer, it is emitted directly without a second streaming round-trip. See [ADR-002](./docs/adr/ADR-002-short-circuit-on-planned-answer.md).

Otherwise a second `callOllama` with `stream: true` (no `tools`) produces the prose answer chunk by chunk.

---

### Step 6 — Emit sources

```js
if (sourceUrls.length > 0) emit({ sources: sourceUrls })
```

Emitted once after all tool calls, before the first word token.

---

### Full SSE sequence for a search query

```
data: {"searching":true,"query":"TSLA stock performance last year"}
data: {"searching":false,"query":"TSLA stock performance last year","resultCount":4}
data: {"sources":["https://finance.yahoo.com/...", ...]}
data: {"thinking":"Let me analyse..."}
data: {"thinkingDone":true}
data: {"word":"Tesla"}
...
data: [DONE]
```

See [DESIGN.md § SSE Event Contract](./DESIGN.md#4-sse-event-contract) for the complete event table.

---

### Adding a new tool

1. Add JSON schema to `lib/tools.js`; add it to `TOOL_DEFINITIONS`.
2. Add an `if (fn?.name === 'your_tool')` branch in `chatStream.executeToolCall`.
3. Implement the tool logic in an appropriate module (new file if the concern is new).
4. Update [DESIGN.md § Tool Definitions](./DESIGN.md#5-tool-definitions).

---

### Web search implementation (`lib/web.js`)

Two levels with automatic fallback:

| Level | Endpoint | Notes |
|-------|----------|-------|
| Primary | `api.duckduckgo.com/?format=json` | Instant Answers API, no key required |
| Fallback | `html.duckduckgo.com/html/` | Parses HTML results, richer coverage |

When `read_webpage` fails (blocked site), `buildFallbackWebQuery` derives a search query from the URL structure and runs a web search automatically. See [ADR-004](./docs/adr/ADR-004-webpage-read-fallback-to-search.md).
