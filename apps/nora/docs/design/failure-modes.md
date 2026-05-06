# Failure Modes

| Failure | Behavior |
|---------|----------|
| Ollama unreachable | SSE error event and UI error state |
| Web search no results | Empty result array passed to model |
| Webpage blocked | Fallback query search path |
| Tool loop risk | Capped by `MAX_TOOL_PLANNING_PASSES` |
| Orchestrator unreachable | Safe fallback plan (`factual_tool`) |
| Deep research angle fails | Failed angle skipped; others continue |
| High-risk factual claim without evidence | Forced verification before final answer |
| Weather payload invalid/unavailable | `/api/weather` returns 502; widget deterministic fallback |
| Low confidence role/status claims | Trusted-source escalation before final assertion |
| Verification still weak | Guarded refusal instead of definitive claim |
| SQLite path invalid | Startup failure; fix `NORA_DB_PATH`/volume |
