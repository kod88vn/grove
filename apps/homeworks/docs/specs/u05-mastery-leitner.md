# U05 — Mastery: the Skill Ladder, the Leitner Box, and Paths

Status: implemented. This is the design record for the mastery engine that
turns Nora's practice records into a real, growing skill tree.

## Problem

Nora's garden rendered stages from a kid-facing heuristic that never looked at
the practice records: a child who solved one problem once and a child who
practiced the same skill for a week looked identical, and nothing ever came
back to retest the child. This unit gives the garden one source of truth — a
deterministic fold over the practice records — and three kid-visible
consequences: spaced reviews that arrive on their due day, a skill tree that
grows only with real practice, and paths that end in a 👑 boss.

## The ladder (levels 1–3)

Difficulty follows the child, not the child's mood. Three ladder levels:

- three correct in a row moves the level up (cap 3),
- two wrong in a row moves it down (floor 1).

A stored attempt row contributes `(tries − 1)` wrongs and then one correct;
a revealed solve (the child gave up) contributes two wrongs and no correct.
The level at the time of an attempt is what the stage window records.

## The stage ladder

Five stages, each derived from the fold — never hand-assigned:

| Stage     | Rule                                                                     |
|-----------|--------------------------------------------------------------------------|
| seed      | No attempts recorded.                                                    |
| sprout    | At least one attempt (fewer than 10 rows yet to say anything).           |
| sapling   | ≥ 60% of the last 10 *practice* attempts passed.                         |
| tree      | ≥ 80% of the last 10, including ≥ 3 at level 3, across ≥ 2 local days.   |
| fruiting  | tree, and the most recent spaced review since re-entering tree was a pass. |

Reviews are deliberately excluded from the window: spaced review is
consolidation, not learning, so a missed review cannot drag a growing stage
down — the Leitner box is the place where forgetting is tracked.

## The Leitner box

The spaced system engages only for trees. Intervals: 1 / 3 / 7 / 14 / 30 days
for boxes 1–5.

- Reaching tree enters box 1, due in 1 day.
- A passed review moves one box up; box 5 graduates — no more reviews.
- A missed review drops one box; box 0 leaves the system until the child is
  a tree again (the stage window decides that independently).
- Dropping below tree leaves the system; the box and due date go with it.

`rebuildSkillState` is the rule-change escape hatch: it re-folds every skill
from its full attempt stream, so any future change to these rules is a
rebuild, never a migration.

## Paths

`packages/curriculum/src/paths.js` ships three Grade 5 paths — Fraction
Forest 🌲, Expression Express 🚂, Shape Scout 📍 — each a real registered
boss template (three new templates in the problem bank) attached to a
terminal skill. A path's step list is *derived*: the terminal skill's
prerequisite chain from the catalog graph, prerequisites first, terminal
last. Nothing in a path generates content.

## What's next

`nextForStudent` picks, in order:

1. a due review (earliest due date; the problem is chosen at the skill's
   current ladder level),
2. the active path — a path with any skill past seed — the chain's first
   non-tree skill, else the 👑 boss once every chain skill is a tree,
3. the lowest-stage skill whose prerequisites are all at least sapling.

The boss is a goal, not practice: it is excluded from path-step and
ready-skill problem picks and is served only by the all-tree branch.
`null` when there is genuinely nothing to do.

## The path view (describePath)

The client renders the annotated path, not the raw registry. `describePath`
adds, for the child's fold:

- each chain skill's current stage, with its stage icon,
- `locked` — a chain skill whose prerequisites have not all reached at
  least sapling is visible but not playable; `lockedBy` names the missing
  prerequisites so the UI can say "grow X first" (a *prerequisite* rule,
  never a stage rule),
- `nextSkillId` — the first chain skill below tree, or `null`,
- `bossReady` — `nextSkillId === null`: the boss unlocks exactly when
  `nextForStudent` would serve it.

The hub shows the chain on the Quest Board and on a dedicated `/paths`
page: a stage icon per skill, a dimmed 🔒 on locked skills (clicking one
says "Grow X first" instead of starting a session), a "Play next" button
for `nextSkillId`, and the 👑 boss button, disabled until `bossReady`.

## API surface

- `GET /homeworks/api/next?studentId=&date=[&grade=]` → `{ next, reviews,
  paths, skillStates }`. `date` is the viewer's local calendar day (due dates
  are local days); `grade` optionally overrides the student's grade.
  `next` is always the first entry of `reviews` when a review is due;
  `paths` are annotated by `describePath` (above), so the hub renders them
  without a second round trip.
- `POST /homeworks/api/attempts` → the response's `skillState` carries the
  refreshed fold, so the play page celebrates the new stage in the same
  gesture.
- `GET /homeworks/api/kid-experience` → the garden's stage/box/due come from
  the fold for tried skills; untried skills keep the presentation heuristic
  (which agrees with the fold through sapling).
- The hub renders all of it: a "What's next" card with due reviews on Today,
  the annotated path chain (stage icons, locked skills, "Play next") and the
  👑 boss on the Quest Board and the dedicated `/paths` page, and a
  next-review line on each grown tree in the garden.

## Scope boundaries

- Nora's LLM tutor hook (mastery state → the agent's teaching context) is
  out of scope until the LLM lands; the fold must be correct and
  deterministic without it.
- Per-subject Leitner tuning, analytics, and per-widget review rendering are
  out of scope.
- Stars and decorations are untouched; mastery feeds only the growth the
  records already describe.

## Acceptance

- `apps/homeworks/lib/mastery.test.js` — fold determinism (row order, clock
  skew), ladder streaks, stage windows, box promotion/demotion/graduation,
  `pickProblem` level matching, next-priority ordering including the
  boss-exclusion rule, and `describePath` lock/readiness.
- `packages/curriculum/src/paths.test.js` — registry shape, chain derivation,
  boss membership.
- `app/api/next/route.test.js`, `app/api/attempts/route.test.js`,
  `app/api/kid-experience/route.test.js`, `components/KidExperienceHub.test.js`,
  `app/api/practice.flow.test.js` — the API contracts and the kid-visible
  surfaces above.

## Implementation

- `packages/curriculum/src/paths.js` — path registry, `listPaths(grade)`,
  `getPath(id)`.
- `packages/curriculum/src/problems/math/g05/{fraction,expression,coordinate}-boss.js`
  — the three boss templates.
- `apps/homeworks/lib/mastery.js` — `computeSkillState` (pure fold),
  `refreshSkillState`, `rebuildSkillState`, `getSkillStates`, `dueReviews`,
  `pickProblem`, `nextForStudent`, `describePath`, plus the Leitner interval
  and stage-rank tables.
- `apps/homeworks/lib/db.js` — the `skill_state` table.
- `apps/homeworks/app/api/next/route.js` — the mastery view.
- `apps/homeworks/app/paths/page.js` — the dedicated Study Paths screen.
- `apps/homeworks/components/KidExperienceHub.js` — Today / Paths /
  Quest Board / Garden surfaces.
