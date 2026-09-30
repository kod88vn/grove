import { test } from 'node:test'
import assert from 'node:assert/strict'
import { check, getProblem, getSkill, listProblems, render, toInstance } from '../../../index.js'

const ID = 'm5.nf.equiv-fractions/shade-equivalent'
const SKILL = 'm5.nf.equiv-fractions'
const seeds = Array.from({ length: 500 }, (_, index) => index + 1)
const gcd = (a, b) => b === 0 ? a : gcd(b, a % b)

test('Grade 5 catalog registers one difficulty-1 fraction-bar sample', () => {
  const skill = getSkill(SKILL)
  const template = getProblem(ID)
  assert.equal(skill?.grade, 5)
  assert.ok(template)
  assert.deepEqual(listProblems().filter((entry) => entry.id === ID).map(({ widget, difficulty, version, skill }) => ({ widget, difficulty, version, skill })), [
    { widget: 'fraction-bar', difficulty: 1, version: 1, skill: SKILL },
  ])
})

test('500 seeds use proper reduced reference fractions and independently equivalent answer bars', () => {
  const pairs = new Set()
  const problems = new Set()
  for (const seed of seeds) {
    const item = render(getProblem(ID), seed)
    const { reference, segments } = item.visual
    const { num, den } = reference
    const multiplier = segments / den
    assert.equal(item.widget, 'fraction-bar', `seed ${seed}`)
    assert.equal(item.visual.kind, 'fraction-bar', `seed ${seed}`)
    assert.ok(Number.isInteger(num) && num >= 1 && num < den, `seed ${seed}`)
    assert.ok(Number.isInteger(den) && den >= 2 && den <= 6, `seed ${seed}`)
    assert.equal(gcd(num, den), 1, `seed ${seed}`)
    assert.ok(Number.isInteger(multiplier) && multiplier >= 2 && multiplier <= 4, `seed ${seed}`)
    assert.ok(segments <= 12, `seed ${seed}`)
    assert.deepEqual(item.answer, { num, den, simplest: false }, `seed ${seed}`)
    assert.deepEqual(check(item.widget, item.answer, { text: `${num * multiplier}/${segments}` }), { correct: true, reason: null }, `seed ${seed}`)
    pairs.add(`${num}/${den}@${segments}`)
    problems.add(`${num}/${den}`)
  }
  assert.ok(pairs.size >= 12, `only ${pairs.size} different reference/answer-bar pairs`)
  assert.ok(problems.size >= 8, `only ${problems.size} reduced fractions`)
})

test('the public instance contains a reference and bar size but no answer key or explanation', () => {
  for (const seed of [1, 2, 7, 42, 2505]) {
    const item = render(getProblem(ID), seed)
    const issued = toInstance(item)
    assert.equal(issued.widget, 'fraction-bar')
    assert.equal(issued.prompt, item.prompt)
    assert.deepEqual(Object.keys(issued.visual).sort(), ['kind', 'reference', 'segments'])
    assert.deepEqual(issued.visual.reference, item.visual.reference)
    assert.equal(issued.visual.segments, item.visual.segments)
    assert.equal(issued.prompt, `The answer bar has ${issued.visual.segments} equal parts. Shade some of them to show a fraction equivalent to ${item.visual.reference.num}/${item.visual.reference.den}.`)
    assert.equal(JSON.stringify(issued).includes('"answer"'), false)
    assert.equal(JSON.stringify(issued).includes(item.explanation), false)
    for (const hint of item.hints) assert.equal(JSON.stringify(issued).includes(hint), false)
    assert.equal(item.prompt.includes(`${item.answer.num * issued.visual.segments / item.answer.den}/${issued.visual.segments}`), false)
  }
})

test('fraction-bar delegates fraction value comparison with optional simplest-form rule', () => {
  const item = render(getProblem(ID), 7)
  const { num, den } = item.answer
  assert.deepEqual(check('fraction-bar', item.answer, { text: `${num * 2}/${den * 2}` }), { correct: true, reason: null })
  assert.deepEqual(check('fraction-bar', item.answer, { text: `${num + den}/${den}` }), { correct: false, reason: 'wrong' })
  assert.deepEqual(check('fraction-bar', item.answer, { text: 'not a fraction' }), { correct: false, reason: 'invalid' })
  assert.deepEqual(check('fraction-bar', { num, den, simplest: true }, { text: `${num * 2}/${den * 2}` }), { correct: false, reason: 'not-simplest' })
})
