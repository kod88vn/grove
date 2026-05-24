# Modules

## Module Map

```text
app/
├── page.js
├── chat/
│   └── page.js
├── api/
│   ├── chat/
│   │   ├── route.js
│   │   └── lib/
│   │       ├── constants.js
│   │       ├── tools.js
│   │       ├── prompt.js
│   │       ├── orchestratorClient.js
│   │       ├── toolCalls.js
│   │       ├── ollama.js
│   │       ├── web.js
│   │       ├── research.js
│   │       ├── logger.js
│   │       └── chatStream.js
│   ├── nora-crossword/
│   │   └── route.js
│   └── models/
│       └── route.js
components/
├── ChatWorkspace.js
├── ChatSidebar.js
├── ChatMessage.js
└── ChatInput.js
public/
└── (static chat assets)
```

## Responsibilities

| Module | Responsibility |
|--------|---------------|
| `app/page.js` | Redirect root traffic into the dedicated `/chat` experience |
| `route.js` | Parse and validate HTTP request body and delegate to `chatStream` |
| `constants.js` | Shared env/config constants |
| `tools.js` | Tool schemas for model planning |
| `prompt.js` | System prompt composition and injection |
| `orchestratorClient.js` | Call orchestrator `/orchestrate`; fallback uses LLM-based `classifyIntent()` — NO keyword matching |
| `intent.js` | **LLM-based intent classification** via `classifyIntent()`. Deprecated keyword functions kept only for query expansion and test back-compat, NOT for classification. |
| `toolCalls.js` | Parse and normalize tool calls |
| `ollama.js` | Transport to Ollama and history compression |
| `web.js` | Search and webpage reading helpers |
| `research.js` | Multi-angle deep research pipeline |
| `logger.js` | Append-only audit logging |
| `chatStream.js` | Tool planning and final streaming orchestration |
| `verification.js` | Evidence assessment (source count, trusted outlets) — NOT classification. Verification requirement determined by orchestrator or LLM classifier only. |
| `app/api/nora-crossword/route.js` | Generate and validate dense level-based crossword layouts for games |

## Dependency Graph

```mermaid
flowchart LR

subgraph lib["app/api/chat/lib"]
  chatStream.js
  intent.js
  orchestratorClient.js
  constants.js
  logger.js
  ollama.js
  prompt.js
  research.js
  verification.js
  web.js
  toolCalls.js
  tools.js
end

chatStream.js --> constants.js
chatStream.js --> logger.js
chatStream.js --> ollama.js
chatStream.js --> prompt.js
chatStream.js --> orchestratorClient.js
chatStream.js --> intent.js
chatStream.js --> research.js
chatStream.js --> verification.js
chatStream.js --> toolCalls.js
chatStream.js --> tools.js
chatStream.js --> web.js
orchestratorClient.js --> intent.js
logger.js --> fs
logger.js --> path
ollama.js --> constants.js
research.js --> logger.js
research.js --> ollama.js
research.js --> web.js
intent.js --> ollama.js
verification.js ├── intent.js (deprecated helpers for query expansion only)
verification.js --> web.js
verification.js --> sources.js
```

## Intent Classification (Updated 2026-05-24)

**All routing and search decisions now use LLM-based semantic classification. Keyword matching is removed.**

| Decision | Old Method (Deprecated) | New Method |
|----------|------------------------|------------|
| Needs web search? | `requiresLiveData()`, `requiresFactVerification()` keyword functions | `classifyIntent()` LLM classifier (intent.js) |
| Needs factual route? | `isCurrentInfoQuery()` keyword function in orchestratorClient.js | `classifyIntent().requiresSearch` via fallback plan or orchestrator service |
| Needs verification? | `isCurrentTitleQuestion()`, `requiresPreciseValue()` keyword functions | Orchestrator `requireVerification` flag or LLM classifier result |

**Deprecated keyword functions in intent.js:**
- `isCurrentTitleQuestion()` — kept for query expansion and guidance text only
- `requiresFactVerification()` — kept for test-mode fallback in llmCalls.js only
- `requiresLiveData()` — no longer used, classifyIntent handles this semantically
- `requiresPreciseValue()` — kept for test-mode fallback in llmCalls.js only, guidance text in verification.js
- `isMarketRecommendationQuestion()` — kept for query expansion and guidance text only
- `isSensitivePersonStatusClaim()` — kept for query expansion and guidance text only

These functions are marked `@deprecated` and do NOT drive classification decisions in production. The LLM classifier (`classifyIntent()`) is the ONLY auth path for determining whether web search or factual routing is needed.
