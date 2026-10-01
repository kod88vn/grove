# Homework Plan — "Grove Quests": English & Maths, Grades 1–12

> Status: **plan, not started** (written 2026-09-26). Progress lives in
> [HOMEWORK_PROGRESS.md](HOMEWORK_PROGRESS.md). This file is the source of truth for *what*
> gets built; the progress file tracks *how far along* it is.

## 1. The idea in one paragraph

Turn `apps/homeworks` from "Nora generates one Grade 5 worksheet, Nora grades it" into a
**LeetCode-style practice bank for kids**: a catalog of named, tagged, difficulty-rated
problems for English and Maths across Grades 1–12. A kid picks (or is handed) a problem,
answers it in a purpose-built widget, gets **instant** right/wrong feedback, can take hints,
sees a worked solution ("How Nora solved it"), and grows a garden — every skill is a tree in
their grove. Parents see exactly what was asked and what the kid answered, by the kid's own
local day.

## 2. What exists today (read 2026-09-26, `master` @ `754ac58`)

| Thing | Where | Notes |
| --- | --- | --- |
| Homeworks app | `apps/homeworks` | Next `^16.2.4`, React `^19.2.5`, Tailwind `^3.4.14`, Jest `^29.7.0`, `better-sqlite3 ^11.6.0` (root `resolutions` forces `^12.9.0`). `basePath: '/homeworks'`, dev port 3005 |
| Home page | `apps/homeworks/app/page.js` | Two tabs (English / Math), subtitle hard-codes "Grade 5" |
| English reading | `components/EnglishExercise.js` | Domain picker (`/chat/api/nora-homework/topics`), passage + 3 questions, history |
| Math quiz | `components/MathExercise.js` | 10 problems, column-method grid (add/sub/long mult/long div), batch submit |
| Generation | `apps/nora/app/api/nora-homework/exercise/route.js` | Ollama via `callAI`, JSON-schema output, **Grade 5 hard-coded** in every prompt |
| Grading | `apps/nora/app/api/nora-homework/grade/route.js` | **LLM grades arithmetic** (math `mixed`), reading, writing |
| Math catalog | `apps/nora/lib/skills-catalog.js` | Grade 5 only, 12 categories A–L, **55 skills** |
| Skills library | `apps/nora/app/api/nora-homework/library/route.js` → `@/lib/db/skills-library` | Stored in **Nora's** DB, not homeworks' |
| Persistence | `apps/homeworks/lib/db.js`, `lib/progress.js` | SQLite, tables `submissions`, `readings`, `student_id='public'` |
| API | `app/api/{exercises,grade,reading-history,review}/route.js` | No `progress` or `parent` route exists |
| Review page | `app/review/page.js` | Last 30 days, grouped by day |
| Routing | `apps/gateway/platformatic.json` (`/homeworks`, `/library`), `apps/grove/next.config.js` rewrites | Everything below lives under `/homeworks/*`, so **no new gateway or rewrite entries are needed** |

### Defects found while reading (fix in Phase 0)

| # | Defect | Evidence |
| --- | --- | --- |
| F1 | Day bucketing is UTC, so an east-coast evening submission lands on the next day | `app/api/review/route.js` groups by `s.date.split('T')[0]` where `date` is `toISOString()`; `lib/progress.js` `getSubmissionsForDay` uses `dayStr + 'T00:00:00Z'` |
| F2 | Submission ids collide inside one millisecond (PRIMARY KEY violation) | `lib/progress.js`: `` id = `${subject}-${Date.now()}` `` |
| F3 | `getDailyStats` calls `.first(...)`, which is not a `better-sqlite3` Statement method (`run/get/all/iterate`) | `lib/db.js` `getDailyStats`. Reachability **UNKNOWN** — grep callers before fixing |
| F4 | `ProgressReview` fetches `/homeworks/api/progress`; `ParentView` fetches `/api/parent` — neither route exists | component `fetch` lines vs. `app/api/` listing. Reachability **UNKNOWN** |
| F5 | `SkillsLibrary` fetches `/api/nora-homework/library` (no `/chat` prefix) while `MathExercise` posts to `/chat/api/nora-homework/library` | component `fetch` lines. Whether the gateway serves the unprefixed path is **UNKNOWN** — verify in a browser |
| F6 | Math review shows only a score, not the problems/answers | Previously reported, **ASSUMED**, not reproduced |

## 3. Principles

1. **Instant and correct beats clever.** Maths is generated and graded **deterministically in
   code** (seeded templates + checkers). No LLM call on the path of a maths problem — no 60 s
   `HOMEWORKS_NORA_TIMEOUT_MS` wait, no LLM mis-grading `24 × 38`.
2. **LLMs author, humans approve, kids see approved content.** English passages and items are
   drafted with Nora offline, reviewed by a parent, and committed. Kids never see an
   unreviewed generated passage.
3. **Nora only where judgment is needed**: grading free-response writing against a rubric, and
   (later) an "Ask Nora" hint. If Nora fails, the kid sees "Nora couldn't read this right now —
   try again", never a fake score (grove AGENTS.md: *No Silent Failures*, *Prompt Failure
   Handling Policy*).
4. **Keep Nora thin** (grove AGENTS.md directive 3). The curriculum, generators, checkers and
   the skills library live outside Nora.
5. **The server holds the answer.** The client receives the prompt, never the answer, until the
   problem is solved or revealed. Kid input is **never** `eval`'d.
6. **Short sessions, gentle failure.** 5–10 problems, ~10 minutes. "Almost! Try again" — not a
   wall of red Xs.
7. **Reproducible.** Every attempt stores `problem_id + seed + content_version` **and** a
   snapshot of what was shown, so the review page can show exactly what the kid saw.

## 4. LeetCode → kid mapping

| LeetCode | Grove Quests | Notes |
| --- | --- | --- |
| Problem list with filters | **Quest Board** — cards (G1–5) / table (G6–12), filter chips: grade, topic, difficulty, status, 🎲 random | |
| Easy / Medium / Hard | 🌱 Sprout / 🌿 Sapling / 🌳 Tree (1–3 leaves) | `difficulty: 1 \| 2 \| 3` |
| Solved / Attempted / Todo | ✅ / 🟡 / ⚪ | per student |
| Run / Submit | **Check ✅** — per problem, instant | not batch-submit like today's 10-question quiz |
| Hints | 💡 up to 3 progressive hints | using one costs a star, never blocks |
| Editorial | **"How Nora solved it"** worked solution | unlocked after solve or 2 wrong tries |
| Similar questions | "Try another like this" — same template, new seed | infinite practice for maths |
| Daily challenge | **Daily Seed** — one problem per grade per day, seed = local date | same for siblings in the same grade |
| Streak | **Watering days** with 2 "rain days" per week (streak freeze) + weekly goal | avoids streak anxiety |
| Study plans | **Paths** (e.g. "Times Table Trek", "Fraction Forest") ending in a 👑 boss problem | |
| Submissions | **Review** page (parent) | existing page, extended |
| Contest / rating | **Weekend Challenge** (opt-in, G6+) — family board only, no public leaderboard | Phase 7+ |

## 5. Kid experience

### 5.1 Game layer — "your grove"

- Each skill is a tree that grows through mastery states:
  🌰 **seed** (never tried) → 🌱 **sprout** (tried) → 🌿 **sapling** (≥60% recent) →
  🌳 **tree** (mastered) → 🍎 **fruiting** (mastered **and** passed a spaced review).
- **Stars per problem**: ⭐⭐⭐ first try, no hint · ⭐⭐ hint or second try · ⭐ solved
  eventually · no stars after "show me how" (but the follow-up "try another" can earn them).
- **Sunshine ☀️** = stars earned; spent only on cosmetic garden decorations. No real money,
  no ads, no loot boxes.
- **Badges** per path/milestone ("Times Table Tamer", "Comma Commander", "Pythagoras Pal").
- **Nora mascot** reacts to results. User-facing text always says "Nora", never "AI"
  (grove AGENTS.md naming rule).
- End-of-session card: stars, trees that grew (animated), next suggestion. Sounds and
  confetti are parent-toggleable; respect `prefers-reduced-motion`.

### 5.2 Ease of use, by grade band

| Band | Grades | Input | Session | Presentation |
| --- | --- | --- | --- | --- |
| A | 1–2 | Tap / drag only, on-screen number pad, **no typing required** | 5 problems | 🔊 read-aloud auto-offered on every prompt, pictures/emoji, ≥56 px targets |
| B | 3–5 | Number pad, column grid, short typing | 8 problems | 🔊 button, friendly illustrations |
| C | 6–8 | Keyboard + maths keypad (fraction, exponent, √, π) | 10 problems | KaTeX-rendered maths |
| D | 9–12 | Expression input, graph plotting, multi-step | 10 problems or free play | Cleaner, LeetCode-like list; ratings and speed-runs replace cartoons |

Common to all bands:

- **"Who's practicing?"** avatar picker on open (no password — see D1).
- **Today** screen: one big button (**Continue** or **Daily Seed**) plus two suggested skills.
- Read-aloud uses the browser's `speechSynthesis`; no server, no Nora call.
- Tablet-first layout (iPad portrait), keyboard-accessible, high-contrast and
  dyslexia-friendly font options in settings.

## 6. Architecture

### 6.1 New package: `packages/curriculum` (`@grove/curriculum`)

Pure JS, no React, no DB, no network. Imported by `apps/homeworks` server routes (generate,
check) and by UI (catalog metadata only). Root `package.json` already has `"workspaces":
["packages/*", "apps/*"]`, so it is picked up automatically.

Package setup: `"type": "module"`, `"exports": { ".": "./src/index.js" }` and
`"test": "node --test"`, the same runner `packages/grove-shell` uses, with no test
dependencies. The explicit `exports` entry is required: without it Node looks for a root
`index.js` and `import '@grove/curriculum'` from `apps/homeworks` fails. P1.1 includes a
smoke test that the package resolves by name. (`packages/crossword` has no test setup, so
it is not the model.) Tests sit next to their modules as `src/**/*.test.js`, and turbo's
`test` task picks them up.

The Nora drafting tool is **not** part of this package. It calls the network, so it lives
at the repo root in `scripts/curriculum/draft-english.mjs` (§10 Phase 6) and writes to
`scripts/curriculum/drafts/`. The root `.gitignore` has no rule for that path today, so
P6.1 adds `scripts/curriculum/drafts/` to it in the same PR as the script. Nothing under
`packages/curriculum` makes a network call.

```
packages/curriculum/
  package.json                     @grove/curriculum
  src/
    index.js                       listSkills, getSkill, listProblems, render, check, hint
    engine/
      rng.js                       seeded PRNG (mulberry32) — same seed, same problem
      render.js                    template + seed -> { prompt, visual, widget, answer, hints, explanation }
      check.js                     one checker per widget type
      expr.js                      tiny expression parser (shunting-yard) — NO eval / new Function
      poly.js                      exact polynomial normal form over fractions (expression checker)
      fraction.js                  parse "3/4", "1 1/2", simplest-form test
      readability.js               Flesch–Kincaid grade estimate (English content tests)
    catalog/
      math/grade-01.js … grade-12.js      strands + skills metadata
      english/grade-01.js … grade-12.js
    problems/
      math/g01/<skill>.js …        templates with generate(rng)
      english/g01/<skill>.js …     templates over reviewed item banks
    content/
      english/passages/g01/*.js    reviewed passages (original or public domain only)
```

### 6.2 Identifiers and shapes

- Skill id: `<m|e><grade>.<strand>.<slug>` — e.g. `m3.oa.mult-facts`, `e4.l.idioms-proverbs`.
- Problem id: `<skill-id>/<template-slug>` — e.g. `m3.oa.mult-facts/missing-factor`.
  **Ids are never reused**; retire with `retired: true`.
- Standards: `ccss: ['3.OA.C.7']` (alignment framework, see D6).

```js
// skill (catalog)
{ id: 'm3.oa.mult-facts', grade: 3, subject: 'math', strand: 'oa',
  name: 'Times Tables to 10×10', label: '✖️ Times Tables', ccss: ['3.OA.C.7'],
  prerequisites: ['m3.oa.mult-meaning'], legacyId: null }

// problem template
{ id: 'm3.oa.mult-facts/missing-factor', skill: 'm3.oa.mult-facts',
  title: 'Mystery Factor', difficulty: 2, widget: 'number', version: 1,
  generate(rng) {
    const a = rng.int(2, 10), b = rng.int(2, 10)
    return {
      prompt: `? × ${b} = ${a * b}`,
      answer: { value: a },
      hints: [`Count by ${b}s until you reach ${a * b}.`, `${a * b} ÷ ${b} = ?`],
      explanation: `${a} × ${b} = ${a * b}, so the mystery factor is ${a}.`,
    }
  } }
```

Static (English) templates pick from a reviewed item bank with `rng.pick(items)`; each item
carries `reviewedBy` and `source: 'original' | 'public-domain:<title>'`.

### 6.3 Answer widgets (`apps/homeworks/components/widgets/`)

One component + one checker per type. Built in the order the grade bands need them.

| Widget | Used for | Checker | Band |
| --- | --- | --- | --- |
| `choice` / `multi-choice` | everything | exact id match | A |
| `number` (+ on-screen pad) | arithmetic, measurement | numeric equality, optional tolerance | A |
| `order` (drag or tap-to-order) | sequence events, sentence scramble, proof steps | sequence equality | A |
| `sort` (buckets) | nouns vs verbs, even vs odd, shapes | set equality per bucket | A |
| `match` (pairs) | synonyms, word↔picture, fraction↔decimal | pair set equality | A |
| `clock` | telling time | hh:mm equality | A |
| `coins` | money | total value | A |
| `audio-spell` | spelling (speaks the word) | normalized string | A |
| `tap-select` | find the verb, find the evidence sentence | token/sentence id set | A–D |
| `cloze` | grammar, vocabulary in context | per-blank accept list | B |
| `column` | add/sub/mult/div (**port existing grid** from `MathExercise.js`) | final answer + per-digit rows | B |
| `fraction` / `fraction-bar` / `number-line` | fractions, decimals, integers | value equality + optional simplest form | B |
| `text` | short answers with a closed accept list | normalized match | B |
| `table-fill` | ratio tables, function tables | per-cell numeric | C |
| `expression` | algebra | **exact** equivalence (see below) **plus** form check (e.g. "factored") | C–D |
| `graph` (SVG coordinate plane) | plot points, lines, parabolas | points / slope-intercept within tolerance | C–D |
| `steps` | multi-step equations, proofs | each step checked in order | D |
| `free-response` | writing | Nora rubric (1–4 per criterion) | B–D |

**Expression equivalence must be exact, not sampled.** Checking an answer at a few random
points is not sound: two different expressions can agree on every sampled point, and a
wrong answer would get credit. So the checker supports only grammars it can decide:

- `grammar: 'polynomial'`: `+ − × ÷` by a constant, integer powers, and variables, with
  rational coefficients. `poly.js` expands both sides to a canonical sorted-monomial form
  with `fraction.js` coefficients and compares them for exact equality.
- `grammar: 'rational'`: first reduce both denominators to canonical form and **reject**
  the answer if either `Q1` or `Q2` is the zero polynomial (e.g. `0/(x-x)` is undefined,
  and would otherwise pass the cross-product test against anything). Then
  `P1/Q1 ≡ P2/Q2` iff `P1·Q2 = P2·Q1` as polynomials. Domain restrictions (for example
  `x ≠ 1`) are still asked as a separate `number` or `choice` step, because
  rational-function equality ignores them.

Every `expression` template must declare one of these two grammars, and a catalog test
fails any template that does not. Skills that need radicals, exponentials, logs or trig in
the answer use `choice`, `number` or `steps` with fixed canonical forms instead of
free-form `expression`.

### 6.4 Data model (additions to `apps/homeworks/lib/db.js`; existing tables untouched)

```sql
CREATE TABLE IF NOT EXISTS students (
  id TEXT PRIMARY KEY,                       -- 'public' is seeded below for backward compatibility
  display_name TEXT NOT NULL,
  avatar TEXT NOT NULL,
  grade INTEGER NOT NULL CHECK (grade BETWEEN 1 AND 12),
  settings_json TEXT NOT NULL DEFAULT '{}',  -- sounds, font, read-aloud, tz
  created_at INTEGER NOT NULL DEFAULT (unixepoch())
);
-- Idempotent seed, run on every open, so fresh and existing databases both have the default
-- profile before any session or attempt references it. Grade 5 matches today's only user.
INSERT OR IGNORE INTO students (id, display_name, avatar, grade)
  VALUES ('public', 'Explorer', '🌱', 5);

CREATE TABLE IF NOT EXISTS practice_sessions (
  id TEXT PRIMARY KEY,
  student_id TEXT NOT NULL REFERENCES students(id),
  kind TEXT NOT NULL CHECK (kind IN ('daily','skill','review','path','free')),
  skill_id TEXT,
  local_date TEXT NOT NULL,                  -- 'YYYY-MM-DD' in the kid's timezone (fixes F1 by construction)
  tz TEXT NOT NULL,                          -- IANA name from Intl.DateTimeFormat
  started_at INTEGER NOT NULL DEFAULT (unixepoch()),
  finished_at INTEGER
);

-- Server-side counters for one problem instance inside a session. The server creates the
-- row and picks the seed (POST /sessions/:id/items); the client never chooses a seed and
-- never sends tries or hints. /attempts and /hints increment these rows, and the final
-- attempt row copies them. That way stars and mastery cannot be inflated from the browser.
CREATE TABLE IF NOT EXISTS session_items (
  session_id TEXT NOT NULL REFERENCES practice_sessions(id),
  problem_id TEXT NOT NULL,
  seed INTEGER NOT NULL,
  tries INTEGER NOT NULL DEFAULT 0,
  hints_used INTEGER NOT NULL DEFAULT 0,
  revealed INTEGER NOT NULL DEFAULT 0,
  done INTEGER NOT NULL DEFAULT 0 CHECK (done IN (0,1)),
  PRIMARY KEY (session_id, problem_id, seed)
);

CREATE TABLE IF NOT EXISTS attempts (
  id TEXT PRIMARY KEY,                       -- crypto.randomUUID() (fixes F2 class)
  session_id TEXT REFERENCES practice_sessions(id),
  student_id TEXT NOT NULL REFERENCES students(id),
  subject TEXT NOT NULL CHECK (subject IN ('math','english')),
  grade INTEGER NOT NULL,
  skill_id TEXT NOT NULL,
  problem_id TEXT NOT NULL,
  content_version INTEGER NOT NULL,
  seed INTEGER NOT NULL,
  difficulty INTEGER NOT NULL CHECK (difficulty BETWEEN 1 AND 3),
  shown_json TEXT NOT NULL,                  -- snapshot of prompt/visual (fixes F6 class)
  response_json TEXT NOT NULL,
  answer_json TEXT NOT NULL,
  correct INTEGER NOT NULL CHECK (correct IN (0,1)),
  tries INTEGER NOT NULL CHECK (tries >= 1),
  hints_used INTEGER NOT NULL DEFAULT 0,
  revealed INTEGER NOT NULL DEFAULT 0,
  stars INTEGER NOT NULL CHECK (stars BETWEEN 0 AND 3),
  rubric_json TEXT,                          -- free-response only
  duration_ms INTEGER,
  local_date TEXT NOT NULL,
  created_at INTEGER NOT NULL DEFAULT (unixepoch())
);
CREATE INDEX IF NOT EXISTS idx_attempts_student_date ON attempts(student_id, local_date DESC);
CREATE INDEX IF NOT EXISTS idx_attempts_student_skill ON attempts(student_id, skill_id, created_at DESC);

CREATE TABLE IF NOT EXISTS skill_state (
  student_id TEXT NOT NULL REFERENCES students(id),
  skill_id TEXT NOT NULL,
  stage TEXT NOT NULL CHECK (stage IN ('seed','sprout','sapling','tree','fruiting')),
  level INTEGER NOT NULL DEFAULT 1 CHECK (level BETWEEN 1 AND 3),  -- difficulty ladder position
  box INTEGER NOT NULL DEFAULT 0 CHECK (box BETWEEN 0 AND 5),      -- Leitner box
  due_date TEXT,                                                   -- next spaced review (local date)
  attempts INTEGER NOT NULL DEFAULT 0,
  correct INTEGER NOT NULL DEFAULT 0,
  updated_at INTEGER NOT NULL DEFAULT (unixepoch()),
  PRIMARY KEY (student_id, skill_id)
);

CREATE TABLE IF NOT EXISTS badges (
  student_id TEXT NOT NULL REFERENCES students(id),
  badge_id TEXT NOT NULL,
  earned_at INTEGER NOT NULL DEFAULT (unixepoch()),
  PRIMARY KEY (student_id, badge_id)
);
```

`skill_state` is derived data (recomputable from `attempts`); keep a `rebuildSkillState(studentId)`
for when the mastery rule changes.

### 6.5 Mastery and "what's next"

- **Ladder inside a skill**: start at level 1; 3 correct in a row → level up; 2 wrong in a row
  → level down.
- **Stage**: `sprout` after the first attempt; `sapling` when ≥60% of the last 10 are correct;
  `tree` when ≥80% of the last 10, including ≥3 at level 3, across ≥2 local days; `fruiting`
  after passing one spaced review.
- **Spaced review (Leitner)**: on reaching `tree`, box 1; intervals 1 / 3 / 7 / 14 / 30 days;
  a miss drops back one box. Due skills appear in **Today** as "Water your trees 💧".
- **Next problem** = due reviews first, then the current path's skill, then the lowest-stage
  skill whose `prerequisites` are all ≥ `sapling`.
- **Placement** (Phase 7): a 12-problem sampler per grade that seeds `skill_state`.

### 6.6 API (all under `/homeworks/api`, served by `apps/homeworks`)

| Method | Path | Purpose |
| --- | --- | --- |
| GET/POST | `/students` | list / create kid profiles |
| GET | `/catalog?subject&grade&studentId` | strands + skills + stage for this kid |
| GET | `/problems?subject&grade&skill&difficulty&status&studentId` | Quest Board list |
| GET | `/problems/:skill/:template?seed` | rendered instance — **no answer, no explanation**. Two path segments because a problem id is `<skill-id>/<template-slug>` (§6.2); route file `app/api/problems/[skill]/[template]/route.js` |
| POST | `/sessions` | `{ studentId, kind, skillId?, localDate, tz }` → `{ sessionId }`; `studentId` must exist in `students` |
| POST | `/sessions/:id/items` | `{ problemId }` → server picks the seed (Daily Seed: derived from grade + date), inserts the `session_items` row, returns `{ seed, instance }` with no answer. The only way a seed enters a session |
| POST | `/hints` | `{ sessionId, problemId, seed }` → the next unused hint; increments `session_items.hints_used` on the server. POST, not GET, because it has a side effect |
| POST | `/attempts` | `{ sessionId, problemId, seed, response, durationMs }` → server re-renders from seed, checks, increments `session_items.tries`, and on correct/reveal writes the `attempts` row using the **server's** tries and hints; returns `{ correct, stars, feedback, explanation?, skillState }` |
| GET | `/next?studentId&skill?` | next problem per §6.5 |
| GET | `/daily?grade&date` | Daily Seed (seed derived from `grade + date`) |
| GET | `/garden?studentId` | skill states for the grove view |
| GET | `/review?studentId&day` | **extended**: attempts grouped by `local_date`, with `shown_json` vs `response_json` vs `answer_json` |

The student comes from `sessionId`, so `/hints` and `/attempts` never take a `studentId` of
their own. With no auth (D1), picking a sibling's avatar is allowed by design; the counters
exist so a kid cannot fake stars by replaying requests.

**Seed-binding invariant.** `/hints` and `/attempts` reject (409) any
`(sessionId, problemId, seed)` that has no `session_items` row, and `/attempts` rejects a
row that is already `done`. So a client cannot reset tries or hints by sending a new seed;
a fresh seed only comes from `/sessions/:id/items`, and that is a genuinely new problem.
`GET /problems/:skill/:template?seed` stays a read-only preview; its instances earn nothing
because they have no `session_items` row. An API test covers each rejection.

Free-response attempts call Nora `POST /chat/api/nora-homework/grade` with a **new generic
`type: 'rubric'`** that takes `{ grade, prompt, rubric, text }` — one small branch in Nora,
grade-level as a parameter instead of the hard-coded "Grade 5".

### 6.7 Pages (`apps/homeworks/app/`)

| Route | Purpose |
| --- | --- |
| `/homeworks` | "Who's practicing?" → Today |
| `/homeworks/today` | Daily Seed, Continue, "Water your trees", two suggestions |
| `/homeworks/grove` | the garden: skills as trees, by subject and grade |
| `/homeworks/quests` | Quest Board (LeetCode list) |
| `/homeworks/q/[skill]/[template]` | solve page: prompt · 🔊 · widget · 💡 · Check ✅ · "How Nora solved it" |
| `/homeworks/play/[sessionId]` | session runner: progress bar, one problem at a time, end card |
| `/homeworks/paths` | study paths + boss problems |
| `/homeworks/review` | parent review (existing, extended) |
| `/homeworks/library` | existing; superseded by `/grove` in Phase 8, then redirected |

Use `next/link` for all internal navigation (grove AGENTS.md routing contract).

### 6.8 Content rules

- **English passages**: original text (Nora-drafted, parent-reviewed) or verifiably public
  domain. No copyrighted excerpts, ever.
- **Readability**: every passage's Flesch–Kincaid grade within ±1.5 of its target grade;
  word-count targets: G1 40–80 · G2 80–150 · G3 150–250 · G4 200–350 · G5 250–450 ·
  G6–8 350–700 · G9–12 500–900.
- **Safety**: every shipped English item has `reviewedBy`. A test fails the build otherwise.
- **Names and contexts** in word problems are drawn from a diverse, kid-safe list in
  `engine/contexts.js`; no brands, no violence.
- **Maths number ranges** are per skill and asserted by tests (e.g. G1 add-within-20 never
  produces a sum > 20).

## 7. Curriculum — Maths (247 skills)

Aligned to CCSS domain codes (see D6): OA operations & algebraic thinking, NBT base ten,
NF fractions, MD measurement & data, G geometry, RP ratios, NS number system,
EE expressions & equations, F functions, SP statistics & probability. Grades 9–12 follow the
common US course sequence (Algebra I → Geometry → Algebra II → Precalculus/Stats).

### Grade 1 (16) — Band A
| Strand | Skills | Widgets |
| --- | --- | --- |
| OA | `add-within-20` · `sub-within-20` · `word-problems-20` · `missing-addend` · `true-false-equations` · `add-three-numbers` | number, choice |
| NBT | `count-to-120` · `tens-ones` · `compare-2digit` · `add-within-100` · `ten-more-less` | number, choice (🐊 < = >), sort |
| MD | `order-by-length` · `time-hour-half` · `picture-graphs` | order, clock, choice |
| G | `shapes-attributes` · `halves-quarters` | choice, sort, fraction-bar |

### Grade 2 (16) — Band A
| Strand | Skills | Widgets |
| --- | --- | --- |
| OA | `fluency-20` · `word-problems-100` · `even-odd` · `arrays` | number, sort |
| NBT | `place-value-1000` · `skip-count` · `expanded-form` · `compare-3digit` · `add-sub-100-regroup` · `add-sub-1000` | number, column, choice |
| MD | `measure-length` · `time-5-minutes` · `money` · `bar-graphs-line-plots` | number, clock, coins |
| G | `shapes-2d-3d` · `equal-shares` | choice, fraction-bar |

### Grade 3 (19) — Band B
| Strand | Skills | Widgets |
| --- | --- | --- |
| OA | `mult-meaning` · `mult-facts` · `div-facts` · `unknown-factor` · `two-step-word` · `patterns` | number, choice |
| NBT | `round-10-100` · `add-sub-1000` · `mult-by-tens` | number, column, number-line |
| NF | `unit-fractions` · `fractions-number-line` · `equivalent-simple` · `compare-fractions` | fraction-bar, number-line, choice |
| MD | `time-elapsed` · `mass-volume` · `scaled-graphs` · `area-tiling` · `perimeter` | clock, number |
| G | `quadrilaterals` | sort, choice |

### Grade 4 (22) — Band B
| Strand | Skills | Widgets |
| --- | --- | --- |
| OA | `mult-comparison` · `multi-step-remainders` · `factors-multiples-primes` · `patterns-rules` | number, multi-choice |
| NBT | `place-value-million` · `round-any-place` · `add-sub-multidigit` · `long-mult` · `long-div-1digit` | number, column |
| NF | `equivalent` · `compare` · `add-sub-like` · `mixed-numbers` · `mult-fraction-whole` · `decimals-tenths-hundredths` · `compare-decimals` | fraction, number-line |
| MD | `unit-conversions` · `area-perimeter-formulas` · `angles-measure` · `line-plots-fractions` | number, table-fill |
| G | `lines-angles-classify` · `symmetry` | choice, tap-select |

### Grade 5 (55) — Band B — **port the existing catalog**
All 55 skills in `apps/nora/lib/skills-catalog.js` move to `m5.*` with `legacyId` set to the
old id, so existing library rows can be migrated:

| Old category | New strand | Skills (old ids) |
| --- | --- | --- |
| A. Place Values And Number Sense | nbt | `place-value` · `rounding` · `roman-numerals` |
| B. Addition And Subtraction | nbt | `add-sub-whole` · `estimate-sum-diff` · `add-sub-word-problems` |
| C. Multiplication | nbt | `long-multiplication` · `multiply-powers-of-ten` · `estimate-products` · `multiply-word-problems` |
| D. Division | nbt | `long-division` · `divide-powers-of-ten` · `estimate-quotients` · `interpret-remainders` · `divide-word-problems` |
| E. Fractions | nf | `equiv-fractions` · `simplify-fractions` · `compare-fractions` · `mixed-improper` · `add-fractions-unlike` · `subtract-fractions-unlike` · `add-mixed-numbers` · `subtract-mixed-numbers` · `multiply-fractions` · `divide-fractions` · `fractions-word-problems` |
| F. Decimals | nbt | `decimal-place-value` · `compare-decimals` · `round-decimals` · `convert-fractions-decimals` · `add-decimals` · `subtract-decimals` · `multiply-decimals` · `divide-decimals` · `decimals-word-problems` |
| G. Expressions And Order Of Operations | oa | `order-of-operations` · `numeric-expressions` |
| H. Factors, Multiples And Number Theory | oa | `identify-factors` · `identify-multiples` · `prime-composite` · `divisibility-rules` · `lcm-gcd` |
| I. Measurement | md | `customary-units` · `metric-units` · `time-money` |
| J. Geometry | g / md | `classify-shapes` · `perimeter` · `area` · `volume` |
| K. Data, Graphs And Patterns | oa / md | `number-patterns` · `data-analysis` · `line-graphs` |
| L. Algebra And Coordinate Plane | oa / g | `variables` · `equations` · `coordinate-plane` |

Some of these are off-grade for CCSS (e.g. `roman-numerals`, `data-analysis`); keep them,
tag `ccss: []`, and note it in the catalog.

### Grade 6 (24) — Band C
| Strand | Skills | Widgets |
| --- | --- | --- |
| RP | `ratios` · `unit-rate` · `percent` · `ratio-tables` | number, table-fill |
| NS | `divide-fractions` · `multidigit-division` · `decimal-operations` · `gcf-lcm-distributive` · `integers-number-line` · `absolute-value` · `coordinate-four-quadrants` | fraction, number, number-line, graph |
| EE | `exponents` · `evaluate-expressions` · `equivalent-expressions` · `one-step-equations` · `inequalities` · `dependent-independent` | expression, number, number-line |
| G | `area-polygons` · `volume-fractional-edges` · `nets-surface-area` | number, choice |
| SP | `statistical-questions` · `measures-of-center` · `measures-of-spread` · `data-displays` | choice, number |

### Grade 7 (20) — Band C
| Strand | Skills | Widgets |
| --- | --- | --- |
| RP | `proportional-relationships` · `unit-rate-fractions` · `percent-problems` (tax, tip, discount, % change) · `scale-drawings` | number, table-fill, graph |
| NS | `add-sub-integers` · `mult-div-integers` · `rational-operations` · `repeating-decimals` | number, fraction |
| EE | `combine-like-terms` · `two-step-equations` · `two-step-inequalities` · `multi-step-word` | expression, steps |
| G | `circles` · `angle-relationships` · `area-volume-surface` · `cross-sections` | number, choice |
| SP | `sampling` · `compare-populations` · `probability-simple` · `compound-probability` | fraction, choice |

### Grade 8 (21) — Band C
| Strand | Skills | Widgets |
| --- | --- | --- |
| NS | `irrational-numbers` · `approximate-roots` | sort, number-line |
| EE | `exponent-rules` · `scientific-notation` · `square-cube-roots` · `slope` · `multi-step-equations` · `systems` | expression, number, graph, steps |
| F | `functions-intro` · `linear-vs-nonlinear` · `rate-and-initial-value` · `interpret-graphs` | choice, table-fill, graph |
| G | `transformations` · `congruence-similarity` · `angle-sums` · `pythagorean` · `distance-on-grid` · `volume-cylinder-cone-sphere` | graph, number |
| SP | `scatter-plots` · `line-of-fit` · `two-way-tables` | graph, table-fill |

### Grade 9 — Algebra I (14) — Band D
`polynomial-operations` · `factoring` · `linear-equations-inequalities` · `literal-equations` ·
`absolute-value-equations` · `systems` · `function-notation` · `linear-function-forms` ·
`quadratics-solve` · `quadratic-graphs` · `exponential-functions` · `radicals-rational-exponents` ·
`sequences` · `two-variable-data`
Widgets: expression (with form checks: factored, vertex form, slope-intercept), steps, graph.

### Grade 10 — Geometry (13) — Band D
`rigid-transformations` · `congruence-proofs` · `similarity` · `right-triangle-trig` ·
`special-right-triangles` · `circle-angles-arcs` · `arc-length-sector` · `coordinate-geometry` ·
`circle-equations` · `area-volume-solids` · `constructions` · `conditional-probability` ·
`counting-principles`
Widgets: `order` for two-column proofs and constructions, graph, number, expression.

### Grade 11 — Algebra II (13) — Band D
`complex-numbers` · `polynomial-division` · `polynomial-zeros-graphs` · `rational-expressions` ·
`radical-equations` · `function-transformations` · `inverse-functions` · `logarithms` ·
`unit-circle-radians` · `trig-graphs` · `geometric-series` · `normal-distribution` ·
`nonlinear-systems`
Widgets: expression, graph, steps, choice.

### Grade 12 — Precalculus, Statistics, Calculus intro (14) — Band D
`trig-identities` · `inverse-trig` · `law-of-sines-cosines` · `polar-parametric` · `vectors` ·
`matrices` · `conic-sections` · `sequences-series-sigma` · `binomial-theorem` · `limits-intro` ·
`derivatives-intro` · `probability-distributions` · `regression-inference` · `financial-math`
Widgets: expression, graph, table-fill, number.

## 8. Curriculum — English (193 skills)

Aligned to CCSS ELA strands: RF foundational skills (G1–3 here), RL reading literature,
RI reading informational, L language (grammar, usage, vocabulary), W writing; plus Spelling,
Research, Test-prep and Life-skills strands. Reading skills are practiced over passages
from the reviewed bank; one passage feeds several skills' questions.

### Grade 1 (15) — Band A
| Strand | Skills | Widgets |
| --- | --- | --- |
| RF | `short-vowels` · `digraphs` · `blends` · `silent-e` · `sight-words` · `syllables` | choice (🔊 "tap the word you hear"), match, number |
| RL | `story-wh-questions` · `sequence-events` | choice, order (pictures) |
| RI | `main-topic` | choice |
| L | `capitals-punctuation` · `nouns-verbs` · `plurals` · `word-categories` | tap-select, sort |
| W | `build-a-sentence` | order (word tiles) |
| Spell | `cvc-spelling` | audio-spell |

### Grade 2 (17) — Band A
| Strand | Skills | Widgets |
| --- | --- | --- |
| RF | `vowel-teams` · `r-controlled` · `prefix-suffix-basic` · `irregular-words` | choice, match |
| RL | `characters-response` · `moral-lesson` · `beginning-middle-end` | choice, order |
| RI | `main-idea` · `text-features` | choice, tap-select |
| L | `collective-irregular-plurals` · `irregular-past-tense` · `adjectives-adverbs` · `contractions-possessives` · `compound-words` · `synonyms-antonyms` | cloze, sort, match |
| W | `expand-sentence` | choice |
| Spell | `pattern-lists` | audio-spell |

### Grade 3 (20) — Band B
| Strand | Skills | Widgets |
| --- | --- | --- |
| RF | `multisyllable-decoding` | choice |
| RL | `central-message` · `character-traits` · `point-of-view` · `compare-stories` | choice, tap-select |
| RI | `main-idea-details` · `cause-effect` · `sequence-steps` · `text-features-search` | match, order, tap-select |
| L | `parts-of-speech` · `subject-verb-agreement` · `verb-tenses` · `comparative-superlative` · `quotation-marks-dialogue` · `context-clues` · `prefixes-suffixes-meaning` · `homophones` · `literal-nonliteral` | cloze, tap-select, choice |
| W | `paragraph-topic-sentence` | free-response |
| Spell | `spelling-patterns` | audio-spell |

### Grade 4 (21) — Band B
| Strand | Skills | Widgets |
| --- | --- | --- |
| RL | `theme` · `summarize` · `character-inference` · `poetry-drama-prose` | choice, order |
| RI | `summary` · `text-structure` · `firsthand-secondhand` · `charts-and-text` | choice, sort |
| L | `relative-pronouns` · `progressive-tenses` · `modal-auxiliaries` · `prepositional-phrases` · `fragments-run-ons` · `confused-words` · `compound-sentence-commas` · `greek-latin-roots` · `similes-metaphors` · `idioms-proverbs` | cloze, tap-select, match, sort |
| W | `opinion-paragraph` · `narrative-paragraph` | free-response |
| Spell | `spelling-patterns` | audio-spell |

### Grade 5 (22) — Band B — **absorbs today's reading & writing**
| Strand | Skills | Widgets |
| --- | --- | --- |
| RL | `quote-inference` · `theme` · `compare-characters` · `figurative-language` · `narrator-pov` · `domain-reading` (today's 18 `READING_DOMAINS`, reviewed passages) | choice, tap-select |
| RI | `multiple-main-ideas` · `relationships-between-ideas` · `integrate-sources` · `reasons-evidence` | choice, match, tap-select |
| L | `conjunctions-prepositions-interjections` · `perfect-tenses` · `tense-shifts` · `correlative-conjunctions` · `commas-intro-elements` · `titles-formatting` · `roots-affixes` · `context-clues` · `homographs` | cloze, tap-select |
| W | `opinion-essay` · `informative` · `narrative` (today's `writing` type) | free-response |

### Grade 6 (17) — Band C
| Strand | Skills | Widgets |
| --- | --- | --- |
| RL | `cite-evidence` · `theme-summary` · `plot-character` · `point-of-view` | tap-select, choice |
| RI | `central-idea` · `claims-evidence` | tap-select, sort |
| L | `pronoun-case` · `intensive-pronouns` · `pronoun-agreement` · `nonrestrictive-punctuation` · `roots-affixes` · `connotation-denotation` · `analogies` | cloze, choice, sort |
| W | `argument-claim` · `informative-essay` · `narrative` | free-response |
| Research | `source-credibility` | sort, choice |

### Grade 7 (17) — Band C
| Strand | Skills | Widgets |
| --- | --- | --- |
| RL | `multiple-evidence` · `theme-development` · `story-elements-interaction` · `poetry-sound-devices` | multi-choice, tap-select |
| RI | `idea-development` · `evaluate-reasoning` · `compare-authors` | choice, tap-select |
| L | `phrases-clauses` · `sentence-types` · `modifiers` · `coordinate-adjectives` · `wordiness` · `allusions` | tap-select, sort, choice |
| W | `argument-counterclaim` · `informative` · `narrative` | free-response |
| Research | `paraphrase-plagiarism` | choice |

### Grade 8 (16) — Band C
| Strand | Skills | Widgets |
| --- | --- | --- |
| RL | `strongest-evidence` · `objective-summary` · `dialogue-reveals` · `dramatic-irony` · `myth-allusion` | tap-select, choice |
| RI | `irrelevant-evidence` · `conflicting-information` | tap-select, sort |
| L | `verbals` · `active-passive` · `verb-moods` · `ellipsis-dash` · `verbal-irony-puns` | tap-select, cloze, choice |
| W | `argument-essay` · `informative` · `narrative` | free-response |
| Research | `citations` | order, choice |

### Grade 9 (14) — Band D
| Strand | Skills | Widgets |
| --- | --- | --- |
| RL | `complex-characters` · `theme-development` · `structure-time` · `world-lit-perspective` · `poetry-meter-form` | choice, tap-select |
| RI | `claim-development` · `rhetorical-appeals` | sort (ethos/pathos/logos), tap-select |
| L | `parallel-structure` · `semicolons-colons` · `clause-variety` · `tier2-vocabulary` · `etymology` | choice, cloze, match |
| W | `literary-analysis-paragraph` · `argument` | free-response |

### Grade 10 (11) — Band D
| Strand | Skills | Widgets |
| --- | --- | --- |
| RL | `author-choices` · `source-transformation` · `shakespeare` (public domain) | choice, tap-select |
| RI | `seminal-documents` (public domain) · `rhetorical-analysis` · `logical-fallacies` | match, sort, tap-select |
| L | `contested-usage` · `style-guides` · `precise-diction` | choice, cloze |
| W | `rhetorical-analysis-essay` · `synthesis` | free-response |

### Grade 11 (12) — Band D
| Strand | Skills | Widgets |
| --- | --- | --- |
| RL | `american-lit` (public domain) · `ambiguity` · `satire-irony` | choice, tap-select |
| RI | `founding-documents` · `advanced-rhetoric` | tap-select, choice |
| L | `hyphenation` · `syntax-for-effect` · `conventions-test-prep` | choice, cloze |
| Test | `evidence-pairs` · `words-in-context` | multi-choice, choice |
| W | `argument` · `research-synthesis` | free-response |

### Grade 12 (11) — Band D
| Strand | Skills | Widgets |
| --- | --- | --- |
| RL | `british-world-lit` (public domain) · `multiple-interpretations` | choice, tap-select |
| RI | `complex-arguments` · `primary-sources` | tap-select, sort |
| L | `advanced-conventions` · `precision-concision` | choice, cloze |
| W | `personal-statement` · `argument` · `analysis` | free-response |
| Life | `professional-email` · `resume-language` | free-response, choice |

## 9. Definition of done

**A skill is done** when all of these hold:
1. Catalog entry with `ccss` (or `[]` + reason) and `prerequisites`.
2. At least one template per difficulty 1, 2 and 3.
3. Every template yields ≥2 hints and an explanation.
4. Property test passes over 500 seeds: renders; its own answer passes `check`; a
   perturbed answer fails; no `undefined` / `NaN` / `[object Object]` in any string; numbers
   within the skill's declared range; (English) every item has `reviewedBy` and readability
   within band.
5. Played once end-to-end on an iPad-portrait viewport by a human, noted in the progress file.

**A phase is done** when its acceptance list below is met and, per grove AGENTS.md:
`yarn workspace @grove/homeworks test` passes, `yarn workspace @grove/curriculum test`
passes, `npx next build` in `apps/homeworks` succeeds, and the change is merged via PR
(never a direct push to `master`).

## 10. Phases

Phases 0–4 are sequential. Content phases 5 and 6 fan out by grade band once the widgets
that band needs exist; they can run in parallel with each other.

### Loop sizing

One loop = one **unit** in the unit tables of [HOMEWORK_PROGRESS.md](HOMEWORK_PROGRESS.md),
and one unit = one PR with a single concern. Include its checker, templates, UI, integration,
guards, edge cases, property assertions and browser acceptance in that same worker run;
do not turn files, assertions or a referee's finding into separate PRs. If the referee
rejects a unit, sharpen the spec and re-arm the **same unit** on the same branch, never a
new suffixed sub-loop. Size content by a grade/strand cell or a coherent group of cells,
with several skills and their three difficulties per unit, not one loop per skill. A unit
is only ticked after its own acceptance runs and its PR merges. Existing P-items remain
the traceability keys; deferred human review and missing dependencies do not become
implicitly complete when another unit merges.

### Phase 0 — Hygiene and decisions
- Apply decisions D1–D7 (§11, resolved 2026-09-26): update the Homeworks section of grove
  `AGENTS.md` for D1 and D2.
- Fix F1–F5 test-first (grove BDD policy); try to reproduce F6 and fix if real.
- Acceptance: a failing-then-passing test for each fixed defect; review page buckets an
  8 pm America/New_York submission on the correct day.

### Phase 1 — Engine + vertical slice (Grade 5, because that is today's user)
- Create `packages/curriculum` with `rng`, `render`, `check`, `fraction`, the catalog shape,
  and ids.
- Port the 55 Grade 5 maths skills' metadata; implement templates for **3 skills**:
  `m5.nbt.long-multiplication` (column), `m5.nf.add-fractions-unlike` (fraction),
  `m5.oa.order-of-operations` (number).
- One English skill: `e5.l.context-clues` (cloze) with 20 reviewed items.
- Add `students` (with the `public` seed), `practice_sessions`, `session_items`, `attempts`
  tables; `/students`, `/problems`, `/problems/:skill/:template`, `/sessions`,
  `/sessions/:id/items`, `/hints`, `/attempts`, with the seed-binding invariant (§6.6).
- Solve page + session runner with **Check ✅**, stars, "How Nora solved it".
- Acceptance: a kid completes an 8-problem session of long multiplication, the answer never
  appears in the network payload before solving (verify in DevTools), and the review page
  shows every problem with the kid's answer.

### Phase 2 — Widget library and kid UX
- Build the remaining widgets in band order (A → B → C → D), each with a side-by-side test and
  a checker in `@grove/curriculum`.
- Remaining units: symbolic solving (`P2.18`, `P2.20`), graph plotting (`P2.19`),
  cross-widget seed/target hardening (`P2.22`), and catalogue/gallery completion
  (`P2.5`, including the still-unbuilt `multi-choice`). `P2.17` is already in flight and
  is not regrouped. Gallery acceptance stays open until the Phase 6 `audio-spell`
  (`P2.12`) and `free-response` (`P2.21`) dependencies exist; an interim gallery audit
  does not tick `P2.5`. See the progress unit tables for exact ownership and gates.
- 🔊 read-aloud, on-screen number pad, maths keypad, feedback animations, reduced motion,
  sounds toggle, dyslexia font.
- Pick and install maths rendering (D5) for Band C/D.
- Acceptance: a "widget gallery" page at `/homeworks/dev/widgets` (dev only) renders every
  widget with a sample problem; each widget's checker has right/wrong tests.

### Phase 3 — Game layer
- Today screen, Daily Seed, watering-days streak with rain days, badges, the grove view,
  end-of-session card, Sunshine, Quest Board with filters and 🎲.
- Deliver as two concerns: daily entry and shared seed (`P3.1`–`P3.3`, `P3.8`), then
  rewards, grove, quest discovery and session finish (`P3.4`–`P3.7`).
- Acceptance: two sibling profiles see the same Daily Seed for the same grade on the same
  local date and different ones on different dates.

### Phase 4 — Mastery and "what's next"
- `skill_state`, ladder, stages, Leitner review, `/next`, `/garden`, `rebuildSkillState`.
- Paths with boss problems.
- Deliver as mastery state/replay (`P4.1`–`P4.3`, `P4.6`) and its navigation surfaces
  (`P4.4`–`P4.5`); the scripted acceptance belongs to the state unit, not a third PR.
- Acceptance: unit tests drive a scripted sequence of attempts through
  seed → sprout → sapling → tree → fruiting and back down on a missed review.

### Phase 5 — Maths content (247 skills)
| Batch | Grades | Skills | Needs widgets |
| --- | --- | --- | --- |
| 5a | 5 (rest of the port) | 52 | column, fraction, number-line, table-fill, graph |
| 5b | 3–4 | 41 | column, fraction-bar, clock, number-line |
| 5c | 1–2 | 32 | number pad, clock, coins, sort, order |
| 5d | 6–8 | 65 | expression, graph, table-fill, steps |
| 5e | 9–12 | 54 | expression (form checks), graph, steps, order |

When 5a is done, switch the **Math** tab to the new engine and retire the LLM-graded
`math/mixed` quiz and Nora's `skills-catalog.js` (Nora-thin). Migrate Nora's skills-library
rows into `attempts` via `legacyId` (D4).
The 5a–5e batches are scheduling envelopes, **not** single loops and not one loop per
skill. Use the bounded grade/strand groups in the progress unit table; each group ships
multiple templates and property checks across its skills. Switch and retirement are a
separate cutover unit after the 5a skills meet §9; do not retire live paths early.

### Phase 6 — English content (193 skills)
- `scripts/curriculum/draft-english.mjs` (repo root, outside the package; add
  `scripts/curriculum/drafts/` to the root `.gitignore` in the same PR) drafts items and
  passages per skill through Nora; a parent
  reviews in a simple review page (`/homeworks/dev/content-review`, dev only) and approves into
  `content/`.
- Add Nora `type: 'rubric'` grading with grade-level parameter; free-response widget.

| Batch | Grades | Skills |
| --- | --- | --- |
| 6a | 5 (absorb today's reading + writing) | 21 (+1 from Phase 1) |
| 6b | 3–4 | 41 |
| 6c | 1–2 (heavy on 🔊 and audio-spell) | 32 |
| 6d | 6–8 | 50 |
| 6e | 9–12 | 48 |

When 6a is done, switch the **English** tab to the new engine and retire the live
passage-generation path for kids (generation moves to authoring only).
The 6a–6e batches likewise use reviewed, multi-skill grade/strand units in the progress
table. The authoring/review pipeline, rubric and free-response flow, and English cutover
are separate units. `P1.5` remains pending a parent's actual review; `P2.12` waits on
the 6c reviewed spelling bank, and `P2.21` waits on the rubric route.

### Phase 7 — Parents and polish
- Review page: filter by kid, by skill; per-skill trend; export CSV.
- Placement sampler per grade.
- Settings per kid (grade, sounds, font, read-aloud default, daily goal).
- Weekend Challenge (G6+, family board).
- Units: parent insights/export (`P7.1`–`P7.2`), placement/personalization
  (`P7.3`–`P7.4`), and opt-in family challenge (`P7.5`).

### Phase 8 — Retire the old surfaces
- Redirect `/homeworks/library` → `/homeworks/grove`; delete `SkillsLibrary`, `ParentView`,
  `ProgressReview` if unused; update `apps/homeworks/README.md` and the Homeworks section of
  grove `AGENTS.md`.
- One retirement unit (`P8.1`–`P8.3`), after both subject cutovers: redirect, remove
  verified-unused surfaces, and update documentation in the same PR.

## 11. Decisions (resolved 2026-09-26)

| # | Question | Decision |
| --- | --- | --- |
| D1 | grove AGENTS.md says every submission stores `student_id = 'public'` and forbids auth. Kid profiles are needed for per-kid mastery. | Avatar-picker profiles, **no auth**, data stays public; keep `'public'` as the default profile; update the AGENTS.md Homeworks section in the same PR. |
| D2 | AGENTS.md bans "file-based JSON" for homework data. Where does *content* live? | Content is **code** in `packages/curriculum` (reviewable in PRs, tested); attempts stay in SQLite. State this distinction explicitly in AGENTS.md. |
| D3 | Maths grading moves from Nora LLM to deterministic checkers. | Yes. LLM stays only for free-response rubric grading. |
| D4 | Skills library data lives in Nora's DB. | Move into homeworks SQLite (`attempts`), migrate by `legacyId`, delete Nora's library route in Phase 8. |
| D5 | Maths rendering and drag-and-drop dependencies. | KaTeX for rendering; custom pointer-events drag (touch-safe), no DnD library. Pin versions from the registry at install time. |
| D6 | Which curriculum framework? | US Common Core (CCSS) for both subjects. Switching later only changes `catalog/` and `ccss` tags. |
| D7 | Sounds default. | On for Band A–B (G1–5), off for C–D (G6–12); parent-toggleable per kid. |

AGENTS.md also both requires tests for `apps/homeworks/lib/db.js` and forbids tests under
`lib/db/*` (the latter is Nora's directory). Read as: homeworks `lib/db.js` gets side-by-side
tests against `:memory:`. Write this reading into AGENTS.md alongside D1.

## 12. Risks

| Risk | Mitigation |
| --- | --- |
| English content volume (193 skills × ~30 items) is the long pole | Passages are shared across skills; draft with Nora, review in batches; ship grade by grade |
| Expression equivalence accepts the wrong *form* (expanded when factored was asked) | Form checks per template (`requireForm: 'factored'`) with tests for both accept and reject |
| Kids game hints / reveal | Stars drop with hints; "try another" after a reveal is required to earn stars |
| LLM feedback on writing is harsh or off-level | Rubric prompt carries grade level; feedback shown as "Nora's notes", not a score, for G1–4 |
| Scope creep into a full LMS | No teachers, classes, logins or messaging. Family use only. |
