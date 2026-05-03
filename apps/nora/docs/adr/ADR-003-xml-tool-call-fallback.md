# ADR-003 — XML tool-call parsing fallback for non-conforming models

## Status
Accepted

## Context
Some Ollama models (e.g. `qwen3-coder`) do not emit structured `tool_calls` objects. Instead they embed tool calls in the message `content` field using XML-like syntax:

```
<function=web_search>
<parameter=query>React version</parameter>
</function>
```

Without handling this, tool calls from those models are silently ignored.

## Decision
`lib/toolCalls.js` implements `parseXmlToolCalls(content)` as a fallback. `extractToolCalls(message)` tries structured `tool_calls` first; if absent or empty, it falls back to XML parsing. All parsed calls are normalized to include `type: 'function'` so downstream code handles them uniformly.

## Consequences
- Broader model compatibility without changing any other part of the pipeline.
- XML parsing is a best-effort heuristic; models that use a different undocumented format may still not work.
- Regression tests cover both paths in `__tests__/integration.test.js` ("Route: XML tool-call type normalization").
