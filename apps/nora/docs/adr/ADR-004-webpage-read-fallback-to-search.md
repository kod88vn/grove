# ADR-004 — Webpage read failure falls back to web search

## Status
Accepted

## Context
Many high-traffic sites (e.g. Yahoo Finance) block direct HTTP fetches with 4xx/5xx responses, making `read_webpage` silently fail. The original implementation surfaced only an error payload to the model, which then responded "I couldn't retrieve the data" with no actionable information.

## Decision
When `readWebpage` returns an `error` field, `chatStream.executeToolCall` automatically calls `buildFallbackWebQuery(url)` to derive a meaningful search query from the URL structure, then runs `webSearch` with that query. The fallback results are attached to the tool result payload under `fallbackResults` so the model can continue from them. The system prompt instructs the model to use `fallbackResults` when present.

`buildFallbackWebQuery` applies domain-specific heuristics (e.g. Yahoo Finance `/quote/TSLA/history` → "TSLA stock performance last year") before falling back to a generic host + path query.

## Consequences
- The bot can answer questions about URLs that block scraping.
- Introduces an implicit dependency between `web.js` and the system prompt wording — both must stay aligned.
- Adds one extra web search round-trip when a page is blocked.
