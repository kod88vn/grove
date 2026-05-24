# Failure Modes

| Failure | Behavior |
|---------|----------|
| Ollama unreachable (chat) | SSE error event and UI error state |
| LLM classifier unreachable (`classifyIntent`) | Falls back to legacy keyword heuristics only in test mode; returns `requiresSearch: false` (no search) to avoid false positives |
| Orchestrator unreachable | LLM-based semantic classification via `classifyIntent()` → fallback to keyword heuristics only if classifier fails |
| Web search no results | Empty result array passed to model |
| Webpage blocked | Fallback query search path |
| Tool loop risk | Capped by `MAX_TOOL_PLANNING_PASSES` |
| Deep research angle fails | Failed angle skipped; others continue |
| High-risk factual claim without evidence | Forced verification before final answer |
| Low confidence role/status claims | Trusted-source escalation before final assertion |
| Verification still weak | Guarded refusal instead of definitive claim |
| Homework exercise generation receives empty/invalid Ollama payload | Up to 3 retries, then `502` with route error payload |
| Homework grading receives empty/invalid Ollama payload | Up to 3 retries, then `502` with route error payload |
| SQLite path invalid | Startup failure; fix `NORA_DB_PATH`/volume |

## LLM Classifier Failure Handling

The intent classification system uses an LLM (`classifyIntent`) as the primary signal. When it fails:

1. **Production fallback**: Returns `requiresSearch: false` — conservative safety choice (never search when not needed vs. searching unnecessarily).
2. **Test mode**: Classification is disabled entirely (`requiresSearch: false`), and test overrides use `TEST_FALLBACK_ROUTE`.
3. **Orchestrator fallback chain**: `orchestrator → classifyIntent (LLM) → legacy keyword heuristics` — keywords are **only** used as the last resort.

Keyword-based functions (`requiresFactVerification`, `requiresLiveData`, etc.) are marked **DEPRECATED** and retained only for backward compatibility.
