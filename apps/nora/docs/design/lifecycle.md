# Request Lifecycle

```text
Browser
  ├─ POST /api/chat  { model, messages }
  └─ route.js
       └─ chatStream.streamResponse(model, messages)
            ├─ ollama.compressHistory()
            ├─ orchestratorClient.getExecutionPlan()  (/orchestrate)
            ├─ prompt.withSystemMessage(profile, { skillPromptPack })
            ├─ route fast paths (`local_tool`, `fast_chat`)
            ├─ planTools() loop (up to 3 passes)
            │    ├─ callOllama (planning)
            │    ├─ parse tool calls
            │    └─ execute tools (`get_current_time`, `web_search`, `read_webpage`, `deep_research`)
            ├─ emit sources and verification report
            └─ streamFinalAnswer() with think=false
```

## Key Guarantees

- Tool planning is bounded by `MAX_TOOL_PLANNING_PASSES`.
- High-risk claims trigger verification/escalation flows.
- Final user output uses a streaming pass with `think: false`.
- Orchestrator-selected skill prompt instructions are injected per request.
