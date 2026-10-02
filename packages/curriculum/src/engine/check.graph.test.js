import { test } from 'node:test'
import assert from 'node:assert/strict'
import { check } from './check.js'

const right = { correct: true, reason: null }
const wrong = { correct: false, reason: 'wrong' }
const invalid = { correct: false, reason: 'invalid' }
const bound = { xMin: -5, xMax: 5, yMin: -10, yMax: 10 }

test('point geometry accepts the tolerance and viewport edges', () => {
  const answer = { mode: 'point', points: [{ x: 0, y: 0 }], bound, tolerance: 0.25 }
  assert.deepEqual(check('graph', answer, { points: [{ x: 0.1, y: 0.1 }] }), right)
  assert.deepEqual(check('graph', { ...answer, points: [{ x: -5, y: -10 }] }, { points: [{ x: -5, y: -10 }] }), right)
  assert.deepEqual(check('graph', answer, { points: [{ x: 1, y: 1 }] }), wrong)
})

test('line geometry is order-independent and rejects a misplaced plotted point', () => {
  const answer = { mode: 'line', points: [{ x: -2, y: -1 }, { x: 2, y: 7 }], bound, tolerance: 0.15 }
  assert.deepEqual(check('graph', answer, { points: [{ x: 2, y: 7.1 }, { x: -2, y: -0.9 }] }), right)
  assert.deepEqual(check('graph', answer, { points: [{ x: -2, y: -1 }, { x: 2, y: 8 }] }), wrong)
})

test('parabola geometry derives its quadratic from all three submitted points', () => {
  const answer = { mode: 'parabola', points: [{ x: -2, y: 3 }, { x: 0, y: -1 }, { x: 2, y: 7 }], bound, tolerance: 0.15 }
  assert.deepEqual(check('graph', answer, { points: [{ x: 2, y: 7.1 }, { x: -2, y: 3.1 }, { x: 0, y: -0.9 }] }), right)
  assert.deepEqual(check('graph', answer, { points: [{ x: -2, y: 3 }, { x: 0, y: -1 }, { x: 2, y: 8 }] }), wrong)
})

test('curve tolerance bounds the fitted error across the viewport', () => {
  const answer = { mode: 'parabola', points: [{ x: -1, y: 1 }, { x: 0, y: 0 }, { x: 1, y: 1 }], bound, tolerance: 0.15 }
  const response = { points: [{ x: -1, y: 0.86 }, { x: 0, y: 0.14 }, { x: 1, y: 1.14 }] }
  assert.deepEqual(check('graph', answer, response), wrong)
})

test('graph responses reject malformed, duplicate-x, non-finite, and out-of-bounds points', () => {
  const answer = { mode: 'line', points: [{ x: -2, y: -1 }, { x: 2, y: 7 }], bound, tolerance: 0.15 }
  for (const response of [
    null,
    { points: 'not points' },
    { points: [{ x: 1, y: 1 }] },
    { points: [{ x: 1, y: 1 }, { x: 1, y: 2 }] },
    { points: [{ x: Number.NaN, y: 1 }, { x: 2, y: 7 }] },
    { points: [{ x: -6, y: 1 }, { x: 2, y: 7 }] },
    { points: [{ x: -2, y: -1 }, { x: 2, y: 7 }], extra: true },
  ]) assert.deepEqual(check('graph', answer, response), invalid)
})
