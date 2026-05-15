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
- Local/dev access to `http://grove:11434` depends on Tailscale connectivity; if Tailscale is disconnected, fail fast and restore connectivity.
- Do not implement or attempt localhost Ollama fallbacks (for example `http://localhost:11434`) in Nora routes or helpers.
- When a sibling app (e.g. `homeworks`, `games`) needs AI generation or grading, it POSTs to a Nora API route (e.g. `/api/nora-homework/exercise`).
- Nora routes follow the pattern in `apps/nora/app/api/nora-crossword/route.js`: import `callOllama` and `DEFAULT_MODEL` from `@/app/api/chat/lib/`, then return `Response.json(...)`.
- Sibling apps reach Nora via `process.env.PLT_NORA_URL` (default `http://localhost:3001` for local dev; resolved automatically in the Platformatic mesh in production).
- **Never** add `OLLAMA_HOST`, `OLLAMA_BASE_URL`, or direct `http://grove:11434` fetch calls to any app other than Nora.

## Prompt Failure Handling Policy

- For content generation failures (for example empty/invalid model output), fix the prompt contract and request parameters first.
- Add diagnostics (logs, traces, targeted tests) to identify why the model response failed.
- Do **not** implement fallback content or fallback response paths that mask model errors.
- Do **not** silently accept generation failure and substitute canned output.
- Retries are allowed, but final failure should surface clearly so prompt/model issues are corrected at the source.

## Workspace Standards

- **Linkification**: When mentioning files in chat, always use markdown links: `[path/to/file.ts](path/to/file.ts)`.
- **Documentation**: Update `DESIGN.md` and `README.md` immediately after any structural or capability change.

## Side-by-Side Testing Rule

**Test files MUST live side by side with the production code they test, never in a separate `test/` directory.**

- Naming convention: `<module>.test.js` next to `<module>.js`, or `<module>.spec.js` for spec-style tests.
- For Next.js pages/routes: `app/page.js` → `app/page.test.js`, `app/api/foo/route.js` → `app/api/foo/route.test.js`.
- For Next.js components: `components/Header.js` → `components/Header.test.js`.
- For lib utilities: `lib/db/chats.js` → `lib/db/chats.test.js`.
- **No `test/`, `__tests__/`, or any other flat test directory is allowed.**
- Jest/Node test runners must be configured to discover `**/*.test.js` and `**/*.spec.js` files recursively within their app directories.
- When creating a new production file, create its test file alongside it immediately.

## Routing Contract (Critical)

Grove routing is layered. Do not treat app-local routes as globally reachable unless they are wired through the gateway/dev shell.

- `apps/homeworks` has `basePath: /homeworks`; its `app/library/page.js` resolves to `/homeworks/library` at the app level.
- Public top-level paths in production are controlled by `apps/gateway/platformatic.json` proxies.
- Public top-level paths in local dev (`yarn dev`) are controlled by `apps/grove/next.config.js` rewrites.
- For any new top-level route alias (example: `/library`), update both:
	- Gateway proxy mapping (`apps/gateway/platformatic.json`)
	- Grove dev rewrites (`apps/grove/next.config.js`)
- In Next.js UI code, use `next/link` (not raw `<a href>` for internal navigation) so `basePath` and app routing are handled correctly.
