# Architecture Decisions And Extension Points

## ADR Index

See [../adr](../adr/README.md) for individual records.

| ID | Decision | Status |
|----|----------|--------|
| ADR-001 | Tool planning in non-streaming first pass | Accepted |
| ADR-002 | Short-circuit when planning pass produces final answer | Deprecated |
| ADR-003 | XML tool-call parsing fallback for non-conforming models | Accepted |
| ADR-004 | Webpage read failure falls back to web search | Accepted |
| ADR-005 | Module split: one responsibility per file | Accepted |
| ADR-006 | Persist SQLite chat history via Docker named volume | Accepted |

## Extension Points

- New tool: update `tools.js`, execution path, docs, and tests.
- New LLM backend: replace `callOllama` transport while preserving protocol.
- New search provider: replace search/read helpers in `web.js`.
- New compression strategy: update `compressHistory`.
- New SSE event type: update contract + `ChatWorkspace` handling.
