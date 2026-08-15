# Verified Stack Facts

**Every line here has a date and a source URL. No line is written from memory.**

This file is the antidote to stale training data. Model weights are frozen months or years
before you use them, so an agent will confidently emit a version number, model name, or CLI
flag that was correct once and is now wrong. Those errors are expensive because they look
authoritative and they compile-adjacent — they fail late.

## How to use this file

- **Before writing** any version, model name, endpoint, CLI flag, or config key: check here.
- **Not here?** Delegate to the `docs-researcher` subagent, then record the answer here.
- **Older than 90 days?** Re-verify before relying on it.
- **Contradicted by reality?** Correct the line, keep the old value in "Known-stale beliefs"
  so the same mistake is caught next time.

---

## Verified facts

| Fact | Value | Verified on | Source |
| --- | --- | --- | --- |
| Package manager | yarn@1.17.3 | 2026-08-15 | https://classic.yarnpkg.com/lang/en/docs/install/ |
| Runtime | Node.js (LTS) | 2026-08-15 | https://nodejs.org/en/about/releases/ |
| Framework | Next.js (per app) | 2026-08-15 | https://nextjs.org/docs |
| Task runner | Turborepo@^2.9.12 | 2026-08-15 | https://turbo.dev/ |
| Service mesh | Platformatic@^3.53.0 | 2026-08-15 | https://docs.platformatic.dev/ |
| Database driver | better-sqlite3 | 2026-08-15 | https://github.com/WiseLibs/better-sqlite3 |
| Test runner (unit) | Jest (per app) | 2026-08-15 | https://jestjs.io/docs |
| Test runner (e2e) | Playwright | 2026-08-15 | https://playwright.dev/ |
| AI runtime | Ollama at http://grove:11434 | 2026-08-15 | Internal mesh config |

---

## Known-stale beliefs — an agent will get these wrong

Each row is a real error that has already happened, or one that is likely given how
common the outdated form is. Where possible, add a matching entry to
`ai-guard.config.json` → `bannedPatterns` so the guard catches it mechanically.

| Common (wrong) belief | Current truth | Guarded by |
| --- | --- | --- |
| Using npm instead of yarn | Package manager is **yarn@1.17.3** (classic) | banned pattern in quality-check |
| Calling Ollama from sibling apps | Only Nora (`apps/nora`) may call Ollama directly | vendor-adapters.instructions.md, code-reviewer.agent.md |
| Using `pnpm` or `npm` for monorepo scripts | Use `yarn dev`, `yarn build`, `yarn test` (turborepo) | banned pattern in quality-check |

---

## Deliberately deferred

Technologies discussed but **not** in scope. Listing them stops an agent from helpfully
introducing one.

| Technology | Status | Note |
| --- | --- | --- |
| TypeScript migration | deferred | All apps are JavaScript; TS would require full rewrite |
| Monorepo workspace switch to pnpm | deferred | yarn workspaces + turbo is the current stack |
| External LLM providers (Anthropic, etc.) | deferred | Ollama is the primary AI runtime for now |

---

## Unverifiable

Things nobody could confirm. Say so rather than guessing.

- None currently