# Overview

Nora is the Grove family's AI-powered house steward built on Next.js 16. It streams responses from a local Ollama model, performs web verification/tool usage, and delegates routing policy to the sibling orchestrator via `POST /orchestrate`.

The weather widget is intentionally separate from prose chat output and uses strict JSON from `/api/weather`.

## System Architecture

```mermaid
flowchart LR
    Browser -->|POST /api/chat SSE| Nora["nora\n(Next.js)"]
    Nora -->|HTTP| Ollama["Ollama\nhttp://grove:11434"]
    Nora -->|POST /orchestrate| Orch["orchestrator\napps/orchestrator"]
    Nora -->|GET /api/weather| Orch
    Nora -->|search| DDG["DuckDuckGo"]
    Nora -->|fetch| Web["Web pages"]
    Nora -->|imports game logic| Games["games\napps/games"]
    Tailscale -->|MagicDNS http://grove| Watt["Platformatic Watt\n:80"]
    Watt --> Nora
```
