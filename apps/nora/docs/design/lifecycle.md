# Request Lifecycle

```text
Browser
  ├─ POST /api/chat  { model, messages }
  └─ route.js
       └─ chatStream.streamResponse(model, messages)
            ├─ ollama.compressHistory()
            ├─ orchestratorClient.getExecutionPlan()  (/orchestrate)
            │    └─ [orchestrator executes toolPlan if present and verificationPolicy='required']
            ├─ prompt.withSystemMessage(profile, { skillPromptPack })
            ├─ [if verificationPolicy='required' && execution succeeded: inject orchestrator tool result]
            ├─ route fast paths (`local_tool`, `fast_chat`)
            ├─ planTools() loop (up to 3 passes)
            │    ├─ callOllama (planning with verified facts in context)
            │    ├─ parse tool calls
            │    └─ execute tools (`get_current_time`, `web_search`, `read_webpage`, `deep_research`)
            ├─ emit sources and verification report
            └─ streamFinalAnswer() with think=false
```

## Key Guarantees

- Tool planning is bounded by `MAX_TOOL_PLANNING_PASSES`.
- Orchestrator tool results (e.g., factual_lookup) are injected into planning context for required verification.
- High-risk claims trigger verification/escalation flows.
- Final user output uses a streaming pass with `think: false`.
- Orchestrator-selected skill prompt instructions are injected per request.

