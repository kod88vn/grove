import { test } from 'node:test'
import assert from 'node:assert/strict'
import { check, getProblem, listProblems, render, toInstance } from '../../../index.js'

const ID = 'm5.nf.equiv-fractions/place-on-number-line'
const BAR = 'm5.nf.equiv-fractions/shade-equivalent'
const gcd = (a, b) => b === 0 ? a : gcd(b, a % b)

test('a Grade 5 equivalent-fraction line is registered for the real gallery', () => {
  assert.deepEqual(listProblems().filter((item) => item.id === ID).map(({ widget, skill }) => ({ widget, skill })), [
    { widget: 'number-line', skill: 'm5.nf.equiv-fractions' },
  ])
})

test('501 seeds reuse the equivalent-bar fraction pool without revealing the marked position', () => {
  const barPool = new Set()
  const linePool = new Set()
  const ticks = new Map()
  for (let seed = 1; seed <= 501; seed++) {
    const bar = render(getProblem(BAR), seed)
    barPool.add(`${bar.answer.num}/${bar.answer.den}@${bar.visual.segments}`)
    const item = render(getProblem(ID), seed)
    const { num, den } = item.answer
    const issued = toInstance(item)
    const segments = item.visual.segments
    const multiplier = segments / den
    const tick = num * multiplier
    assert.equal(item.widget, 'number-line', `seed ${seed}`)
    assert.deepEqual(item.visual, { kind: 'number-line', segments }, `seed ${seed}`)
    assert.deepEqual(Object.keys(issued.visual).sort(), ['kind', 'segments'], `seed ${seed}`)
    assert.deepEqual(item.answer, { num, den, simplest: false }, `seed ${seed}`)
    assert.ok(Number.isInteger(num) && num > 0 && num < den && gcd(num, den) === 1, `seed ${seed}`)
    assert.ok(den >= 2 && den <= 6 && Number.isInteger(multiplier) && multiplier >= 2 && multiplier <= 4 && segments <= 12, `seed ${seed}`)
    assert.ok(tick > 0 && tick < segments && tick !== num, `seed ${seed}`)
    assert.match(item.prompt, new RegExp(`${num}/${den}`), `seed ${seed}`)
    assert.equal(item.prompt.includes(`${tick}/${segments}`), false, `seed ${seed}`)
    assert.equal(JSON.stringify(issued).includes('"answer"'), false, `seed ${seed}`)
    assert.equal(JSON.stringify(issued).includes(item.explanation), false, `seed ${seed}`)
    for (const hint of item.hints) {
      assert.equal(hint.includes(`${tick}/${segments}`), false, `seed ${seed}`)
      assert.equal(JSON.stringify(issued).includes(hint), false, `seed ${seed}`)
    }
    assert.deepEqual(check(item.widget, item.answer, { text: `${tick}/${segments}` }), { correct: true, reason: null }, `seed ${seed}`)
    linePool.add(`${num}/${den}@${segments}`)
    ticks.set(tick, (ticks.get(tick) ?? 0) + 1)
  }
  assert.ok([...linePool].every((entry) => barPool.has(entry)), 'line picks only equivalent-bar pool pairs')
  assert.ok(linePool.size >= 12, `only ${linePool.size} fraction/line pairs`)
  assert.ok(ticks.size >= 5, `only ${ticks.size} distinct correct tick indices`)
  assert.ok(Math.max(...ticks.values()) <= 200, `one index dominated ${JSON.stringify([...ticks])}`)
})

test('the shared fraction checker distinguishes empty, endpoints, neighbors and simplest form', () => {
  const item = render(getProblem(ID), 2505)
  const { segments } = item.visual
  const tick = item.answer.num * segments / item.answer.den
  assert.deepEqual(check('number-line', item.answer, { text: '' }), { correct: false, reason: 'invalid' })
  for (const index of [0, segments, tick - 1, tick + 1]) {
    assert.deepEqual(check('number-line', item.answer, { text: `${index}/${segments}` }), { correct: false, reason: 'wrong' }, `tick ${index}`)
  }
  assert.deepEqual(check('number-line', item.answer, { text: `${tick}/${segments}` }), { correct: true, reason: null })
  assert.deepEqual(check('number-line', { ...item.answer, simplest: true }, { text: `${tick}/${segments}` }), { correct: false, reason: 'not-simplest' })
})
