# Grove Domain Glossary

Shared vocabulary for the Grove monorepo — a multi-app AI workspace.

## Terms

### Grove

The monorepo containing all apps, packages, and shared infrastructure. Managed via Yarn workspaces + Turborepo.

- **Not to be confused with:** the individual apps within it
- **Represented in code as:** root `package.json` with `"workspaces": ["packages/*", "apps/*"]`
- **Constraints:** monorepo, not a single application

### Nora

The AI orchestration app. The only app that may call Ollama directly (`http://grove:11434`). All other apps reach AI capabilities through Nora's API routes.

- **Not to be confused with:** the user-facing identity "Nora" (the game assistant)
- **Represented in code as:** `apps/nora/`
- **Constraints:** single responsibility — AI proxy and orchestration

### Platformatic Mesh

The service-to-service communication layer connecting all apps. Each app has a `platformatic.json` that registers it with the mesh. Service discovery uses `process.env.PLT_<APP_NAME>_URL`.

- **Not to be confused with:** the gateway (`apps/gateway/`) which handles public routing
- **Represented in code as:** `apps/*/platformatic.json` per app
- **Constraints:** internal only, not exposed directly to clients

### Gateway

The public-facing entry point. Routes external traffic to internal apps via rewrites/proxies. In local dev, Grove's Next.js config handles rewrites; in production, the Platformatic gateway does this.

- **Not to be confused with:** individual app routing
- **Represented in code as:** `apps/gateway/` and `apps/grove/next.config.js` (dev rewrites)

### Turborepo

The task runner that orchestrates build/dev/test/lint across all workspace packages. Commands like `yarn dev`, `yarn build`, `yarn test` are turbo pipelines.

- **Represented in code as:** `turbo.json`, root `package.json` scripts

### Ollama

Local AI model server running at `http://grove:11434`. Only Nora may call it directly. All other apps POST to Nora's API routes instead.

- **Not to be confused with:** external LLM APIs (Anthropic, etc.)
- **Represented in code as:** only imported/called from `apps/nora/lib/chat/`

### Homeworks

A production-grade data persistence app for tracking student submissions. Uses SQLite via `better-sqlite3`. All data is public (no auth).

- **Not to be confused with:** a game or entertainment app
- **Represented in code as:** `apps/homeworks/`
- **Database file:** `apps/homeworks/data/homeworks.db` (gitignored)

### Games

An AI-powered game collection. Uses Nora's API for AI features. Includes sudoku, crossword, gomoku, hangman, math lightning.

- **Represented in code as:** `apps/games/`

### Next.js App

Any app using the Next.js framework. Each has its own `next.config.js`, `app/` directory, and can run independently via `yarn dev`.

- **Apps using Next.js:** grove, nora, homeworks, games, shopping-list, reminders

## Actors

| Actor | What they can do | What they can never do |
| --- | --- | --- |
| Nora (app) | Call Ollama directly, orchestrate AI requests | Be called for non-AI tasks |
| Sibling apps (homeworks, games, etc.) | POST to Nora's API routes | Call Ollama directly |
| Gateway | Route external traffic to internal apps | Modify app logic |
| Platformatic Mesh | Service discovery and inter-app communication | Expose services publicly |

## States and transitions

```
uninitialized → dev mode → build → deploy → running
running → health check fail → rollback
deploying → CI pass → merged to master → deployed
```

Any transition not drawn above is invalid.

## Things that look optional but are required

- **No direct pushes to master** — all changes go through PRs with CI validation
- **Side-by-side test files** — `*.test.js` next to production code, never in a separate `test/` directory
- **Verify via build** — run `npx next build` after completing tasks to catch type/layout errors

## Things that look required but are optional

- **Tests for SQLite/DB layer code** — forbidden by AGENTS.md; unit tests for app logic are sufficient coverage