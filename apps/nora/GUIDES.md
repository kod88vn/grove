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
  think: false,           // disable CoT — qwen3 CoT consumes ~900 tokens before tool calls
  tools: TOOL_DEFINITIONS,
  options: { num_predict: 512 },
})
```

`stream: false` lets the server read the complete response and detect `tool_calls` before emitting anything to the browser. `think: false` is critical for Qwen3-family models — CoT reasoning in the planning pass exhausts the token budget before tool calls are emitted. `num_predict: 512` caps planning tokens. See [ADR-001](./docs/adr/ADR-001-tool-planning-non-streaming-first-pass.md).

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

Safety fallback in `planTools()`:
- If the model returns no tool call for factual event/figure/current-role claims (e.g. deaths, elections, incidents, totals, percentages, rates, or "who is the current president?"), Nora forces a `web_search` verification pass before final answer streaming.
- Current-role queries search official-source variants first, then fall back to generic corroboration queries if needed.
- If only a low-confidence source remains for a current-role question, Nora reads that page so the model gets primary page content instead of relying on weights.

---

### Step 5 — Verify evidence

Before final streaming, `chatStream` runs a verification phase:

- `buildVerificationReport(userMessage, sourceUrls)` returns `not_required | verified | low_confidence | weak | unverified`
- Emits `{ verification: {...} }` over SSE for observability
- If status is `low_confidence`, `weak`, or `unverified` for a claim that requires verification, Nora returns a guarded "cannot verify confidently" response instead of a definitive factual answer
- `low_confidence` still captures single-source or low-authority evidence for observability, but it is not enough to ship a definitive answer

---

### Step 6 — Stream final answer

After all tool calls complete, `streamFinalAnswer()` runs a second `callOllama` with `stream: true` (no `tools`). Thinking tokens are emitted as `{ thinking }` events; content tokens as `{ word }` events.

---

### Step 7 — Emit sources

```js
if (sourceUrls.length > 0) emit({ sources: sourceUrls })
```

Emitted once after all tool calls, before the first word token.

---

### Full SSE sequence for a search query

```
data: {"status":"Planning\u2026"}
data: {"status":"Executing tools\u2026"}
data: {"searching":true,"query":"TSLA stock performance last year"}
data: {"searching":false,"query":"TSLA stock performance last year","resultCount":4}
data: {"status":"Reading finance.yahoo.com\u2026"}
data: {"sources":["https://finance.yahoo.com/...", ...]}
data: {"status":"Verifying evidence\u2026"}
data: {"verification":{"required":true,"status":"verified","sourceCount":2,"reliableSourceCount":1,"highConfidenceSourceCount":1,"guidance":"..."}}
data: {"status":null}
data: {"thinking":"Let me analyse..."}
data: {"thinkingDone":true}
data: {"word":"Tesla"}
...
data: [DONE]
```

### Full SSE sequence for a deep research query

```
data: {"status":"Planning research angles\u2026"}
data: {"researching":true,"topic":"why are interest rates high"}
data: {"status":"Searching angle 1/4: central bank policy"}
data: {"status":"Reading ft.com\u2026"}
data: {"status":"Summarizing findings (1/4)\u2026"}
...
data: {"status":"Synthesizing research\u2026"}
data: {"researching":false}
data: {"sources":[...]}
data: {"thinkingDone":true}
data: {"word":"Interest"}
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

### Deep research implementation (`lib/research.js`)

`deepResearch(model, topic, onProgress)` runs a 4-angle research loop:

1. `planResearchAngles(model, topic)` — asks model for 4 distinct search queries covering the topic from different angles (causes, statistics, expert opinion, recent developments)
2. For each angle: `webSearch(query)` → `readWebpage(topResult.url)` → `summarizeForTopic(model, topic, ...)`
3. Returns `{ topic, findings: [{angle, summary, url}], sourceUrls }`

Page content > 2,000 chars is summarized via a separate Ollama call (`num_predict: 200, think: false`) before being passed to the final synthesis — keeps context window manageable.

`onProgress` callbacks emit `{ status }` SSE events at each stage so the UI shows live progress.

---

### Web search implementation (`lib/web.js`)

Two levels with automatic fallback:

| Level | Endpoint | Notes |
|-------|----------|-------|
| Primary | `api.duckduckgo.com/?format=json` | Instant Answers API, no key required |
| Fallback | `html.duckduckgo.com/html/` | Parses HTML results, richer coverage, and is preferred for official-source queries |

When `read_webpage` fails (blocked site), `buildFallbackWebQuery` derives a search query from the URL structure and runs a web search automatically. See [ADR-004](./docs/adr/ADR-004-webpage-read-fallback-to-search.md).
