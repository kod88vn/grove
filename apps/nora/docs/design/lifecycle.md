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

## Source Citation Enforcement

When verification is required (high-risk factual claims, "what happened" questions, current status queries):

1. **Verification Search**: Multiple search queries are executed (up to 3 rounds) to collect source URLs.
2. **Source Collection**: All URLs from search results are deduplicated and tracked in `sourceUrls` array.
3. **Verification Report**: `buildVerificationReport()` assesses evidence quality (verified/weak/unverified) and source count.
4. **Citation Instructions**: `buildVerificationSystemMessage()` injected into followup messages with:
   - **Verified status**: "CRITICAL: You MUST cite sources...Format as [Source: Name]...at least 2 independent sources"
   - **Weak status**: "WEAK EVIDENCE - YOU MUST CITE SOURCES...explicitly cite every source"
   - **Low confidence**: "STRICT CITATION REQUIRED...cite every source explicitly"
   - **Available sources list**: Top 5 source URLs included in system message for model awareness
5. **Source Emission**: After verification rounds complete, `emit({ sources: sourceUrls })` sends collected sources to UI.
6. **Frontend Display**: ChatMessage component receives sources prop and renders as citation list.

This ensures model generates responses that cite sources by name, avoiding fabricated claims without evidence.

