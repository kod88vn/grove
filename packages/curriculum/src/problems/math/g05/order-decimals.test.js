/**
 * P2.7 part 1b of 2 — the `order` widget's sample problem.
 *
 * HOMEWORK_PLAN.md §6.3 (line 200), quoted whole:
 *
 *   | `order` (drag or tap-to-order) | sequence events, sentence scramble, proof steps |
 *   | sequence equality | A |
 *
 * WHERE THE SAMPLE COMES FROM. HOMEWORK_PROGRESS.md states the rule once: prefer a Grade 5
 * skill already in the catalog, and only fall back to an off-grade sample tagged `ccss: []`
 * when none exists. One exists — `m5.nbt.compare-decimals` (`catalog/math/grade-05.js`,
 * `ccss: ['5.NBT.A.3']`) — and putting four decimals in order is the ordinary classroom form
 * of that skill and is exactly a "sequence equality" task. So nothing is tagged off-grade
 * and `grade-05.offgrade.test.js`'s list is untouched.
 *
 * WHAT THIS SPEC REFUSES TO ACCEPT.
 *
 * 1. AN ANSWER THAT LEAKS THROUGH THE IDS. The items arrive shuffled, so the only thing
 *    standing between a kid and a free star is that the id of a card says nothing about
 *    where the card belongs. Number the cards in answer order — `item-0` first, `item-1`
 *    second — and `JSON.stringify(instance)` hands over the solution to anyone who opens
 *    devtools. Measured below: over 400 seeds, sorting the ids must almost never reproduce
 *    the answer.
 * 2. A SHUFFLE THAT IS ALREADY THE ANSWER. If the displayed arrangement can be the correct
 *    one, then on those seeds an untouched widget scores a star, and the same suite is
 *    flaky-by-seed. It must never happen — not rarely, never.
 * 3. A PROMPT THAT DOES NOT MEAN WHAT IT SAYS. Half the seeds ask least→greatest and half
 *    greatest→least. A generator that always sorts ascending and prints whichever sentence
 *    it fancies is caught here: the direction word and the answer are compared, per seed.
 *    (This is also the assertion that makes the exercise real. "Always sort ascending" is a
 *    habit, not the skill; 5.NBT.A.3 is about comparing, in whichever direction is asked.)
 * 4. NUMBERS THAT DO NOT TEST PLACE VALUE. The misconception this skill exists to break is
 *    "more digits means bigger" — 0.45 looks larger than 0.5. Every seed must contain at
 *    least one pair where that belief gives the wrong answer, the lengths must genuinely
 *    vary, and the whole-number parts must match so the decision cannot be made before the
 *    decimal point.
 * 5. AN EXPLANATION THAT ASSERTS RATHER THAN SHOWS. It must lay the values out in answer
 *    order with the right comparator between them; the chain is parsed back out here and
 *    checked against the answer.
 *
 * `toInstance()`'s allowlist gains `order` in `index.api.test.js` in the same commit; its own
 * test already fails if a template ships a visual kind with no allowlist entry.
 */
import { test } from 'node:test'
import assert from 'node:assert/strict'

import { check, getProblem, listProblems, render, toInstance } from '../../../index.js'
import { templates } from './order-decimals.js'

const ID = 'm5.nbt.compare-decimals/order-decimals'
const SKILL = 'm5.nbt.compare-decimals'
const COUNT = 4
const SEEDS = [1, 2, 7, 42, 12_345, 999_999]
const SWEEP = Array.from({ length: 400 }, (unused, index) => index + 1)

const ASCENDING = /least to greatest/i
const DESCENDING = /greatest to least/i

const rendered = (seed) => render(getProblem(ID), seed)

const labelOf = (full, id) => full.visual.items.find((item) => item.id === id).label

/** The values in the order the answer puts them. */
const answerLabels = (full) => full.answer.sequence.map((id) => labelOf(full, id))
const answerValues = (full) => answerLabels(full).map(Number)

/** Every number in a piece of text, in the order it is written. */
const numbersIn = (text) => (text.match(/\d+(?:\.\d+)?/g) ?? []).map(Number)

/** The digits after the point, read as a whole number — i.e. what "more digits = bigger" sees. */
const misreading = (label) => Number(label.split('.')[1])

const isAscending = (values) => values.every((value, index) => index === 0 || values[index - 1] < value)
const isDescending = (values) => values.every((value, index) => index === 0 || values[index - 1] > value)

test('the module exports one template, and it is registered in the package', () => {
  assert.equal(templates.length, 1)
  assert.equal(templates[0].id, ID)
  assert.equal(templates[0].skill, SKILL)
  assert.equal(templates[0].widget, 'order')
  assert.equal(templates[0].version, 1)

  const listed = listProblems().filter((problem) => problem.id === ID)
  assert.equal(listed.length, 1, 'the template is not reachable through listProblems()')
  assert.equal(listed[0].widget, 'order')
  assert.equal(listed[0].subject, 'math')
  assert.equal(listed[0].grade, 5)
  assert.ok(listed[0].title.length > 0)
  assert.equal(getProblem(ID), templates[0])
})

test('the gallery can now show an order card, which it could not before', () => {
  const widgets = new Set(listProblems().map((problem) => problem.widget))
  assert.ok(widgets.has('order'), 'listProblems() still reports no order widget')
})

test('every seed renders four labelled cards and a sequence answer, and nothing else', () => {
  for (const seed of SWEEP) {
    const full = rendered(seed)
    assert.equal(full.widget, 'order', `seed ${seed}`)
    assert.equal(full.visual.kind, 'order', `seed ${seed}`)
    assert.deepEqual(Object.keys(full.visual).sort(), ['items', 'kind'], `seed ${seed}`)
    assert.equal(full.visual.items.length, COUNT, `seed ${seed}: not ${COUNT} cards`)

    for (const item of full.visual.items) {
      assert.deepEqual(Object.keys(item).sort(), ['id', 'label'], `seed ${seed}: card shape`)
      assert.equal(typeof item.id, 'string')
      assert.ok(item.id.length > 0, `seed ${seed}: empty id`)
      assert.equal(typeof item.label, 'string')
      assert.match(item.label, /^\d\.\d{1,3}$/, `seed ${seed}: ${item.label} is not a 1-3 place decimal`)
      assert.doesNotMatch(item.label, /0$/, `seed ${seed}: ${item.label} carries a trailing zero`)
    }

    const ids = full.visual.items.map((item) => item.id)
    assert.equal(new Set(ids).size, COUNT, `seed ${seed}: duplicate card ids`)

    assert.deepEqual(Object.keys(full.answer), ['sequence'], `seed ${seed}: answer shape`)
    assert.deepEqual(
      [...full.answer.sequence].sort(),
      [...ids].sort(),
      `seed ${seed}: the answer is not a permutation of the cards on screen`,
    )
  }
})

test('the cards are never already in the right order — an untouched widget is always wrong', () => {
  for (const seed of SWEEP) {
    const full = rendered(seed)
    const displayed = full.visual.items.map((item) => item.id)
    assert.notDeepEqual(
      displayed,
      full.answer.sequence,
      `seed ${seed}: the cards are displayed in the answer's order, so doing nothing scores a star`,
    )
  }
})

test('the answer really is the values in order, recomputed here from the labels', () => {
  for (const seed of SWEEP) {
    const full = rendered(seed)
    const values = answerValues(full)
    assert.equal(new Set(values).size, COUNT, `seed ${seed}: the values are not distinct, so the order is ambiguous`)
    const ascending = ASCENDING.test(full.prompt)
    const descending = DESCENDING.test(full.prompt)
    assert.ok(
      ascending !== descending,
      `seed ${seed}: the prompt asks for ${ascending && descending ? 'both' : 'neither'} direction: ${full.prompt}`,
    )
    if (ascending) assert.ok(isAscending(values), `seed ${seed}: asked least→greatest, answered ${values.join(', ')}`)
    else assert.ok(isDescending(values), `seed ${seed}: asked greatest→least, answered ${values.join(', ')}`)
  }
})

test('both directions are asked, and the prompt varies in nothing else', () => {
  const shapes = new Set(SWEEP.map((seed) => rendered(seed).prompt.replace(/\d+(\.\d+)?/g, 'N')))
  assert.equal(shapes.size, 2, `the prompt has ${shapes.size} shapes: ${[...shapes].join(' | ')}`)

  const ascending = SWEEP.filter((seed) => ASCENDING.test(rendered(seed).prompt)).length
  const share = ascending / SWEEP.length
  assert.ok(
    share > 0.3 && share < 0.7,
    `${(share * 100).toFixed(1)}% of seeds ask least→greatest — a kid who always sorts one way would score that`,
  )
})

test('the ids say nothing about where a card belongs', () => {
  // If the cards are numbered in answer order, sorting the ids IS the answer, every time.
  // With four cards, chance alone puts the sorted ids in answer order once in 24 seeds.
  let leaked = 0
  for (const seed of SWEEP) {
    const full = rendered(seed)
    const sorted = full.visual.items.map((item) => item.id).sort()
    if (sorted.join('\u0000') === full.answer.sequence.join('\u0000')) leaked++
  }
  assert.ok(
    leaked / SWEEP.length < 0.1,
    `sorting the ids gives the answer in ${leaked}/${SWEEP.length} seeds — the ids carry the solution`,
  )
})

test('the first card of the answer is not parked in one place on screen', () => {
  const positions = new Map()
  for (const seed of SWEEP) {
    const full = rendered(seed)
    const index = full.visual.items.findIndex((item) => item.id === full.answer.sequence[0])
    positions.set(index, (positions.get(index) ?? 0) + 1)
  }
  for (const [index, count] of positions) {
    assert.ok(
      count / SWEEP.length < 0.5,
      `the answer's first card sits at display position ${index} in ${count}/${SWEEP.length} seeds`,
    )
  }
})

test('every seed punishes "more digits means bigger", which is the point of 5.NBT.A.3', () => {
  for (const seed of SWEEP) {
    const full = rendered(seed)
    const labels = full.visual.items.map((item) => item.label)

    const wholes = new Set(labels.map((label) => label.split('.')[0]))
    assert.equal(wholes.size, 1, `seed ${seed}: whole parts ${[...wholes].join(', ')} — the decimals never matter`)

    const lengths = new Set(labels.map((label) => label.split('.')[1].length))
    assert.ok(lengths.size >= 2, `seed ${seed}: every value has ${[...lengths][0]} decimal places, so there is no trap`)

    const trap = labels.some((a) =>
      labels.some((b) => Number(a) > Number(b) && misreading(a) < misreading(b)),
    )
    assert.ok(trap, `seed ${seed}: ${labels.join(', ')} contains no pair where the longer decimal is the smaller one`)
  }
})

test('reading the decimals as whole numbers almost never produces the answer', () => {
  let fooled = 0
  for (const seed of SWEEP) {
    const full = rendered(seed)
    const labels = full.visual.items.map((item) => item.label)
    const ascending = ASCENDING.test(full.prompt)
    const misread = [...labels].sort((a, b) =>
      ascending ? misreading(a) - misreading(b) : misreading(b) - misreading(a),
    )
    if (misread.join(',') === answerLabels(full).join(',')) fooled++
  }
  assert.ok(
    fooled / SWEEP.length < 0.1,
    `the misconception scores in ${fooled}/${SWEEP.length} seeds — the sample teaches nothing`,
  )
})

test('the values are not the same four numbers every time', () => {
  const sets = new Set(
    SWEEP.map((seed) =>
      rendered(seed)
        .visual.items.map((item) => item.label)
        .sort()
        .join(','),
    ),
  )
  assert.ok(sets.size >= 20, `only ${sets.size} distinct sets of values over ${SWEEP.length} seeds`)
})

test('the explanation lays out the chain, in the answer order, with the right comparator', () => {
  for (const seed of SWEEP) {
    const full = rendered(seed)
    const ascending = ASCENDING.test(full.prompt)
    const wanted = ascending ? '<' : '>'
    const unwanted = ascending ? '>' : '<'

    const comparators = full.explanation.split(wanted).length - 1
    assert.equal(comparators, COUNT - 1, `seed ${seed}: ${comparators} "${wanted}" signs, expected ${COUNT - 1}`)
    assert.ok(!full.explanation.includes(unwanted), `seed ${seed}: the explanation also uses "${unwanted}"`)

    const written = numbersIn(full.explanation)
    const chain = answerValues(full)
    const at = written.findIndex((unused, index) => chain.every((value, offset) => written[index + offset] === value))
    assert.notEqual(
      at,
      -1,
      `seed ${seed}: the explanation writes ${written.join(', ')}, which never runs ${chain.join(', ')} in order`,
    )
  }
})

test('neither the prompt nor the hints give the ordering away', () => {
  for (const seed of SWEEP) {
    const full = rendered(seed)
    const wanted = answerValues(full).join(',')
    assert.notEqual(numbersIn(full.prompt).join(','), wanted, `seed ${seed}: the prompt lists them in order`)
    for (const hint of full.hints) {
      assert.notEqual(numbersIn(hint).join(','), wanted, `seed ${seed}: a hint lists them in order: ${hint}`)
    }
  }
})

test('there are at least two distinct hints', () => {
  for (const seed of SEEDS) {
    const full = rendered(seed)
    assert.ok(full.hints.length >= 2, `seed ${seed}: ${full.hints.length} hints`)
    assert.equal(new Set(full.hints).size, full.hints.length, `seed ${seed}: duplicate hints`)
  }
})

test('the shipped checker grades it right, wrong and unreadable', () => {
  for (const seed of SWEEP) {
    const full = rendered(seed)
    const displayed = full.visual.items.map((item) => item.id)
    assert.deepEqual(check('order', full.answer, { sequence: [...full.answer.sequence] }), {
      correct: true,
      reason: null,
    })
    assert.deepEqual(check('order', full.answer, { sequence: displayed }), { correct: false, reason: 'wrong' })
  }
  const full = rendered(SEEDS[0])
  for (const bad of [null, undefined, {}, { sequence: [] }, { sequence: ['nope'] }]) {
    assert.deepEqual(check('order', full.answer, bad), { correct: false, reason: 'invalid' }, String(bad))
  }
})

test('the same seed always renders the same problem', () => {
  for (const seed of SEEDS) assert.deepEqual(rendered(seed), rendered(seed))
})

test('the instance a client receives carries the cards and no answer', () => {
  for (const seed of SEEDS) {
    const full = rendered(seed)
    const instance = toInstance(full)
    assert.deepEqual(Object.keys(instance.visual).sort(), ['items', 'kind'])
    assert.deepEqual(instance.visual.items, full.visual.items)

    const serialised = JSON.stringify(instance)
    assert.ok(!serialised.includes(full.explanation), `seed ${seed}: the explanation is in the instance`)
    assert.ok(
      !serialised.includes(JSON.stringify(full.answer.sequence)),
      `seed ${seed}: the answer sequence is in the instance`,
    )
    for (const key of ['answer', 'sequence', 'hints', 'explanation']) {
      assert.ok(!Object.hasOwn(instance, key), `seed ${seed}: the instance carries "${key}"`)
    }
  }
})
