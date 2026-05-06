# SSE Contract

All events are emitted as `data: <JSON>` frames over `/api/chat`.

| Event | Shape | When emitted |
|------|-------|--------------|
| Status | `{ "status": "..." }` | Pipeline status updates (`null` clears) |
| Orchestration route | `{ "orchestration": { "route": "local_tool|fast_chat|factual_tool|reasoning|structured_data", "reason": "...", "confidence": "low|medium|high" } }` | After orchestrator plan is resolved |
| Searching indicator | `{ "searching": true, "query": "..." }` | Before search begins |
| Search done | `{ "searching": false, "query": "...", "resultCount": N }` | After search completes |
| Researching indicator | `{ "researching": true, "topic": "..." }` | On deep research start |
| Researching done | `{ "researching": false }` | On deep research completion |
| Sources | `{ "sources": ["https://...", ...] }` | After tool calls complete |
| Verification report | `{ "verification": { "required": bool, "status": "not_required|verified|low_confidence|weak|unverified", "sourceCount": N, "reliableSourceCount": N, "highConfidenceSourceCount": N, "trustedSourceCount": N, "guidance": "..." } }` | Before final answer |
| Thinking token | `{ "thinking": "..." }` | During model reasoning phase |
| Thinking done | `{ "thinkingDone": true }` | When content starts |
| Word token | `{ "word": "..." }` | Streaming answer chunks |
| Done | `[DONE]` | Stream end |
| Error | `{ "word": "Error: ..." }` with `thinkingDone` | Any server-side failure |

## UI Notes

- Thinking/status text renders in a separate bubble before answer tokens arrive.
- Mobile uses single-pane mode with full-screen history overlay.
- Composer instructions render below textarea, not in placeholder text.
