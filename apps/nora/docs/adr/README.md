# Architecture Decision Records

This directory records significant design decisions made for Nora, the Grove ecosystem chatbot.

| ID | Title | Status | Date |
|----|-------|--------|------|
| [ADR-001](./ADR-001-tool-planning-non-streaming-first-pass.md) | Tool planning in non-streaming first pass | Accepted | 2026-05-02 |
| [ADR-002](./ADR-002-short-circuit-on-planned-answer.md) | Short-circuit when planning pass produces final answer | Deprecated | 2026-05-02 |
| [ADR-003](./ADR-003-xml-tool-call-fallback.md) | XML tool-call parsing fallback for non-conforming models | Accepted | 2026-05-02 |
| [ADR-004](./ADR-004-webpage-read-fallback-to-search.md) | Webpage read failure falls back to web search | Accepted | 2026-05-02 |
| [ADR-005](./ADR-005-module-split-single-responsibility.md) | Module split: one responsibility per file | Accepted | 2026-05-02 |
| [ADR-006](./ADR-006-sqlite-docker-volume-persistence.md) | Persist SQLite chat history via Docker named volume | Accepted | 2026-05-05 |

## Template

Copy the block below to create a new ADR.

```md
# ADR-NNN — Title

## Status
Proposed | Accepted | Deprecated | Superseded by ADR-NNN

## Context
What situation or problem drove this decision?

## Decision
What was decided?

## Consequences
What are the trade-offs? What becomes easier or harder?
```
