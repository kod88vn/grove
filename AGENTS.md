# AI Agents Overview

This document defines the roles and responsibilities of AI agents working within the Grove workspace.

## Core Directives

1. **Verify via Build**: Always run a full production build (`npx next build` or equivalent) after completing a task to catch syntax errors, type mismatches, or layout breakage that unit tests might miss.
2. **Test-First Triage**: Follow BDD-style triage. Reproduce bugs in failing tests before fixing.
3. **Keep Nora Thin**: Avoid bloating `apps/nora`. Place major capabilities in sibling apps and keep Nora as a thin consumer.
4. **Permanent Logs**: Maintain an audit log for non-deterministic bugs (gitignored).

## Ollama / AI Access Pattern

**Only Nora may call Ollama directly.** All other apps must call Nora's API routes.

- Ollama runs at `http://grove:11434` inside the Platformatic mesh and is only reachable from Nora's server-side code.
- When a sibling app (e.g. `homeworks`, `games`) needs AI generation or grading, it POSTs to a Nora API route (e.g. `/api/nora-homework/exercise`).
- Nora routes follow the pattern in `apps/nora/app/api/nora-crossword/route.js`: import `callOllama` and `DEFAULT_MODEL` from `@/app/api/chat/lib/`, then return `Response.json(...)`.
- Sibling apps reach Nora via `process.env.PLT_NORA_URL` (default `http://localhost:3001` for local dev; resolved automatically in the Platformatic mesh in production).
- **Never** add `OLLAMA_HOST`, `OLLAMA_BASE_URL`, or direct `http://grove:11434` fetch calls to any app other than Nora.

## Workspace Standards

- **Linkification**: When mentioning files in chat, always use markdown links: `[path/to/file.ts](path/to/file.ts)`.
- **Documentation**: Update `DESIGN.md` and `README.md` immediately after any structural or capability change.
