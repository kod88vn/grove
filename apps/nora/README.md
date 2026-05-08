# Nora

Nora is the Grove family's AI-powered chatbot. Built with Next.js 16 App Router, Tailwind CSS, and streaming responses from a local Ollama LLM.

## Features

- **Next.js 16** with App Router
- **Real-time streaming** — words appear as they're generated, with live thinking indicators
- **Tool calling** — web search, page reader, deep research, current time
- **Intent-first orchestration** — Nora asks external orchestrator service for route policy (`local_tool`, `fast_chat`, `factual_tool`, `reasoning`) before chat execution
- **Verification guardrails** — current-fact and current-role answers are forced through source verification before Nora answers definitively
- **Deep research** — multi-angle search across 4 queries synthesised into one answer
- **Audit logging** — per-session log at `logs/chat-audit.log` for debugging
- **Tailwind CSS** — modern, responsive design
- **Mobile single-pane UX** — history sidebar auto-collapses on mobile and opens as a full-screen overlay
- **Mobile-friendly composer** — input guidance is shown below the textarea to prevent placeholder clipping on narrow screens
- **Thinking bubble** — separate assistant-thinking bubble stays visible until answer text starts, with a 3-line smooth auto-follow viewport that users can scroll upward
- **Auto-scroll** — chat scrolls to latest message

## Architecture

```
app/
├── layout.js                    # Root layout with metadata
├── page.js                      # Redirects root traffic to /chat
├── chat/
│   └── page.js                  # Main chat interface route
├── globals.css                  # Tailwind directives
└── api/
    ├── chat/
    │   ├── route.js             # POST handler — input validation only
    │   └── lib/
    │       ├── constants.js     # Config and magic values
    │       ├── tools.js         # Tool JSON Schema definitions
    │       ├── prompt.js        # System prompt composition
    │       ├── orchestratorClient.js # HTTP client to sibling orchestrator app
    │       ├── toolCalls.js     # Tool-call parsing + argument normalization
    │       ├── logger.js        # Audit log writer (logs/chat-audit.log)
    │       ├── research.js      # Deep research engine (multi-angle search)
    │       ├── ollama.js        # Ollama HTTP client + history compression
    │       ├── web.js           # Web search, webpage reader, HTML utilities
    │       └── chatStream.js    # Tool-planning loop + SSE orchestration
    └── models/
      └── route.js             # Proxies Ollama /api/tags for model list

components/
├── ChatWorkspace.js    # Chat experience extracted for route reuse
├── ChatMessage.js      # Message bubbles (thinking + content + sources)
├── ChatInput.js        # Input textarea + send button
└── ChatSidebar.js      # Chat history list + mobile full-screen overlay

tailwind.config.js      # Tailwind configuration
postcss.config.js       # PostCSS/Tailwind setup
```

Sibling apps in this monorepo:

- `apps/orchestrator` — intent classifier + execution planner service consumed by Nora
- `apps/games` — separate game workspace/package; no longer mounted inside Nora routes
- `apps/shopping-list` — separate shopping-list workspace/app boundary
- `apps/reminders` — separate reminders workspace/app boundary

See [docs/design/README.md](./docs/design/README.md) for the full architecture, SSE event contract, tool table, and architecture decision records.

## Prerequisites

- Local LLM running at `http://grove:11434/api/chat` (e.g., Ollama)
- Node.js 18+

## Getting Started

```bash
cd apps/nora
npm install
npm run dev
```

Visit http://localhost:3000

## Configuration

| Variable | Default | Purpose |
|----------|---------|--------|
| `DEFAULT_MODEL` | `qwen3.5:9b` | LLM model used server-side (`lib/constants.js`) |
| `NEXT_PUBLIC_DEFAULT_MODEL` | `qwen3.5:9b` | Initial model shown in UI before `/api/models` loads |
| `ORCHESTRATOR_URL` | `http://127.0.0.1:4010` | Endpoint for external orchestrator planning service |

## API

The `/api/chat` endpoint accepts:

```json
{
  "model": "qwen3.5:9b",
  "messages": [
    { "role": "user", "content": "Hello!" }
  ]
}
```

Streams Server-Sent Events. See [docs/design/sse-contract.md](./docs/design/sse-contract.md) for the full event table.

```
data: {"status":"Thinking…"}
data: {"orchestration":{"route":"fast_chat","reason":"non_factual_conversation","confidence":"high"}}
data: {"searching":true,"query":"..."}
data: {"searching":false,"query":"...","resultCount":3}
data: {"researching":true,"topic":"..."}
data: {"researching":false}
data: {"sources":["https://..."]}
data: {"verification":{"required":true,"status":"verified","sourceCount":1,"reliableSourceCount":1,"highConfidenceSourceCount":1,"guidance":"..."}}
data: {"thinking":"..."}
data: {"thinkingDone":true}
data: {"word":"Hello"}
data: [DONE]
```

## Build for Production

```bash
npm run build
npm start
```
