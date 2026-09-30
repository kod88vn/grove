/**
 * P1.7 spec — the package entry point (HOMEWORK_PLAN.md §6.1, the `src/index.js` line:
 * "listSkills, getSkill, listProblems, render, check, hint").
 *
 * P1.7 is the first consumer. §6.6 puts seven routes in `apps/homeworks/app/api` that must
 * list skills, list problems, render one instance from a server-issued seed, serve one hint
 * at a time and grade a response — all through `@grove/curriculum`, because §6.1 says the
 * package is "imported by apps/homeworks server routes (generate, check)". Today
 * `src/index.js` exports nothing at all, so a route would have to reach into
 * `src/engine/*` and `src/problems/*` by path and re-implement the aggregation in the app.
 *
 * Two additions beyond the six names in §6.1, both load-bearing for §6.6 and marked ASSUMED
 * in the P1.7 report:
 *
 *   getProblem(id)      — §6.6 renders `/problems/:skill/:template`, re-renders from the
 *                         seed in `/attempts` and issues hints in `/hints`. All three need
 *                         ONE template by its `<skill>/<template>` id (§6.2). Scanning
 *                         listProblems() for it in three route files is the duplication
 *                         this entry point exists to prevent.
 *
 *   toInstance(rendered)— §6.6: `/problems/:skill/:template` returns a "rendered instance —
 *                         no answer, no explanation", and §10 Phase 1 acceptance is "the
 *                         answer never appears in the network payload before solving".
 *                         Deleting `answer` and `explanation` is NOT enough: `render()`
 *                         also returns `visual`, and for the order-of-operations templates
 *                         `visual.steps` ends with the worked answer
 *                         ("(18 + 20) × 13 ÷ 2" -> steps [..., "494 ÷ 2", "247"], answer
 *                         247), while the column templates carry `visual.partials` (the
 *                         per-row answers the `column` checker grades, §6.3) and the
 *                         fraction templates carry `visual.lcd`, which is verbatim hint 1.
 *                         So the projection is an ALLOWLIST per visual kind, kept next to
 *                         the templates that define those kinds rather than in the app.
 *
 * `render` and `check` are the engine's, re-exported unchanged — P1.2 pinned their
 * behaviour and this file only pins identity, so nothing here can quietly fork them.
 */
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readdirSync } from 'node:fs'

import {
  check,
  getProblem,
  getSkill,
  hint,
  listProblems,
  listSkills,
  render,
  toInstance,
} from './index.js'
import { check as engineCheck } from './engine/check.js'
import { render as engineRender } from './engine/render.js'

// ---------------------------------------------------------------- discovery
// Data-driven, like ./problems/problems.purity.test.js: the expected sets are read off the
// tree, so a catalog or template module that is added later and NOT registered in index.js
// fails this file instead of silently disappearing from the API.
const collect = (dir) => {
  const found = []
  for (const entry of readdirSync(dir, { withFileTypes: true }).sort((a, b) => (a.name < b.name ? -1 : 1))) {
    if (entry.isDirectory()) found.push(...collect(new URL(`${entry.name}/`, dir)))
    else if (entry.name.endsWith('.js') && !entry.name.endsWith('.test.js')) found.push(new URL(entry.name, dir))
  }
  return found
}

const catalogModules = await Promise.all(collect(new URL('./catalog/', import.meta.url)).map((u) => import(u.href)))
const problemModules = await Promise.all(collect(new URL('./problems/', import.meta.url)).map((u) => import(u.href)))

const allSkills = catalogModules.flatMap((m) => m.skills ?? [])
const allTemplates = problemModules.flatMap((m) => m.templates ?? [])
const skillById = new Map(allSkills.map((s) => [s.id, s]))
const ids = (rows) => rows.map((r) => r.id).sort()

// 66 renders m5.oa.order-of-operations/exact-division with answer 3, which collides with that
// template's difficulty of 3. That collision is NOT a leak — knowing a problem is difficulty 3
// tells a kid nothing — and the first run of this spec proved the cost of pretending it is:
// the worker perturbed `difficulty` by Number.EPSILON * 4 on exactly that branch, so 26 of
// 48,000 instances shipped `difficulty: 3.000000000000001`. The seed stays in the list so the
// honest behaviour is the one under test.
const SEEDS = [1, 7, 66, 4242, 987654321]

// ---------------------------------------------------------------- listSkills / getSkill
test('listSkills() returns every catalogued skill, once', () => {
  assert.ok(allSkills.length > 0, 'the catalog tree is empty; this spec would be vacuous')
  assert.deepEqual(ids(listSkills()), ids(allSkills))
})

test('listSkills() filters by subject, grade and strand', () => {
  for (const subject of ['math', 'english']) {
    const expected = allSkills.filter((s) => s.subject === subject)
    assert.ok(expected.length > 0, `no ${subject} skill to filter on`)
    assert.deepEqual(ids(listSkills({ subject })), ids(expected))
  }
  assert.deepEqual(ids(listSkills({ grade: 5 })), ids(allSkills.filter((s) => s.grade === 5)))
  assert.deepEqual(listSkills({ grade: 1 }), [])
  assert.deepEqual(
    ids(listSkills({ subject: 'math', strand: 'nf' })),
    ids(allSkills.filter((s) => s.subject === 'math' && s.strand === 'nf')),
  )
})

test('listSkills() returns plain data — no functions, JSON round-trips unchanged', () => {
  const rows = listSkills()
  assert.deepEqual(JSON.parse(JSON.stringify(rows)), rows)
})

test('listSkills() hands back a copy, so a caller cannot mutate the catalog', () => {
  const first = listSkills()
  first.length = 0
  assert.equal(listSkills().length, allSkills.length)
})

test('getSkill() returns the skill by id and null for an unknown one', () => {
  const sample = allSkills[0]
  assert.deepEqual(getSkill(sample.id), sample)
  assert.equal(getSkill('m5.nbt.does-not-exist'), null)
  assert.equal(getSkill(''), null)
  assert.equal(getSkill(undefined), null)
})

// ---------------------------------------------------------------- listProblems / getProblem
test('listProblems() returns every template, once, as metadata with no generate()', () => {
  assert.ok(allTemplates.length > 0, 'the problems tree is empty; this spec would be vacuous')
  const rows = listProblems()
  assert.deepEqual(ids(rows), ids(allTemplates))
  for (const row of rows) {
    assert.equal(typeof row.generate, 'undefined', `${row.id} leaks generate()`)
    assert.deepEqual(Object.keys(row).sort(), [
      'difficulty', 'grade', 'id', 'skill', 'subject', 'title', 'version', 'widget',
    ])
  }
  assert.deepEqual(JSON.parse(JSON.stringify(rows)), rows)
})

test('listProblems() carries the subject and grade of its skill (§6.6 Quest Board filters)', () => {
  for (const row of listProblems()) {
    const skill = skillById.get(row.skill)
    assert.ok(skill, `${row.id} names a skill that is not in the catalog`)
    assert.equal(row.subject, skill.subject)
    assert.equal(row.grade, skill.grade)
  }
})

test('listProblems() filters by subject, grade, skill and difficulty', () => {
  const meta = listProblems()
  for (const subject of ['math', 'english']) {
    assert.deepEqual(ids(listProblems({ subject })), ids(meta.filter((r) => r.subject === subject)))
  }
  assert.deepEqual(ids(listProblems({ grade: 5 })), ids(meta.filter((r) => r.grade === 5)))
  assert.deepEqual(listProblems({ grade: 2 }), [])
  for (const difficulty of [1, 2, 3]) {
    const expected = meta.filter((r) => r.difficulty === difficulty)
    assert.ok(expected.length > 0, `no template at difficulty ${difficulty}`)
    assert.deepEqual(ids(listProblems({ difficulty })), ids(expected))
  }
  const skill = meta[0].skill
  assert.deepEqual(ids(listProblems({ skill })), ids(meta.filter((r) => r.skill === skill)))
  assert.deepEqual(listProblems({ skill: 'm5.nbt.no-such-skill' }), [])
  assert.deepEqual(listProblems({ subject: 'math', difficulty: 3, grade: 5 }).every((r) => r.difficulty === 3), true)
})

test('getProblem() returns the whole template, generate() included, and null otherwise', () => {
  for (const template of allTemplates) {
    assert.equal(getProblem(template.id), template)
    assert.equal(typeof getProblem(template.id).generate, 'function')
  }
  assert.equal(getProblem('m5.nbt.long-multiplication/no-such-template'), null)
  assert.equal(getProblem('not-an-id'), null)
  assert.equal(getProblem(undefined), null)
})

// ---------------------------------------------------------------- render / check / hint
test('render and check are the engine functions, not a fork', () => {
  assert.equal(render, engineRender)
  assert.equal(check, engineCheck)
})

test('render(getProblem(id), seed) is deterministic for every template', () => {
  for (const template of allTemplates) {
    for (const seed of SEEDS) {
      const first = render(getProblem(template.id), seed)
      const second = render(getProblem(template.id), seed)
      assert.deepEqual(first, second, `${template.id}@${seed} is not reproducible`)
      assert.equal(first.seed, seed)
    }
  }
})

test('hint() hands back the next unused hint, then null — §6.6 POST /hints', () => {
  for (const template of allTemplates) {
    const rendered = render(getProblem(template.id), 4242)
    assert.ok(rendered.hints.length > 0, `${template.id} has no hints`)
    for (let used = 0; used < rendered.hints.length; used++) {
      assert.equal(hint(rendered, used), rendered.hints[used])
    }
    assert.equal(hint(rendered, rendered.hints.length), null)
    assert.equal(hint(rendered, rendered.hints.length + 5), null)
  }
})

test('hint() refuses a nonsense count rather than guessing (No Silent Failures)', () => {
  const rendered = render(getProblem(allTemplates[0].id), 1)
  for (const bad of [-1, 1.5, '0', null, undefined, NaN]) {
    assert.throws(() => hint(rendered, bad), TypeError, `hint(rendered, ${String(bad)}) did not throw`)
  }
  for (const bad of [null, undefined, {}, { hints: 'nope' }]) {
    assert.throws(() => hint(bad, 0), TypeError, `hint(${JSON.stringify(bad)}, 0) did not throw`)
  }
})

// ---------------------------------------------------------------- toInstance
const INSTANCE_KEYS = ['difficulty', 'problemId', 'prompt', 'seed', 'skill', 'version', 'visual', 'widget']

const VISUAL_KEYS = {
  column: ['kind', 'operands', 'operator'],
  'fraction-sum': ['addends', 'kind', 'operator'],
  'fraction-bar': ['kind', 'reference', 'segments'],
  expression: ['expression', 'kind'],
  cloze: ['choices', 'kind', 'sentence'],
  // P2.6 — `choice` (plan §6.3, Band A). The options are the whole question, so they are
  // public; the answer is one of their ids and stays on the server.
  choice: ['kind', 'options'],
  // P2.7 — `order` (plan §6.3, Band A). The cards and their labels are the question, in the
  // shuffled order they are to be shown in; which order they belong in is the answer and
  // stays on the server. `order-decimals.test.js` additionally measures that the ids
  // themselves cannot be sorted back into the answer.
  order: ['items', 'kind'],
  // P2.8 — `sort` (plan §6.3, Band A). Both the cards AND the buckets are public: a kid
  // cannot classify into categories they cannot read. What stays on the server is the
  // mapping between them. `sort-quadrilaterals.test.js` additionally measures that the
  // display order is not that mapping, and that no bucket's id list appears in the envelope.
  sort: ['buckets', 'items', 'kind'],
  // P2.9 — `match` (plan §6.3, Band A). Both columns are public for the same reason both
  // sides of a `sort` board are: a kid cannot join two things they cannot read. What stays
  // on the server is which left card goes with which right card.
  // `match-expressions.test.js` additionally measures that neither column's display order
  // nor the ids' own numbering reproduce that pairing.
  match: ['kind', 'left', 'right'],
  // P2.10 — `clock` (plan §6.3, Band A). The face carries the time the problem STARTS at,
  // which is the question and so is public; the time it ends at is the answer and stays on
  // the server. `clock-elapsed-time.test.js` additionally measures that both hands always
  // have to move, so the start can never be mistaken for a hint at the end.
  clock: ['kind', 'start'],
  // Coins show the target and offered values, never the combination that makes it.
  coins: ['denominations', 'kind', 'target'],
  // Tap-select shows issued token labels and sentence-order segments; selected ids stay server-side.
  'tap-select': ['blankIndex', 'kind', 'segments', 'tokens'],
}

const walk = (value, visit, path = '$') => {
  visit(value, path)
  if (Array.isArray(value)) value.forEach((v, i) => walk(v, visit, `${path}[${i}]`))
  else if (value && typeof value === 'object') {
    for (const [k, v] of Object.entries(value)) walk(v, visit, `${path}.${k}`)
  }
}

test('toInstance() keeps exactly the public fields — no answer, no explanation, no hints', () => {
  for (const template of allTemplates) {
    for (const seed of SEEDS) {
      const instance = toInstance(render(getProblem(template.id), seed))
      assert.deepEqual(Object.keys(instance).sort(), INSTANCE_KEYS, `${template.id}@${seed}`)
      assert.equal(instance.problemId, template.id)
      assert.equal(instance.seed, seed)
      assert.equal(instance.widget, template.widget)
    }
  }
})

test('toInstance() allowlists visual by kind, dropping steps, partials, parts and lcd', () => {
  const seenKinds = new Set()
  for (const template of allTemplates) {
    for (const seed of SEEDS) {
      const rendered = render(getProblem(template.id), seed)
      const instance = toInstance(rendered)
      if (rendered.visual === null) {
        assert.equal(instance.visual, null)
        continue
      }
      const kind = rendered.visual.kind
      seenKinds.add(kind)
      const allowed = VISUAL_KEYS[kind]
      assert.ok(allowed, `${template.id}: visual kind '${kind}' has no allowlist`)
      assert.deepEqual(Object.keys(instance.visual).sort(), allowed, `${template.id}@${seed} visual`)
      for (const key of allowed) assert.deepEqual(instance.visual[key], rendered.visual[key])
    }
  }
  // The allowlist is only meaningful if the templates actually produce these kinds.
  assert.deepEqual([...seenKinds].sort(), Object.keys(VISUAL_KEYS).sort())
})

test('toInstance() refuses an unknown visual kind instead of passing it through', () => {
  const rendered = render(getProblem(allTemplates[0].id), 1)
  assert.throws(() => toInstance({ ...rendered, visual: { kind: 'future-widget', answer: 42 } }), TypeError)
  assert.throws(() => toInstance({ ...rendered, visual: { operands: [1, 2] } }), TypeError)
  for (const bad of [null, undefined, {}, 'nope']) {
    assert.throws(() => toInstance(bad), TypeError, `toInstance(${String(bad)}) did not throw`)
  }
})

test('no instance carries a solution-bearing key at any depth', () => {
  const banned = new Set(['answer', 'explanation', 'hints', 'steps', 'partials', 'parts', 'lcd'])
  for (const template of allTemplates) {
    for (const seed of SEEDS) {
      const instance = toInstance(render(getProblem(template.id), seed))
      walk(instance, (value, path) => {
        if (!value || typeof value !== 'object' || Array.isArray(value)) return
        for (const key of Object.keys(value)) {
          assert.ok(!banned.has(key), `${template.id}@${seed}: ${path}.${key} is solution-bearing`)
        }
      })
    }
  }
})

test('toInstance() copies the metadata verbatim — it may drop fields, never alter them', () => {
  for (const template of allTemplates) {
    for (const seed of SEEDS) {
      const rendered = render(getProblem(template.id), seed)
      const instance = toInstance(rendered)
      const where = `${template.id}@${seed}`
      for (const key of ['problemId', 'skill', 'widget', 'version', 'seed', 'prompt', 'difficulty']) {
        assert.deepEqual(instance[key], rendered[key], `${where}: ${key} was altered`)
      }
      assert.ok(Number.isInteger(instance.difficulty), `${where}: difficulty ${instance.difficulty} is not an integer`)
      assert.ok(instance.difficulty >= 1 && instance.difficulty <= 3, `${where}: difficulty out of range`)
      assert.ok(Number.isInteger(instance.version) && instance.version >= 1, `${where}: version is not a version`)
    }
  }
})

test('a numeric answer never appears in the content a kid can read', () => {
  // Scoped to prompt and visual — the fields that carry the problem itself. Metadata cannot
  // leak an answer: `difficulty` is 1-3, `version` is 1 and `seed` is the server's own
  // handle, so a collision between one of them and the answer is a coincidence, not a tell.
  // Only widgets whose answer is a bare number: a `cloze` answer is necessarily one of
  // `visual.choices`, and a fraction's denominator is legitimately an addend's.
  let checked = 0
  for (const template of allTemplates) {
    if (template.widget !== 'number' && template.widget !== 'column') continue
    for (const seed of SEEDS) {
      const rendered = render(getProblem(template.id), seed)
      const { prompt, visual } = toInstance(rendered)
      const answer = rendered.answer.value
      assert.equal(typeof answer, 'number')
      walk({ prompt, visual }, (value, path) => {
        if (value === answer) assert.fail(`${template.id}@${seed}: ${path} is the answer ${answer}`)
        if (typeof value === 'string' && value.trim() === String(answer)) {
          assert.fail(`${template.id}@${seed}: ${path} is the answer "${answer}"`)
        }
      })
      checked++
    }
  }
  assert.ok(checked >= 4, `only ${checked} numeric instances checked; this spec would be weak`)
})

test('toInstance() output is plain, serialisable data', () => {
  for (const template of allTemplates) {
    const instance = toInstance(render(getProblem(template.id), 7))
    assert.deepEqual(JSON.parse(JSON.stringify(instance)), instance)
    walk(instance, (value, path) => {
      assert.notEqual(typeof value, 'function', `${path} is a function`)
      assert.notEqual(typeof value, 'undefined', `${path} is undefined`)
    })
  }
})
