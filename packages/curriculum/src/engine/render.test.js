/**
 * P1.2: engine/render.js — template + seed -> instance (HOMEWORK_PLAN §6.1, §6.2).
 *
 * render(template, seed) builds a fresh createRng(seed), calls template.generate(rng) once, and
 * returns { problemId, skill, version, difficulty, widget, seed, prompt, visual, answer, hints,
 * explanation }. The server re-renders from the stored seed to check an attempt (§6.6), so the
 * same template and seed must always give the same instance.
 *
 * A template or a generate() result with the wrong shape is a bug in our content: render throws
 * a TypeError that names the template, instead of shipping a broken problem to a kid.
 */
import { test } from 'node:test'
import assert from 'node:assert/strict'

import { render } from './render.js'

// The example template from HOMEWORK_PLAN §6.2.
const missingFactor = {
  id: 'm3.oa.mult-facts/missing-factor',
  skill: 'm3.oa.mult-facts',
  title: 'Mystery Factor',
  difficulty: 2,
  widget: 'number',
  version: 1,
  generate(rng) {
    const a = rng.int(2, 10)
    const b = rng.int(2, 10)
    return {
      prompt: `? × ${b} = ${a * b}`,
      answer: { value: a },
      hints: [`Count by ${b}s until you reach ${a * b}.`, `${a * b} ÷ ${b} = ?`],
      explanation: `${a} × ${b} = ${a * b}, so the mystery factor is ${a}.`,
    }
  },
}

const withGenerate = (generate) => ({ ...missingFactor, generate })
const validOutput = { prompt: 'p', answer: { value: 1 }, hints: [], explanation: 'e' }

test('renders the §6.2 example for seed 1 exactly (mulberry32 draws 0.627… then 0.0027…)', () => {
  // int(2, 10) = 2 + floor(0.6270739405881613 * 9) = 7, then 2 + floor(0.002735721180215478 * 9) = 2
  assert.deepEqual(render(missingFactor, 1), {
    problemId: 'm3.oa.mult-facts/missing-factor',
    skill: 'm3.oa.mult-facts',
    version: 1,
    difficulty: 2,
    widget: 'number',
    seed: 1,
    prompt: '? × 2 = 14',
    visual: null,
    answer: { value: 7 },
    hints: ['Count by 2s until you reach 14.', '14 ÷ 2 = ?'],
    explanation: '7 × 2 = 14, so the mystery factor is 7.',
  })
})

test('a different seed gives a different problem (seed 42 draws 0.601… then 0.448…)', () => {
  const instance = render(missingFactor, 42)
  assert.equal(instance.seed, 42)
  assert.equal(instance.prompt, '? × 6 = 42')
  assert.deepEqual(instance.answer, { value: 7 })
})

test('the same template and seed always render the same instance', () => {
  assert.deepEqual(render(missingFactor, 2024), render(missingFactor, 2024))
})

test('each render starts a fresh generator from the seed', () => {
  const first = render(missingFactor, 5)
  render(missingFactor, 6)
  assert.deepEqual(render(missingFactor, 5), first)
})

test('generate receives a seeded rng with next, int, pick and shuffle', () => {
  let received
  render(withGenerate((rng) => { received = rng; return validOutput }), 1)
  for (const name of ['next', 'int', 'pick', 'shuffle']) {
    assert.equal(typeof received[name], 'function', name)
  }
})

test('generate is called exactly once per render', () => {
  let calls = 0
  render(withGenerate(() => { calls += 1; return validOutput }), 1)
  assert.equal(calls, 1)
})

test('visual is passed through when generate provides one', () => {
  const visual = { kind: 'bar', parts: 4, shaded: 3 }
  const instance = render(withGenerate(() => ({ ...validOutput, visual })), 1)
  assert.deepEqual(instance.visual, visual)
})

test('an invalid seed is rejected with a RangeError before generate runs', () => {
  let called = false
  const template = withGenerate(() => { called = true; return validOutput })
  for (const seed of [-1, 1.5, 2 ** 32, '1', undefined]) {
    assert.throws(() => render(template, seed), RangeError, String(seed))
  }
  assert.equal(called, false)
})

test('a template with a missing or malformed field throws a TypeError naming the template', () => {
  const broken = [
    { ...missingFactor, id: '' },
    { ...missingFactor, id: undefined },
    { ...missingFactor, skill: '' },
    { ...missingFactor, widget: '' },
    { ...missingFactor, widget: 3 },
    { ...missingFactor, version: 0 },
    { ...missingFactor, version: 1.5 },
    { ...missingFactor, difficulty: 0 },
    { ...missingFactor, difficulty: 4 },
    { ...missingFactor, difficulty: '2' },
    { ...missingFactor, generate: undefined },
    { ...missingFactor, generate: 'generate' },
  ]
  for (const template of broken) {
    assert.throws(() => render(template, 1), TypeError, JSON.stringify(template))
  }
  assert.throws(
    () => render({ ...missingFactor, version: 0 }, 1),
    /m3\.oa\.mult-facts\/missing-factor/,
  )
  assert.throws(() => render(undefined, 1), TypeError)
  assert.throws(() => render(null, 1), TypeError)
})

test('a generate result with a missing or malformed field throws a TypeError naming the template', () => {
  const broken = [
    undefined,
    null,
    'prompt',
    { ...validOutput, prompt: '' },
    { ...validOutput, prompt: 3 },
    { ...validOutput, prompt: undefined },
    { ...validOutput, answer: undefined },
    { ...validOutput, answer: null },
    { ...validOutput, hints: undefined },
    { ...validOutput, hints: 'hint' },
    { ...validOutput, hints: ['ok', ''] },
    { ...validOutput, hints: ['ok', 3] },
    { ...validOutput, explanation: '' },
    { ...validOutput, explanation: undefined },
  ]
  for (const output of broken) {
    assert.throws(() => render(withGenerate(() => output), 1), TypeError, JSON.stringify(output))
  }
  assert.throws(
    () => render(withGenerate(() => ({ ...validOutput, prompt: '' })), 1),
    /m3\.oa\.mult-facts\/missing-factor/,
  )
})

test('a generate result with an unknown key throws, so it cannot override problemId, widget or seed', () => {
  for (const extra of [{ widget: 'choice' }, { problemId: 'other' }, { seed: 9 }, { hint: 'typo' }]) {
    assert.throws(
      () => render(withGenerate(() => ({ ...validOutput, ...extra })), 1),
      TypeError,
      JSON.stringify(extra),
    )
  }
})

test('render does not modify the template', () => {
  const template = { ...missingFactor }
  const before = { ...template }
  render(template, 1)
  assert.deepEqual(template, before)
})
