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
| Low confidence role/status claims | Trusted-source escalation before final assertion |
| Verification still weak | Guarded refusal instead of definitive claim |
| Homework exercise generation receives empty/invalid Ollama payload | Up to 3 retries, then `502` with route error payload |
| Homework grading receives empty/invalid Ollama payload | Up to 3 retries, then `502` with route error payload |
| SQLite path invalid | Startup failure; fix `NORA_DB_PATH`/volume |
