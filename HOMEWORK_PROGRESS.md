# Homework Progress — Grove Quests

> Tracks [HOMEWORK_PLAN.md](HOMEWORK_PLAN.md). Update this file in the same PR as the work.
> A box is ticked only when its acceptance check has been **run** and passed — paste the
> command in the Log, not a summary.

**Current phase:** 0 — decisions made and applied to AGENTS.md, defects not started
**Last updated:** 2026-09-27

## Totals

| Subject | Skills planned | Catalogued | Templates L1/L2/L3 | Property-tested | Played on iPad |
| --- | --- | --- | --- | --- | --- |
| Maths | 247 | 0 | 0 | 0 | 0 |
| English | 193 | 0 | 0 | 0 | 0 |
| **All** | **440** | **0** | **0** | **0** | **0** |

## Decisions

All resolved 2026-09-26.

| # | Question | Decision |
| --- | --- | --- |
| D1 | Kid profiles vs `student_id='public'` rule | Avatar picker, no auth, data public, `'public'` stays default profile |
| D2 | Where content lives | Code in `packages/curriculum`; attempts in SQLite |
| D3 | Maths grading | Deterministic code checkers; Nora only for writing rubrics |
| D4 | Skills library data | Move to homeworks SQLite, migrate by `legacyId` |
| D5 | Maths rendering and drag | KaTeX + custom pointer drag |
| D6 | Curriculum framework | US Common Core (CCSS) |
| D7 | Sounds default | On for G1–5, off for G6–12, parent-toggleable |

## Phase 0 — Hygiene and decisions
- [x] P0.1 Resolve D1–D7
- [x] P0.2 Update grove `AGENTS.md` Homeworks section for D1 (profiles) and D2 (content as code)
- [x] P0.3 F1 UTC day bucketing — failing test, fix, pass
- [x] P0.4 F2 submission id collision — failing test, fix, pass
- [x] P0.5 F3 `getDailyStats` `.first()` — check callers, fix or delete (no callers: deleted)
- [ ] P0.6 F4 `/api/progress`, `/api/parent` missing — check reachability, fix or delete
- [ ] P0.7 F5 library URL prefix mismatch — verify in browser, fix
- [ ] P0.8 F6 math review shows only score — reproduce, fix if real
- [ ] P0.9 Acceptance: 8 pm America/New_York submission shows under the right day

## Phase 1 — Engine + vertical slice (Grade 5)
- [ ] P1.1 `packages/curriculum` scaffold (`type: module`, `exports: ./src/index.js`, `test: node --test`, like `packages/grove-shell`) + resolve-by-name smoke test
- [ ] P1.2 `engine/rng.js`, `render.js`, `check.js`, `fraction.js` + tests
- [ ] P1.3 Grade 5 maths catalog — 55 skills ported with `legacyId`
- [ ] P1.4 Templates: `m5.nbt.long-multiplication`, `m5.nf.add-fractions-unlike`, `m5.oa.order-of-operations`
- [ ] P1.5 `e5.l.context-clues` with 20 reviewed items
- [ ] P1.6 Tables `students` (+ idempotent `public` seed), `practice_sessions`, `session_items`, `attempts` + `lib/db.js` tests
- [ ] P1.7 APIs `/students`, `/problems`, `/problems/:skill/:template`, `/sessions`, `/sessions/:id/items`, `/hints`, `/attempts` (server-issued seeds, tries/hints server-side, 409 on unbound seed)
- [ ] P1.8 Solve page + session runner (Check ✅, stars, "How Nora solved it")
- [ ] P1.9 Acceptance: answer absent from payload before solve; review shows every problem + answer

## Phase 2 — Widgets and kid UX
| Widget | Band | Component | Checker | Tests |
| --- | --- | --- | --- | --- |
| choice / multi-choice | A | [ ] | [ ] | [ ] |
| number + pad | A | [ ] | [ ] | [ ] |
| order | A | [ ] | [ ] | [ ] |
| sort | A | [ ] | [ ] | [ ] |
| match | A | [ ] | [ ] | [ ] |
| clock | A | [ ] | [ ] | [ ] |
| coins | A | [ ] | [ ] | [ ] |
| audio-spell | A | [ ] | [ ] | [ ] |
| tap-select | A–D | [ ] | [ ] | [ ] |
| cloze | B | [ ] | [ ] | [ ] |
| column (port) | B | [ ] | [ ] | [ ] |
| fraction / fraction-bar / number-line | B | [ ] | [ ] | [ ] |
| text | B | [ ] | [ ] | [ ] |
| table-fill | C | [ ] | [ ] | [ ] |
| expression (exact polynomial/rational + form checks) | C–D | [ ] | [ ] | [ ] |
| graph | C–D | [ ] | [ ] | [ ] |
| steps | D | [ ] | [ ] | [ ] |
| free-response (Nora rubric) | B–D | [ ] | [ ] | [ ] |

- [ ] P2.1 🔊 read-aloud (`speechSynthesis`)
- [ ] P2.2 Maths keypad (fraction, exponent, √, π)
- [ ] P2.3 Feedback animations, reduced motion, sounds toggle, dyslexia font
- [ ] P2.4 D5 installed and version pinned
- [ ] P2.5 Acceptance: `/homeworks/dev/widgets` gallery renders every widget

## Phase 3 — Game layer
- [ ] P3.1 "Who's practicing?" + Today screen
- [ ] P3.2 Daily Seed
- [ ] P3.3 Watering-days streak with rain days + weekly goal
- [ ] P3.4 Stars, Sunshine, badges
- [ ] P3.5 Grove view (seed → fruiting)
- [ ] P3.6 Quest Board with filters + 🎲
- [ ] P3.7 End-of-session card
- [ ] P3.8 Acceptance: siblings share Daily Seed on same date/grade, differ across dates

## Phase 4 — Mastery
- [ ] P4.1 `skill_state` + `rebuildSkillState`
- [ ] P4.2 Difficulty ladder
- [ ] P4.3 Stages and Leitner review
- [ ] P4.4 `/next`, `/garden`
- [ ] P4.5 Paths + boss problems
- [ ] P4.6 Acceptance: scripted attempts drive seed → fruiting and back on a missed review

## Phase 5 — Maths content

Each cell: `built/planned`. "Built" = meets the plan's §9 definition of done.

| Grade | Batch | OA | NBT | NF | MD | G | RP | NS | EE | F | SP | Course | Total |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 1 | 5c | 0/6 | 0/5 | | 0/3 | 0/2 | | | | | | | 0/16 |
| 2 | 5c | 0/4 | 0/6 | | 0/4 | 0/2 | | | | | | | 0/16 |
| 3 | 5b | 0/6 | 0/3 | 0/4 | 0/5 | 0/1 | | | | | | | 0/19 |
| 4 | 5b | 0/4 | 0/5 | 0/7 | 0/4 | 0/2 | | | | | | | 0/22 |
| 5 | P1 + 5a | | | | | | | | | | | legacy A–L | 0/55 |
| 6 | 5d | | | | | 0/3 | 0/4 | 0/7 | 0/6 | | 0/4 | | 0/24 |
| 7 | 5d | | | | | 0/4 | 0/4 | 0/4 | 0/4 | | 0/4 | | 0/20 |
| 8 | 5d | | | | | 0/6 | | 0/2 | 0/6 | 0/4 | 0/3 | | 0/21 |
| 9 | 5e | | | | | | | | | | | Algebra I 0/14 | 0/14 |
| 10 | 5e | | | | | | | | | | | Geometry 0/13 | 0/13 |
| 11 | 5e | | | | | | | | | | | Algebra II 0/13 | 0/13 |
| 12 | 5e | | | | | | | | | | | Precalc/Stats 0/14 | 0/14 |

Grade 5 legacy categories (55):

| A | B | C | D | E | F | G | H | I | J | K | L |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 0/3 | 0/3 | 0/4 | 0/5 | 0/11 | 0/9 | 0/2 | 0/5 | 0/3 | 0/4 | 0/3 | 0/3 |

- [ ] P5.x Switch Math tab to new engine (after 5a)
- [ ] P5.y Retire LLM `math/mixed` + Nora `skills-catalog.js`; migrate library rows by `legacyId`

## Phase 6 — English content

| Grade | Batch | RF | RL | RI | L | W | Spell | Research | Test | Life | Total | Passages reviewed |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 1 | 6c | 0/6 | 0/2 | 0/1 | 0/4 | 0/1 | 0/1 | | | | 0/15 | 0 |
| 2 | 6c | 0/4 | 0/3 | 0/2 | 0/6 | 0/1 | 0/1 | | | | 0/17 | 0 |
| 3 | 6b | 0/1 | 0/4 | 0/4 | 0/9 | 0/1 | 0/1 | | | | 0/20 | 0 |
| 4 | 6b | | 0/4 | 0/4 | 0/10 | 0/2 | 0/1 | | | | 0/21 | 0 |
| 5 | P1 + 6a | | 0/6 | 0/4 | 0/9 | 0/3 | | | | | 0/22 | 0 |
| 6 | 6d | | 0/4 | 0/2 | 0/7 | 0/3 | | 0/1 | | | 0/17 | 0 |
| 7 | 6d | | 0/4 | 0/3 | 0/6 | 0/3 | | 0/1 | | | 0/17 | 0 |
| 8 | 6d | | 0/5 | 0/2 | 0/5 | 0/3 | | 0/1 | | | 0/16 | 0 |
| 9 | 6e | | 0/5 | 0/2 | 0/5 | 0/2 | | | | | 0/14 | 0 |
| 10 | 6e | | 0/3 | 0/3 | 0/3 | 0/2 | | | | | 0/11 | 0 |
| 11 | 6e | | 0/3 | 0/2 | 0/3 | 0/2 | | | 0/2 | | 0/12 | 0 |
| 12 | 6e | | 0/2 | 0/2 | 0/2 | 0/3 | | | | 0/2 | 0/11 | 0 |

- [ ] P6.1 `scripts/curriculum/draft-english.mjs` at repo root (via Nora HTTP, drafts only, outside the package) + `scripts/curriculum/drafts/` in root `.gitignore`
- [ ] P6.2 Dev content-review page + approve flow (`reviewedBy`)
- [ ] P6.3 `engine/readability.js` + readability test gate
- [ ] P6.4 Nora `type: 'rubric'` grading with grade-level parameter
- [ ] P6.x Switch English tab to new engine (after 6a); retire live passage generation for kids

## Phase 7 — Parents and polish
- [ ] P7.1 Review page: per-kid, per-skill filters and trends
- [ ] P7.2 CSV export
- [ ] P7.3 Placement sampler per grade
- [ ] P7.4 Per-kid settings
- [ ] P7.5 Weekend Challenge (G6+, family board)

## Phase 8 — Retire old surfaces
- [ ] P8.1 Redirect `/homeworks/library` → `/homeworks/grove`
- [ ] P8.2 Remove unused `SkillsLibrary`, `ParentView`, `ProgressReview`
- [ ] P8.3 Update `apps/homeworks/README.md` and grove `AGENTS.md`

## Log

Newest first. One entry per PR: date · PR · boxes ticked · verification command + result.

| Date | PR | Ticked | Verification |
| --- | --- | --- | --- |
| 2026-09-27 | (this PR) | P0.5 (F3: `getDailyStats` deleted — `git grep` found no caller in `apps/` or `packages/`; it called the non-existent `Statement.first()` and divided ms as seconds) | `TZ=UTC npx jest --ci --runInBand` and `TZ=America/New_York …` in `apps/homeworks`: 20 suites, 98/98 each (`lib/db.exports.test.js` 2/2 red before, green via loop run 18); `npx next build` OK |
| 2026-09-27 | #56 | P0.4 (F2: submission and reading ids use `crypto.randomUUID()` instead of `Date.now()`, so same-millisecond saves no longer hit the PRIMARY KEY) | `TZ=UTC npx jest --ci --runInBand` and `TZ=America/New_York …` in `apps/homeworks`: 19 suites, 96/96 each (`lib/progress.ids.test.js` 3/3 red before — `UNIQUE constraint failed` — green via loop run 16, real in-memory SQLite); `npx next build` OK |
| 2026-09-27 | #53 | P0.3 (F1: review page sends its IANA `tz`; `/api/review` buckets by local day, DST-aware, 400 on unknown zone) | `TZ=UTC npx jest --ci --runInBand` and `TZ=America/New_York …` in `apps/homeworks`: 16 suites, 87/87 each (5 new tests red before the fix; PR review follow-up GROVE-P03b: `lib/localDay.transitions.test.js` 12/19 red → green via loop run 14 — midnight DST changes and impossible dates); `npx next build` OK |
| 2026-09-27 | #52 | P0.2 (AGENTS.md Homeworks: D1 avatar profiles with `'public'` default, D2 content as code) | `git diff --stat origin/master` — docs only; `grep -n "D1\|D2" AGENTS.md` |
| 2026-09-27 | #49 | Plan fixes from #45 and #49 reviews: exact expression check (non-zero denominators), `public` seed, 2-segment problem route, POST `/hints`, `studentId` on sessions, server-issued seeds bound to `session_items`, server-side tries/hints, package `exports` + `node --test`, drafting tool outside package with `.gitignore` entry | `git diff --stat origin/master` — docs only |
| 2026-09-27 | #48 | CI merge gate: bot approval on head, no open threads or change requests | `node --test .github/scripts` 10/10; gate passed on `e60d1c6` before merge |
| 2026-09-27 | #45 | Plan + tracker merged (with 8 open Copilot findings, which led to #48) | pr-ci SUCCESS on `29afcc0` |
| 2026-09-26 | — | P0.1 (D1–D7 decided) | — |
| 2026-09-26 | — | Plan written | — |
