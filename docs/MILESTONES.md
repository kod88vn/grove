# Milestones — Grove AI Workflow Template Adoption

Milestones define scope, gates, and required observations for each unit of work.

## Current Status

| Milestone | Name | Gate Command | Required Observation | Status |
| --- | --- | --- | --- | --- |
| M1 | Adopt AI workflow template files | `node scripts/arch-check.mjs && node scripts/quality-check.mjs` | Both scripts print "passed" with zero violations | **NOT STARTED** |

## Per-milestone details

### M1 — Adopt AI workflow template files

**Scope:** Create all template files from the ai_template repository, adapted for Grove's monorepo structure.

**Files to create/modify:**
- `.github/agents/code-reviewer.agent.md` — architecture reviewer agent
- `.github/agents/spec-lookup.agent.md` — spec lookup subagent
- `.github/agents/docs-researcher.agent.md` — documentation researcher subagent
- `.github/agents/milestone-verifier.agent.md` — milestone verification gate
- `.github/instructions/code-quality.instructions.md` — code quality rules (auto-applied)
- `.github/instructions/testing.instructions.md` — testing rules (auto-applied)
- `.github/instructions/vendor-adapters.instructions.md` — vendor adapter rules (auto-applied)
- `.github/prompts/plan-milestone.prompt.md` — milestone planning prompt
- `.github/prompts/refactor-abstraction.prompt.md` — refactoring prompt
- `.github/skills/milestone-workflow/SKILL.md` — milestone workflow skill
- `scripts/ai-guard-config.mjs` — shared config loader
- `scripts/arch-check.mjs` — architecture boundary enforcement
- `scripts/quality-check.mjs` — size and hygiene enforcement
- `ai-guard.config.json` — guard configuration for Grove's layers
- `CONTEXT.md` — domain glossary
- `docs/STACK.md` — verified facts ledger
- `docs/MILESTONES.md` — this file

**Gate command:**
```sh
node scripts/arch-check.mjs && node scripts/quality-check.mjs
```

**Required observation:** Both scripts print "passed" with zero violations. The arch-check must recognize all 6 layers (schema, rules, ports, adapters, use-cases, delivery). The quality-check must scan all JS/JSX/TS/TSX files in `apps/` without errors.

**Risks:**
- Layer matching patterns may need tuning for the monorepo structure
- Purity patterns may flag legitimate code in Next.js API routes — adjust exclusions if needed
- The JSON config uses `//` comments which require the custom parser in ai-guard-config.mjs

**Deferrals:**
- Full CI integration (adding arch:check and quality:check to turbo pipeline)
- Banned pattern entries for project-specific stale beliefs as they arise
- TypeScript migration (deferred per STACK.md)

---

## Completion log

| Date | Milestone | Gate Result | Notes |
| --- | --- | --- | --- |
| 2026-08-15 | M1 | PENDING | Template adoption in progress |