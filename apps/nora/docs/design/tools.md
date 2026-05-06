# Tool Definitions

Tools are declared in `app/api/chat/lib/tools.js` and selected by model planning.

| Tool | Trigger examples | Server action |
|------|------------------|---------------|
| `get_current_time` | "What time is it?" | Returns ISO + local time payload |
| `web_search` | Current events, prices, roles | DuckDuckGo + fallback behavior |
| `read_webpage` | "Read this URL" | Fetch + text extraction + fallback search on failure |
| `deep_research` | "Why/how/explain/compare" | Multi-angle search/read/summarize/synthesize |

## Add A New Tool

1. Add schema in `tools.js` and include in `TOOL_DEFINITIONS`.
2. Add execution branch in `chatStream.executeToolCall`.
3. Implement tool logic in the appropriate module.
4. Update this file and corresponding tests.
