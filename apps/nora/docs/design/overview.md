# Overview

Nora is the Grove family's AI-powered chatbot built on Next.js 16. It streams responses from a local Ollama model, performs web verification/tool usage, and delegates routing policy to the sibling orchestrator via `POST /orchestrate`.

## System Architecture

```mermaid
flowchart LR
    Browser -->|POST /api/chat SSE| Nora["nora\n(Next.js)"]
    Nora -->|HTTP| Ollama["Ollama\nhttp://grove:11434"]
    Nora -->|POST /orchestrate| Orch["orchestrator\napps/orchestrator"]
    Nora -->|search| DDG["DuckDuckGo"]
    Nora -->|fetch| Web["Web pages"]
    Tailscale -->|MagicDNS http://grove| Watt["Platformatic Watt\n:80"]
    Watt --> Nora
```
