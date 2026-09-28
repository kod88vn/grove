/**
 * P2.8 part 1b of 2 — the first `sort` template: classify shapes into "always a <target>"
 * and "not always a <target>".
 *
 * HOMEWORK_PLAN.md §6.3 (line 189) names "shapes" as a use for this widget:
 *
 *   | `sort` (buckets) | nouns vs verbs, even vs odd, shapes | set equality per bucket | A |
 *
 * The skill is already in the catalog, in grade: `m5.g.classify-shapes`
 * (`src/catalog/math/grade-05.js`), CCSS 5.G.B.4 — *"Classify two-dimensional figures into
 * categories based on their properties"*. So nothing here is off-grade and `OFF_GRADE` in
 * `grade-05.offgrade.test.js` is untouched.
 *
 * WHAT MAKES THIS THE RIGHT CONTENT, and each rule the generator must obey:
 *
 * 1. THE QUESTION IS "ALWAYS", NOT "IS". 5.G.B.4 is about a hierarchy: a square is always a
 *    rectangle, a rectangle is not always a square. "Is this shape a rectangle?" is a
 *    naming exercise a second-grader can do; "is this shape ALWAYS a rectangle?" is the
 *    grade-5 skill. The prompt and both bucket labels therefore carry the word.
 * 2. NO DISPUTED DEFINITION. `trapezoid` appears only ever as an ITEM, never as the target,
 *    because "is a parallelogram always a trapezoid?" has two defensible answers (the
 *    inclusive and exclusive definitions) and a kid must not be marked wrong for holding
 *    the other one. Every cell of the table below is true under both.
 * 3. NO TARGET WITH ONLY ONE TRUE ITEM. `square` is not a target: only a square is always a
 *    square, so one bucket would hold a single card at every seed. Both buckets must hold
 *    at least two.
 * 4. NOT A DIGIT ANYWHERE. No prompt, item label or bucket label may contain one. That is
 *    not cosmetic: `AnswerWidget.test.js` subtracts what the server sent from the rendered
 *    text and then bans any digit in what is left, so a bucket label like "Always has 4
 *    right angles" makes a downstream widget test fail for a reason nobody will find. Shape
 *    vocabulary carries the whole exercise without one.
 * 5. THE DISPLAY ORDER IS NOT THE ANSWER. If the cards arrived already grouped — all the
 *    "always" ones, then the rest — a kid could sort them without reading, and so could a
 *    forged request, since the ids are assigned in display order. The membership sequence
 *    over display positions must change value at least twice, which rules out both block
 *    arrangements and forces genuine interleaving.
 * 6. NEITHER BUCKET IS ALWAYS FIRST, AND THE TARGET MOVES. Over a sweep of seeds both
 *    bucket orders and all four targets must appear, or "it is the left one" and "it is
 *    always about parallelograms" become strategies.
 * 7. THE ANSWER NEVER TRAVELS. `toInstance()` strips it, and the leak test below also
 *    refuses the per-bucket id list rendered under any plausible separator — the
 *    `visual.buckets` array is legitimately public, so "the envelope must not contain the
 *    word buckets" is not available here the way `not.toContain('sequence')` was for
 *    `order`.
 *
 * The oracle in this file is written out by hand rather than imported, so the generator and
 * the test cannot agree with each other while both being wrong.
 *
 * `toInstance()`'s allowlist gains `sort` in `index.api.test.js` in the same commit; its own
 * test already fails if a template ships a visual kind with no allowlist entry.
 */
import { test } from 'node:test'
import assert from 'node:assert/strict'

import { check, getProblem, listProblems, render, toInstance } from '../../../index.js'
import { templates } from './sort-quadrilaterals.js'

const ID = 'm5.g.classify-shapes/sort-quadrilaterals'
const SKILL = 'm5.g.classify-shapes'
const COUNT = 6
const SEEDS = [1, 2, 7, 42, 12_345, 999_999]
const SWEEP = Array.from({ length: 400 }, (unused, index) => index + 1)

/**
 * The independent oracle: for each target, the shapes that are ALWAYS one.
 * Standard elementary geometry, and true under both definitions of a trapezoid.
 */
const ALWAYS = {
  quadrilateral: ['Square', 'Rectangle', 'Rhombus', 'Parallelogram', 'Trapezoid', 'Kite'],
  parallelogram: ['Square', 'Rectangle', 'Rhombus', 'Parallelogram'],
  rectangle: ['Square', 'Rectangle'],
  rhombus: ['Square', 'Rhombus'],
}
const TARGETS = Object.keys(ALWAYS)
const POOL = [
  'Square',
  'Rectangle',
  'Rhombus',
  'Parallelogram',
  'Trapezoid',
  'Kite',
  'Triangle',
  'Pentagon',
  'Hexagon',
  'Octagon',
]

const rendered = (seed) => render(getProblem(ID), seed)

/** The target this seed asks about, read back out of the prompt. */
const targetOf = (full) => {
  const match = /always a ([a-z]+)\b/.exec(full.prompt)
  assert.ok(match, `the prompt does not name a target: ${full.prompt}`)
  return match[1]
}

const bucketLabel = (full, id) => full.visual.buckets.find((bucket) => bucket.id === id).label
const itemLabel = (full, id) => full.visual.items.find((item) => item.id === id).label

/** The bucket whose label begins "Always", and the one whose label begins "Not always". */
const alwaysBucket = (full) => full.visual.buckets.find((bucket) => bucket.label.startsWith('Always'))
const notAlwaysBucket = (full) => full.visual.buckets.find((bucket) => bucket.label.startsWith('Not always'))

/** The bucket id the answer puts an item in. */
const placementOf = (full, itemId) =>
  Object.keys(full.answer.buckets).find((id) => full.answer.buckets[id].includes(itemId))

/** A response that repeats the answer, with the order inside each bucket reversed. */
const asResponse = (full) => ({
  buckets: Object.fromEntries(Object.entries(full.answer.buckets).map(([id, ids]) => [id, [...ids].reverse()])),
})

const RIGHT = { correct: true, reason: null }
const WRONG = { correct: false, reason: 'wrong' }
const INVALID = { correct: false, reason: 'invalid' }

test('the module exports one template, and it is registered in the package', () => {
  assert.equal(templates.length, 1)
  assert.equal(templates[0].id, ID)
  assert.equal(templates[0].skill, SKILL)
  assert.equal(templates[0].widget, 'sort')
  assert.equal(templates[0].version, 1)

  const listed = listProblems().filter((problem) => problem.id === ID)
  assert.equal(listed.length, 1, 'the template is not reachable through listProblems()')
  assert.equal(listed[0].widget, 'sort')
  assert.equal(listed[0].subject, 'math')
  assert.equal(listed[0].grade, 5)
  assert.ok(listed[0].title.length > 0)
  assert.equal(getProblem(ID), templates[0])
})

test('the gallery can now show a sort card, which it could not before', () => {
  const widgets = new Set(listProblems().map((problem) => problem.widget))
  assert.ok(widgets.has('sort'), 'listProblems() still reports no sort widget')
})

test('every seed renders six labelled cards, two named buckets, and nothing else', () => {
  for (const seed of SWEEP) {
    const full = rendered(seed)
    assert.equal(full.widget, 'sort', `seed ${seed}`)
    assert.equal(full.visual.kind, 'sort', `seed ${seed}`)

    assert.equal(full.visual.items.length, COUNT, `seed ${seed}`)
    full.visual.items.forEach((item, index) => {
      assert.deepEqual(Object.keys(item).sort(), ['id', 'label'], `seed ${seed} item ${index}`)
      assert.equal(item.id, `item-${index}`, `seed ${seed}: ids are assigned in display order`)
      assert.ok(POOL.includes(item.label), `seed ${seed}: ${item.label} is not a shape this template knows`)
    })
    assert.equal(new Set(full.visual.items.map((item) => item.label)).size, COUNT, `seed ${seed}: a shape twice`)

    assert.equal(full.visual.buckets.length, 2, `seed ${seed}`)
    for (const bucket of full.visual.buckets) {
      assert.deepEqual(Object.keys(bucket).sort(), ['id', 'label'], `seed ${seed}`)
      assert.ok(bucket.id.length > 0, `seed ${seed}`)
      assert.ok(bucket.label.length > 0, `seed ${seed}`)
    }
    assert.equal(new Set(full.visual.buckets.map((bucket) => bucket.id)).size, 2, `seed ${seed}`)
    assert.ok(alwaysBucket(full), `seed ${seed}: no "Always …" bucket`)
    assert.ok(notAlwaysBucket(full), `seed ${seed}: no "Not always …" bucket`)
  }
})

test('the prompt and both bucket labels ask about the same target, and ask "always"', () => {
  for (const seed of SWEEP) {
    const full = rendered(seed)
    const target = targetOf(full)
    assert.ok(TARGETS.includes(target), `seed ${seed}: unknown target ${target}`)
    assert.notEqual(target, 'square', `seed ${seed}: a square target leaves one card in a bucket`)
    assert.notEqual(target, 'trapezoid', `seed ${seed}: the trapezoid hierarchy is disputed`)

    assert.equal(alwaysBucket(full).label, `Always a ${target}`, `seed ${seed}`)
    assert.equal(notAlwaysBucket(full).label, `Not always a ${target}`, `seed ${seed}`)
  }
})

test('not a digit in anything the kid can see', () => {
  for (const seed of SWEEP) {
    const full = rendered(seed)
    const visible = [full.prompt, ...full.visual.items.map((item) => item.label), ...full.visual.buckets.map((bucket) => bucket.label)]
    for (const text of visible) {
      assert.doesNotMatch(text, /\d/, `seed ${seed}: "${text}" carries a digit`)
    }
  }
})

test('the answer places every card exactly once, and agrees with the hierarchy', () => {
  for (const seed of SWEEP) {
    const full = rendered(seed)
    const target = targetOf(full)
    const bucketIds = full.visual.buckets.map((bucket) => bucket.id)

    assert.deepEqual(Object.keys(full.answer.buckets).sort(), [...bucketIds].sort(), `seed ${seed}`)
    const placed = bucketIds.flatMap((id) => full.answer.buckets[id])
    assert.equal(placed.length, COUNT, `seed ${seed}: not every card is placed exactly once`)
    assert.deepEqual([...placed].sort(), full.visual.items.map((item) => item.id).sort(), `seed ${seed}`)

    for (const item of full.visual.items) {
      const expected = ALWAYS[target].includes(item.label) ? alwaysBucket(full).id : notAlwaysBucket(full).id
      assert.equal(
        placementOf(full, item.id),
        expected,
        `seed ${seed}: ${item.label} is in the wrong bucket for "always a ${target}"`,
      )
    }
  }
})

test('both buckets hold at least two cards, so neither is a giveaway', () => {
  for (const seed of SWEEP) {
    const full = rendered(seed)
    for (const bucket of full.visual.buckets) {
      assert.ok(
        full.answer.buckets[bucket.id].length >= 2,
        `seed ${seed}: "${bucket.label}" holds ${full.answer.buckets[bucket.id].length}`,
      )
    }
  }
})

test('the cards never arrive already grouped, so the display order is not the answer', () => {
  for (const seed of SWEEP) {
    const full = rendered(seed)
    const membership = full.visual.items.map((item) => placementOf(full, item.id))
    const changes = membership.filter((id, index) => index > 0 && id !== membership[index - 1]).length
    assert.ok(changes >= 2, `seed ${seed}: the cards are grouped (${membership.join(',')})`)

    // The ids run in display order, so sorting them must not reconstruct the grouping either.
    const sorted = full.visual.items.map((item) => item.id).sort()
    for (const bucket of full.visual.buckets) {
      const size = full.answer.buckets[bucket.id].length
      assert.notDeepEqual(
        sorted.slice(0, size).sort(),
        [...full.answer.buckets[bucket.id]].sort(),
        `seed ${seed}: the first ${size} ids are exactly "${bucket.label}"`,
      )
    }
  }
})

/**
 * The rule above says the cards are not handed over in two blocks. That is necessary and
 * nowhere near sufficient, and the first implementation proved it: it interleaved them
 * STRICTLY — always, not-always, always, not-always — which changes value five times and
 * sails through. Measured over four hundred seeds, display position 1 was in the "Always"
 * bucket 100% of the time, positions 2, 4 and 6 never were, and the whole template produced
 * exactly two distinct arrangements, `ANANNN` and `ANANAN`.
 *
 * A kid who notices that scores full marks without reading a single shape name, which is
 * the same thing as the exercise not existing. So the arrangement is measured, not merely
 * checked for not being the worst case.
 */
test('no display position tells a kid which bucket the card goes in', () => {
  const alwaysAt = Array.from({ length: COUNT }, () => 0)
  for (const seed of SWEEP) {
    const full = rendered(seed)
    const always = alwaysBucket(full).id
    full.visual.items.forEach((item, index) => {
      if (placementOf(full, item.id) === always) alwaysAt[index] += 1
    })
  }
  for (const [index, count] of alwaysAt.entries()) {
    const share = count / SWEEP.length
    assert.ok(
      share > 0.2 && share < 0.8,
      `position ${index + 1} is in the "Always" bucket ${Math.round(share * 100)}% of the time`,
    )
  }
})

test('the arrangement is not one memorised pattern repeated', () => {
  const patterns = new Set()
  for (const seed of SWEEP) {
    const full = rendered(seed)
    const always = alwaysBucket(full).id
    patterns.add(full.visual.items.map((item) => (placementOf(full, item.id) === always ? 'A' : 'N')).join(''))
  }
  assert.ok(
    patterns.size >= 8,
    `only ${patterns.size} distinct arrangements over ${SWEEP.length} seeds: ${[...patterns].sort().join(' ')}`,
  )
})

test('across seeds the target moves and neither bucket is always shown first', () => {
  const targets = new Set()
  const firstLabels = new Set()
  for (const seed of SWEEP) {
    const full = rendered(seed)
    targets.add(targetOf(full))
    firstLabels.add(full.visual.buckets[0].label.startsWith('Always') ? 'always' : 'not-always')
  }
  assert.deepEqual([...targets].sort(), [...TARGETS].sort(), 'some target never comes up')
  assert.deepEqual([...firstLabels].sort(), ['always', 'not-always'], 'one bucket is always on the left')
})

test('the same seed renders the same problem, every time', () => {
  for (const seed of SEEDS) {
    assert.deepEqual(rendered(seed), rendered(seed), `seed ${seed}`)
  }
})

test('different seeds do not all render the same problem', () => {
  const shapes = new Set(SWEEP.map((seed) => rendered(seed).visual.items.map((item) => item.label).join('|')))
  assert.ok(shapes.size > 20, `only ${shapes.size} distinct boards over ${SWEEP.length} seeds`)
})

test('the checker agrees with the answer, and can still be wrong and unfinished', () => {
  for (const seed of SWEEP) {
    const full = rendered(seed)
    assert.deepEqual(check('sort', full.answer, asResponse(full)), RIGHT, `seed ${seed}: order inside a bucket must not matter`)

    const [first, second] = full.visual.buckets.map((bucket) => bucket.id)
    const swapped = {
      buckets: {
        [first]: [...full.answer.buckets[first].slice(1), full.answer.buckets[second][0]],
        [second]: [...full.answer.buckets[second].slice(1), full.answer.buckets[first][0]],
      },
    }
    assert.deepEqual(check('sort', full.answer, swapped), WRONG, `seed ${seed}: one card in each wrong bucket`)

    const short = {
      buckets: {
        [first]: full.answer.buckets[first].slice(1),
        [second]: [...full.answer.buckets[second]],
      },
    }
    assert.deepEqual(check('sort', full.answer, short), INVALID, `seed ${seed}: a card left in the tray`)
  }
})

test('the explanation states both groups, and every card is accounted for in it', () => {
  for (const seed of SWEEP) {
    const full = rendered(seed)
    assert.ok(full.explanation.includes(alwaysBucket(full).label), `seed ${seed}`)
    assert.ok(full.explanation.includes(notAlwaysBucket(full).label), `seed ${seed}`)
    for (const item of full.visual.items) {
      assert.ok(full.explanation.includes(item.label), `seed ${seed}: ${item.label} is missing from the explanation`)
    }
  }
})

test('two method hints, and they are not the same sentence twice', () => {
  for (const seed of SEEDS) {
    const full = rendered(seed)
    assert.equal(full.hints.length, 2, `seed ${seed}`)
    for (const hint of full.hints) {
      assert.equal(typeof hint, 'string', `seed ${seed}`)
      assert.ok(hint.trim().length > 0, `seed ${seed}`)
    }
    assert.notEqual(full.hints[0], full.hints[1], `seed ${seed}`)
  }
})

test('nothing the kid receives says which bucket a card belongs in', () => {
  for (const seed of SWEEP) {
    const full = rendered(seed)
    const instance = toInstance(full)
    assert.equal(instance.answer, undefined, `seed ${seed}`)
    assert.equal(instance.explanation, undefined, `seed ${seed}`)
    assert.deepEqual(Object.keys(instance.visual).sort(), ['buckets', 'items', 'kind'], `seed ${seed}`)

    const envelope = JSON.stringify(instance)
    assert.ok(!envelope.includes(full.explanation), `seed ${seed}: the explanation travels`)
    for (const bucket of full.visual.buckets) {
      const ids = full.answer.buckets[bucket.id]
      for (const separator of ['", "', '","', ',', ' ', '']) {
        assert.ok(
          !envelope.includes(ids.join(separator)),
          `seed ${seed}: "${bucket.label}" is spelled out in the envelope with "${separator}"`,
        )
      }
    }
  }
})
