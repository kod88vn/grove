/**
 * P2.6 part 1 of 2 — the `choice` widget's sample problem.
 *
 * HOMEWORK_PLAN.md §6.3 gives `choice` as the first Band A widget: "`choice` / `multi-choice`
 * | everything | exact id match | A". The checker has shipped since P1.4 (`check.test.js`);
 * what has never existed is a template, and `app/dev/widgets/samples.js` maps over
 * `listProblems()`, so a widget with no template does not appear in the P2.5 gallery at all.
 *
 * WHERE THE SAMPLE COMES FROM. HOMEWORK_PROGRESS.md records the rule once: prefer a Grade 5
 * skill already in the catalog whose §7/§8 widget list names the widget, and only fall back to
 * an off-grade sample tagged `ccss: []` when none exists. One exists here —
 * `m5.oa.prime-composite`, §7 group "H. Factors, Multiples And Number Theory" — and "is 37
 * prime or composite?" is a two-option question whose answer is an id, which is precisely what
 * `check('choice', …)` grades. So nothing new is tagged and nothing is invented.
 *
 * WHAT THIS SPEC REFUSES TO ACCEPT.
 *
 * 1. A TEMPLATE THAT AGREES WITH ITSELF. Primality is recomputed here by trial division, from
 *    the number in the prompt, and compared with the answer id. A generator that decides
 *    "prime" and then emits a composite cannot pass, however consistent it is internally.
 * 2. A GUESSABLE POSITION. Two options means a kid who always taps the first one is right half
 *    the time by luck and *always* right if the generator puts the answer first. The order is
 *    therefore measured over 400 seeds and must be genuinely mixed. This is the assertion that
 *    a correct-looking implementation fails.
 * 3. A DEGENERATE NUMBER RANGE. §6.8: "Maths number ranges are per skill and asserted by
 *    tests." Both verdicts must occur often, and composites must not all be even — "is it
 *    even?" is not the skill.
 * 4. AN EXPLANATION THAT ASSERTS RATHER THAN SHOWS. For a composite the explanation must carry
 *    a real factor pair, parsed out and multiplied back here.
 *
 * `toInstance()`'s allowlist is extended in `index.api.test.js` in the same commit; its own
 * test already fails if a template ships a visual kind with no allowlist entry.
 */
import { test } from 'node:test'
import assert from 'node:assert/strict'

import { check, getProblem, listProblems, render, toInstance } from '../../../index.js'
import { templates } from './prime-composite.js'

const ID = 'm5.oa.prime-composite/prime-or-composite'
const SKILL = 'm5.oa.prime-composite'
const SEEDS = [1, 2, 7, 42, 12_345, 999_999]
const SWEEP = Array.from({ length: 400 }, (unused, index) => index + 1)

const isPrime = (n) => {
  if (!Number.isInteger(n) || n < 2) return false
  for (let divisor = 2; divisor * divisor <= n; divisor++) if (n % divisor === 0) return false
  return true
}

/** The number the prompt is about. Exactly one integer may appear, or "which number" is a guess. */
const subjectOf = (rendered) => {
  const digits = rendered.prompt.match(/\d+/g) ?? []
  assert.equal(digits.length, 1, `${rendered.seed}: the prompt names ${digits.length} numbers, not 1`)
  return Number(digits[0])
}

const rendered = (seed) => render(getProblem(ID), seed)

test('the module exports one template, and it is registered in the package', () => {
  assert.equal(templates.length, 1)
  assert.equal(templates[0].id, ID)
  assert.equal(templates[0].skill, SKILL)
  assert.equal(templates[0].widget, 'choice')
  assert.equal(templates[0].version, 1)

  const listed = listProblems().filter((problem) => problem.id === ID)
  assert.equal(listed.length, 1, 'the template is not reachable through listProblems()')
  assert.equal(listed[0].widget, 'choice')
  assert.equal(listed[0].subject, 'math')
  assert.equal(listed[0].grade, 5)
  assert.ok(listed[0].title.length > 0)
  assert.equal(getProblem(ID), templates[0])
})

test('the gallery can now show a choice card, which it could not before', () => {
  const widgets = new Set(listProblems().map((problem) => problem.widget))
  assert.ok(widgets.has('choice'), 'listProblems() still reports no choice widget')
})

test('every seed renders two id-bearing options and nothing else', () => {
  for (const seed of SWEEP) {
    const full = rendered(seed)
    assert.equal(full.widget, 'choice')
    assert.equal(full.visual.kind, 'choice')
    assert.deepEqual(Object.keys(full.visual).sort(), ['kind', 'options'], `seed ${seed}`)
    assert.equal(full.visual.options.length, 2, `seed ${seed}: not two options`)
    for (const option of full.visual.options) {
      assert.deepEqual(Object.keys(option).sort(), ['id', 'label'], `seed ${seed}: option shape`)
      assert.equal(typeof option.id, 'string')
      assert.ok(option.id.length > 0)
      assert.equal(typeof option.label, 'string')
      assert.ok(option.label.length > 0)
    }
    assert.deepEqual(
      full.visual.options.map((option) => option.id).sort(),
      ['composite', 'prime'],
      `seed ${seed}: option ids`,
    )
    assert.deepEqual(Object.keys(full.answer), ['id'], `seed ${seed}: answer shape`)
    assert.ok(
      full.visual.options.some((option) => option.id === full.answer.id),
      `seed ${seed}: the answer id is not one of the options`,
    )
  }
})

test('the answer is the truth about the number, recomputed here from the prompt', () => {
  for (const seed of SWEEP) {
    const full = rendered(seed)
    const n = subjectOf(full)
    const expected = isPrime(n) ? 'prime' : 'composite'
    assert.equal(full.answer.id, expected, `seed ${seed}: ${n} is ${expected}`)
  }
})

test('the prompt never varies with the answer — only the number changes', () => {
  const shapes = new Set(SWEEP.map((seed) => rendered(seed).prompt.replace(/\d+/g, 'N')))
  assert.equal(shapes.size, 1, `the prompt has ${shapes.size} shapes: ${[...shapes].join(' | ')}`)
})

test('the right option is not always in the same place', () => {
  let first = 0
  for (const seed of SWEEP) {
    const full = rendered(seed)
    if (full.visual.options[0].id === full.answer.id) first++
  }
  const share = first / SWEEP.length
  assert.ok(
    share > 0.3 && share < 0.7,
    `the answer is first in ${(share * 100).toFixed(1)}% of seeds — a kid who always taps the first option would score that`,
  )
})

test('both verdicts occur often, and composites are not all even', () => {
  const numbers = SWEEP.map((seed) => subjectOf(rendered(seed)))
  for (const n of numbers) {
    assert.ok(Number.isInteger(n) && n >= 2 && n <= 100, `${n} is outside the asserted 2..100 range`)
  }
  const primes = numbers.filter(isPrime)
  const composites = numbers.filter((n) => !isPrime(n))
  assert.ok(primes.length / numbers.length > 0.25, `only ${primes.length}/${numbers.length} primes`)
  assert.ok(composites.length / numbers.length > 0.25, `only ${composites.length}/${numbers.length} composites`)
  const oddComposites = composites.filter((n) => n % 2 === 1)
  assert.ok(
    oddComposites.length / composites.length > 0.1,
    `only ${oddComposites.length}/${composites.length} composites are odd — the exercise collapses to "is it even?"`,
  )
  assert.ok(new Set(numbers).size >= 20, `only ${new Set(numbers).size} distinct numbers over 400 seeds`)
})

test('a composite explanation shows a real factor pair; a prime explanation does not', () => {
  for (const seed of SWEEP) {
    const full = rendered(seed)
    const n = subjectOf(full)
    const pair = full.explanation.match(/(\d+)\s*×\s*(\d+)/)
    if (isPrime(n)) {
      assert.equal(pair, null, `seed ${seed}: ${n} is prime but the explanation shows ${pair?.[0]}`)
      continue
    }
    assert.ok(pair, `seed ${seed}: ${n} is composite and the explanation shows no factor pair`)
    const [, a, b] = pair.map(Number)
    assert.equal(a * b, n, `seed ${seed}: ${a} × ${b} is not ${n}`)
    assert.ok(a > 1 && b > 1, `seed ${seed}: ${a} × ${b} is the trivial factorisation`)
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
    const other = full.visual.options.find((option) => option.id !== full.answer.id)
    assert.deepEqual(check('choice', full.answer, { id: full.answer.id }), { correct: true, reason: null })
    assert.deepEqual(check('choice', full.answer, { id: other.id }), { correct: false, reason: 'wrong' })
  }
  const full = rendered(SEEDS[0])
  for (const bad of [null, undefined, {}, { id: 7 }, 'prime']) {
    assert.deepEqual(check('choice', full.answer, bad), { correct: false, reason: 'invalid' }, String(bad))
  }
})

test('the same seed always renders the same problem', () => {
  for (const seed of SEEDS) assert.deepEqual(rendered(seed), rendered(seed))
})

test('the instance a client receives carries the options and no answer', () => {
  for (const seed of SEEDS) {
    const full = rendered(seed)
    const instance = toInstance(full)
    assert.deepEqual(Object.keys(instance.visual).sort(), ['kind', 'options'])
    assert.deepEqual(instance.visual.options, full.visual.options)
    const serialised = JSON.stringify(instance)
    assert.ok(!serialised.includes(full.explanation), `seed ${seed}: the explanation is in the instance`)
    for (const hint of full.hints) assert.ok(!serialised.includes(hint), `seed ${seed}: a hint is in the instance`)
    assert.equal(instance.answer, undefined)
  }
})
