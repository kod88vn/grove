# Homework Progress — Grove Quests

> Tracks [HOMEWORK_PLAN.md](HOMEWORK_PLAN.md). Update this file in the same PR as the work.
> A box is ticked only when its acceptance check has been **run** and passed — paste the
> command in the Log, not a summary.

**Current phase:** 1 — engine + vertical slice (P1.1–P1.4 done; P1.5 built but not ticked — the twenty items are agent-drafted and no parent has reviewed them)
**Last updated:** 2026-09-27

## Totals

| Subject | Skills planned | Catalogued | Templates L1/L2/L3 | Property-tested | Played on iPad |
| --- | --- | --- | --- | --- | --- |
| Maths | 247 | 55 | 3 | 3 | 0 |
| English | 193 | 1 | 1 | 1 | 0 |
| **All** | **440** | **56** | **4** | **4** | **0** |

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
- [x] P0.6 F4 `/api/progress`, `/api/parent` missing — check reachability, fix or delete
- [x] P0.7 F5 library URL prefix mismatch — verify in browser, fix
- [x] P0.8 F6 math review shows only score — reproduce, fix if real
- [x] P0.9 Acceptance: 8 pm America/New_York submission shows under the right day

## Phase 1 — Engine + vertical slice (Grade 5)
- [x] P1.1 `packages/curriculum` scaffold (`type: module`, `exports: ./src/index.js`, `test: node --test`, like `packages/grove-shell`) + resolve-by-name smoke test
- [x] P1.2 `engine/rng.js`, `render.js`, `check.js`, `fraction.js` + tests
- [x] P1.3 Grade 5 maths catalog — 55 skills ported with `legacyId`
- [x] P1.4 Templates: `m5.nbt.long-multiplication`, `m5.nf.add-fractions-unlike`, `m5.oa.order-of-operations`
- [ ] P1.5 `e5.l.context-clues` with 20 reviewed items — **built, not reviewed.** The skill, the twenty items and the three templates exist and are property-tested; every item carries `reviewedBy: 'agent-draft:pending-parent-review'`. "Reviewed" in plan §6.8 means a person read it, so the box stays empty until a parent has read all twenty and the `reviewedBy` values say who.
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
- [ ] P8.2 Remove unused `SkillsLibrary`
- [ ] P8.3 Update `apps/homeworks/README.md` and grove `AGENTS.md`

## Log

Newest first. One entry per PR: date · PR · boxes ticked · verification command + result.

| Date | PR | Ticked | Verification |
| --- | --- | --- | --- |
| 2026-09-27 | (this PR) | **Nothing ticked.** P1.5 is built but its box stays empty, because the box says "20 **reviewed** items" and no person has read them. What exists: `catalog/english/grade-05.js` — one skill, `e5.l.context-clues`, strand `l`, `ccss: ['L.5.4.A']` (CCSS ELA codes are strand-first, unlike the grade-first maths codes in the sibling file), `legacyId: null` because nothing in `apps/nora/lib/skills-catalog.js` matches, `prerequisites: []`. `content/english/items/g05/context-clues.js` — a new `src/content/` tree for reviewed English content, holding twenty original cloze items: id naming the scene rather than the word, `difficulty` 1/2/3 split 7/7/6, a 12–35 word sentence with a single `____`, four single-word choices, a `clue` copied verbatim out of the sentence that at least one hint quotes, an explanation, and `source: 'original'`. Every item carries `reviewedBy: 'agent-draft:pending-parent-review'` — the literal truth, and the specs pin that exact string so no run can quietly put a person's name there. `problems/english/g05/context-clues.js` — three `cloze` templates, one per difficulty, picking from the items of their own difficulty with `rng.pick` and shuffling the four choices with `rng.shuffle`; `visual` is `{kind:'cloze', sentence, choices}` and the answer is `{blanks:[{accept:[word]}]}`. `engine/check.js` gains a `cloze` checker: per-blank accept lists, trimmed, whitespace-collapsed and case-insensitive, a malformed answer throwing `TypeError` before the response is read, any kid response graded rather than thrown. Two items of review judgement a property test could not make, each fixed through its own red spec rather than by hand: `storage-room` keyed `enormous` on a sentence about one shelf filling the space and leaving a narrow path — evidence for its own distractor `cramped`, so a child reasoning correctly would have been marked wrong (`context-clues.consistency.test.js` now rejects an item whose sentence carries a word from the opposite end of the answer's scale, and the lexicon is the place to record the next such finding); and the first templates prompted "Choose the word that matches this clue: …", handing over the very clue the skill asks the child to find (`context-clues.prompt.test.js` now requires the prompt to be one constant instruction per template, quoting neither clue, sentence nor choices). Review of the pull request then raised three more, handled the same way. `check.js` graded a sparse `blanks` array as correct — `check('cloze', {blanks:[{accept:['vivid']}]}, {blanks:new Array(1)})` returned `{correct:true, reason:null}`, because `some` and `every` skip array holes, so a child who submitted nothing was told they were right, and an answer key written with a hole passed the `TypeError` guard meant to catch it and then threw from inside the grader (`check.sparse.test.js`; the checker now walks every index by number, validates the key before looking at the response at all, and validates the whole response before grading any of it). `painted-wall` read "Mia moved ____" and keyed the adjective `cautious`, where the slot after an action verb wants `cautiously`, which is not among the four choices — so there was no right answer to pick; re-reading the other nineteen for that class found `beaded-costume`, the mirror image, whose fixed article in "had an ____ design" ruled out `simple`, `sudden` and `narrow` by grammar alone (`context-clues.grammar.test.js` carries a hand-written lexicon of every word the bank offers, requires all four choices to share the answer's part of speech, pins which slots an adjective may sit in, and rejects an `a`/`an` that only the answer agrees with; the two sentences became "Mia was ____ near wet paint…" and "had a very ____ design…"). And the 7/7/6 difficulty split lived only in the pull-request description while the spec asserted a floor of five per level, so a later 10/5/5 bank would have passed the suite while quietly loading the easy end (`context-clues.balance.test.js` writes the split down as literals). The Phase 2 `cloze` row stays unticked for the same reason `number`, `fraction` and `column` do: the checker and its tests are Phase 1 work, the row tracks the widget component. `src/index.js` is still untouched — `listSkills`/`listProblems` are P1.7's | `node --test` in `packages/curriculum`: 238/238, up from 168 (70 new tests across ten spec files, every one red before its implementation existed bar the last — loop runs 58, 59, 60, 61, 63, 64, 65, 66, 67, each green on iteration 1; four were referee re-arms after reading the output rather than the diff: run 61 for `storage-room`, run 64 for the giveaway prompt, run 66 because run 65's otherwise-correct hole fix validated and graded each blank in one pass and so answered `wrong` where the old code answered `invalid` for a child who got one box wrong and left the next empty — 3 of 7 probe rows drifted against the pre-fix file, 0 after — and run 62 was abandoned mid-flight because the spec itself was wrong — it expected `{reason: null}` from a wrong answer where `check.js` returns `{reason: 'wrong'}` — so the implementation was deleted and the corrected spec re-run red as run 63. `context-clues.balance.test.js` ran no loop: the bank is already 7/7/6, so no implementation change existed to make, and it was proved non-vacuous instead against a mutated 10/5/5 copy of the bank, which the old `>= 5` rule passes and it fails); `npx turbo run test --filter=@grove/curriculum`: exit 0, 1 successful; homeworks `TZ=UTC` and `TZ=America/New_York` `npx jest --ci --runInBand`: 26 suites, 111/111 each; `npx next build` in `apps/homeworks`: exit 0 |
| 2026-09-27 | #80 | P1.4 (`packages/curriculum/src/problems/math/g05/`: three template modules, nine templates, one per difficulty 1/2/3. `long-multiplication.js` — widget `column`, partial-products by place value: the top factor is split largest-first into its non-zero place values, `visual` carries `{kind:'column', operator:'×', operands, parts, partials}`, and both the hints and the explanation are generated from those same numbers so the method shown is the method taught; neither factor may contain a zero digit, which keeps `× 10` inside the separate `m5.nbt.multiply-powers-of-ten` skill and removes the `× 0 = 0` partials that the first loop shipped. Bands 2×1, 2×2, 3×2. `add-fractions-unlike.js` — widget `fraction`, answers reduced and flagged `simplest: true` so an unreduced response grades `not-simplest`; difficulty ladder is one denominator dividing the other (2..12), then coprime (2..10), then a shared factor with neither dividing (4..15); `visual` is `{kind:'fraction-sum', operator:'+', addends, lcd}` and the answer is recomputed in the test through the engine's own `fraction.js`. Sums above 1 are allowed; mixed numbers are `m5.nf.add-mixed-numbers`. `order-of-operations.js` — widget `number`, `visual` is `{kind:'expression', expression, steps}` where `steps` is a strictly-shortening chain that all evaluate to the same value; ladder is three operands with `×` second, then one bracketed group, then 4–5 operands with at least one always-exact `÷`. Every number on every line of working is 2..1000, which is what stops the degenerate `(1 - 1) × 20 = 0` and `3 + 1 × 2` that the fourth loop shipped green, and `answer.value` never equals a number already printed, so a hint can quote the first operation without giving the total away. `engine/check.js` gains one line routing `column` to the existing `number` checker — final-answer grading only; the per-digit half of plan §6.3 has no defined response shape and belongs to the Phase 2 `column (port)` row. All three modules are pure and import nothing, and `src/index.js` is still untouched — `listProblems` is P1.7's, per plan line 143) | `node --test` in `packages/curriculum`: 168/168, up from 97 (71 new tests across eight spec files, every one red before its implementation existed — loop runs 52–57, each green on iteration 1; two of the six were referee re-arms, run 53 after run 52 shipped `Split 110 into 110 and 0.` with a hint that split the top while the explanation split the bottom, and run 56 after run 55 shipped `(1 - 1) × 20`); `npx turbo run test --filter=@grove/curriculum`: exit 0, 1 successful; homeworks `TZ=UTC` and `TZ=America/New_York` `npx jest --ci --runInBand`: 26 suites, 111/111 each; `npx next build` in `apps/homeworks`: exit 0 |
| 2026-09-27 | #79 | P1.3 (`packages/curriculum/src/catalog/math/grade-05.js`: all 55 Grade 5 maths skills ported out of `apps/nora/lib/skills-catalog.js` as `m5.<strand>.<legacyId>`, with `legacyId` set to the old id and `name`/`label` carried over verbatim; strands follow plan §7 — nbt 24, nf 11, oa 10, md 8, g 2, with §7's "g / md", "oa / md" and "oa / g" pairs split per skill by the spec; `ccss` is drawn only from the 26 Grade 5 CCSS codes, and the off-grade `roman-numerals` and `data-analysis` are `ccss: []` with an off-grade note inside each object; `prerequisites` are ids from the same file, acyclic and never self-referencing. Pure: no import of any kind, no `Math.random`, `Date`, `performance.now`, `eval` or `new Function`. `src/index.js` is untouched — no P1.x box assigns `listSkills`/`getSkill`, so exporting the catalog waits for P1.4) | `node --test` in `packages/curriculum`: 97/97 (16 new tests in `catalog/math/grade-05.test.js` and `catalog/catalog.purity.test.js`, red before at 79 pass — the catalog module did not exist, green via loop run 49; a referee follow-up loop, run 50, added `catalog/math/grade-05.offgrade.test.js`, 1 test red before, because the only off-grade note sat 540 lines away from `roman-numerals`; a review follow-up on PR #79, loop run 51, added a case to `catalog/math/grade-05.test.js` pinning `5.MD.B.2` on every skill whose legacy description names line plots, 1 test red before, because `line-graphs` shipped `ccss: []` although its legacy description is "Read and create line plots, bar graphs, line graphs"); homeworks `TZ=UTC` and `TZ=America/New_York` `npx jest`: 26 suites, 111/111 each; `npx next build` in `apps/homeworks`: exit 0 |
| 2026-09-27 | #76 | P1.2 (`packages/curriculum/src/engine/`: `rng.js` mulberry32 with int32 state plus `int`/`pick`/`shuffle`; `fraction.js` exact safe-integer fractions (`parseFraction` keeps the fraction as written and returns null, never throws, on bad or oversized input; `equals` compares BigInt cross products; arithmetic computes in BigInt, reduces, and throws `RangeError` only if the reduced result is unsafe; the sign comes from the leading `-`, so `-0 1/2` is `-1/2` and a numerator is never `-0`); `check.js` `check(widget, answer, response)` for `choice`/`number`/`fraction`, where a malformed answer throws `TypeError` before the response is read and any kid response is graded, never thrown; `render.js` `render(template, seed)`. Pure: no `Math.random`, `Date`, `performance.now`, `eval`; sibling imports only) | `node --test` in `packages/curriculum`: 79/79 (6 new specs, red before; two referee follow-up loops added `check.untrusted.test.js` for overflow throws and answer-first validation, and corrected a `check.test.js` case that let an `Infinity` answer pass; a PR review follow-up loop added `fraction.review.test.js` for mixed-number sign handling and overflow-free intermediate products); `npx turbo run test --filter=@grove/curriculum`: 79 pass; homeworks `TZ=UTC` and `TZ=America/New_York` `npx jest`: 111/111 each; `npx next build` in `apps/homeworks`: exit 0 |
| 2026-09-27 | #74 | P1.1 (`packages/curriculum`: private ES module package `@grove/curriculum`, `exports: ./src/index.js`, `test: node --test`, no dependencies; `src/index.js` is an empty module naming the future exports. `apps/homeworks` depends on it as `"*"`, and yarn links it with `yarn.lock` unchanged) | `node --test` in `packages/curriculum`: 3/3 (`src/index.test.js`, red before with `ERR_MODULE_NOT_FOUND`); `npx turbo run test --filter=@grove/curriculum` from the root runs it; `TZ=UTC npx jest --ci --runInBand` and `TZ=America/New_York …` in `apps/homeworks`: 26 suites, 111/111 each (`lib/curriculum.resolve.test.js` red before with "Cannot find module", green via loop run 38); `npx next build` OK |
| 2026-09-27 | #72 | P0.9 (Phase 0 acceptance: rows saved at 8 pm New York time in real SQLite — EDT and EST, plus 23:59:59 and 00:00 on the New York midnight — are served to the page's own `?tz=` request by the real review route and render under the New York day. Test only; nothing to fix) | `TZ=UTC npx jest --ci --runInBand` and `TZ=America/New_York …` in `apps/homeworks`: 25 suites, 108/108 each; `app/review/page.acceptance.test.js` 2/2, and 2/2 red with the pre-F1 `route.js` and `page.js` (from `ec4f864^`) restored; `npx next build` OK |
| 2026-09-27 | #68 | P0.8 (F6: real — reproduced through the real grade route, SQLite and review route. `MathExercise` saves type `'mixed'` with problems `{problem, expectedAnswer}` and answers `{problems:[{id, answer}]}`, but `/review` rendered math only for type `'problem-set'` and read `prompt`/`answer`/`answers[idx]`; the math grader's `comment` was never kept as feedback. `/review` now reads the real shape for every math row and falls back to `details.comment` for rows already saved; `recordSubmission` keeps `comment` as feedback) | `TZ=UTC npx jest --ci --runInBand` and `TZ=America/New_York …` in `apps/homeworks`: 23 suites, 105/105 each (`app/review/page.math.test.js` 2/2 red before, green via loop run 33); `npx next build` OK |
| 2026-09-27 | #66 | P0.7 (F5: not a live bug — `apps/gateway/platformatic.json` and the grove dev rewrite both map `/api/*` to Nora `/chat/api/*`, and on a local dev stack the bare `/api/nora-homework/library?view=catalog` returned the same 200 JSON as `/chat/api/…`; `SkillsLibrary` now calls the canonical `/chat/api/nora-homework/library` like `MathExercise`, so it no longer depends on the catch-all alias) | `TZ=UTC npx jest --ci --runInBand` and `TZ=America/New_York …` in `apps/homeworks`: 22 suites, 103/103 each (`components/SkillsLibrary.prefix.test.js` 2/2 red before, green via loop run 31; it also guards that no homeworks source fetches a bare `/api/` path); `npx next build` OK |
| 2026-09-27 | #59 | P0.6 (F4: `ParentView.js` and `ProgressReview.js` deleted — nothing imported either, and the routes they fetched (`/api/parent`, `/homeworks/api/progress`) never existed; README now documents the real `/review` page and `GET /api/review`) | `TZ=UTC npx jest --ci --runInBand` and `TZ=America/New_York …` in `apps/homeworks`: 21 suites, 101/101 each (`components/fetchTargets.test.js` 3/3 red before, green via loop run 20; it also guards that every `/homeworks/api/<name>` fetch has a `route.js`); `npx next build` OK |
| 2026-09-27 | #58 | P0.5 (F3: `getDailyStats` deleted — `git grep` found no caller in `apps/` or `packages/`; it called the non-existent `Statement.first()` and divided ms as seconds) | `TZ=UTC npx jest --ci --runInBand` and `TZ=America/New_York …` in `apps/homeworks`: 20 suites, 98/98 each (`lib/db.exports.test.js` 2/2 red before, green via loop run 18); `npx next build` OK |
| 2026-09-27 | #56 | P0.4 (F2: submission and reading ids use `crypto.randomUUID()` instead of `Date.now()`, so same-millisecond saves no longer hit the PRIMARY KEY) | `TZ=UTC npx jest --ci --runInBand` and `TZ=America/New_York …` in `apps/homeworks`: 19 suites, 96/96 each (`lib/progress.ids.test.js` 3/3 red before — `UNIQUE constraint failed` — green via loop run 16, real in-memory SQLite); `npx next build` OK |
| 2026-09-27 | #53 | P0.3 (F1: review page sends its IANA `tz`; `/api/review` buckets by local day, DST-aware, 400 on unknown zone) | `TZ=UTC npx jest --ci --runInBand` and `TZ=America/New_York …` in `apps/homeworks`: 16 suites, 87/87 each (5 new tests red before the fix; PR review follow-up GROVE-P03b: `lib/localDay.transitions.test.js` 12/19 red → green via loop run 14 — midnight DST changes and impossible dates); `npx next build` OK |
| 2026-09-27 | #52 | P0.2 (AGENTS.md Homeworks: D1 avatar profiles with `'public'` default, D2 content as code) | `git diff --stat origin/master` — docs only; `grep -n "D1\|D2" AGENTS.md` |
| 2026-09-27 | #49 | Plan fixes from #45 and #49 reviews: exact expression check (non-zero denominators), `public` seed, 2-segment problem route, POST `/hints`, `studentId` on sessions, server-issued seeds bound to `session_items`, server-side tries/hints, package `exports` + `node --test`, drafting tool outside package with `.gitignore` entry | `git diff --stat origin/master` — docs only |
| 2026-09-27 | #48 | CI merge gate: bot approval on head, no open threads or change requests | `node --test .github/scripts` 10/10; gate passed on `e60d1c6` before merge |
| 2026-09-27 | #45 | Plan + tracker merged (with 8 open Copilot findings, which led to #48) | pr-ci SUCCESS on `29afcc0` |
| 2026-09-26 | — | P0.1 (D1–D7 decided) | — |
| 2026-09-26 | — | Plan written | — |
