# Nora

Nora is the Grove family's AI-powered house steward. Built with Next.js 15 App Router, Tailwind CSS, and streaming responses from a local Ollama LLM.

## Features

- **Next.js 15** with App Router
- **Real-time streaming** — words appear as they're generated
- **Tailwind CSS** — modern, responsive design
- **Component architecture** — reusable, professional components
- **Typing indicator** — animated dots while LLM thinks
- **Auto-scroll** — chat scrolls to latest message
- **Error handling** — graceful error messages

## Architecture

```
app/
├── layout.js                    # Root layout with metadata
├── page.js                      # Main chat interface + model selector
├── globals.css                  # Tailwind directives
└── api/
    ├── chat/
    │   ├── route.js             # POST handler — input validation only
    │   └── lib/
    │       ├── constants.js     # Config and magic values
    │       ├── tools.js         # Tool JSON Schema definitions
    │       ├── prompt.js        # System prompt composition
    │       ├── toolCalls.js     # Tool-call parsing + argument normalization
    │       ├── ollama.js        # Ollama HTTP client + history compression
    │       ├── web.js           # Web search, webpage reader, HTML utilities
    │       └── chatStream.js    # Tool-planning loop + SSE orchestration
    └── models/
        └── route.js             # Proxies Ollama /api/tags for model list

components/
├── ChatMessage.js      # Message bubbles (thinking + content + sources)
├── ChatInput.js        # Input textarea + send button
└── TypingIndicator.js  # Animated typing dots

tailwind.config.js      # Tailwind configuration
postcss.config.js       # PostCSS/Tailwind setup
```

See [DESIGN.md](./DESIGN.md) for the full architecture, SSE event contract, tool table, and architecture decision records.

## Prerequisites

- Local LLM running at `http://ai:11434/api/chat` (e.g., Ollama)
- Node.js 18+

## Getting Started

```bash
cd apps/virtual-tutor
npm install
npm run dev
```

Visit http://localhost:3000

## Configuration

| Variable | Default | Purpose |
|----------|---------|--------|
| `DEFAULT_MODEL` | `qwen3.5:9b` | LLM model used server-side (`lib/constants.js`) |
| `NEXT_PUBLIC_DEFAULT_MODEL` | `qwen3.5:9b` | Initial model shown in UI before `/api/models` loads |

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

Streams Server-Sent Events. See [DESIGN.md § SSE Event Contract](./DESIGN.md#4-sse-event-contract) for the full event table.

```
data: {"searching":true,"query":"..."}
data: {"searching":false,"query":"...","resultCount":3}
data: {"sources":["https://..."]}
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
