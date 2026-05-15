# Testing Strategy

The orchestrator evolves slice-by-slice with tests first.

## Baseline Test Areas

- classifier behavior
- planner metadata selection
- skill manifest loading and prompt-pack selection
- tool registry execution paths
- MCP success/failure/refusal behavior
- structured response validation
- route-level strict schema enforcement (`/weather`, `/dashboard-data`)
- nightly digest composition and free email-to-text delivery helper
- nightly digest worker scheduling and sender adapter contracts
- orchestrate typed refusal behavior
- audit logger persistence/shape

## Acceptance Focus

- weather/data routes never emit prose payloads
- missing/unavailable tools produce typed errors
- selected-skill prompt packs include only requested skills
- Nora integration follows orchestrator policy path
- nightly digest payloads validate as strict JSON and reject prose-like shapes
- nightly digest scheduled runs emit success/failure audit events with typed errors
