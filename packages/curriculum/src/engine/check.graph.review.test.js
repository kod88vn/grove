import { test } from 'node:test'
import assert from 'node:assert/strict'
import { check } from './check.js'

const bounds = { xMin: -5, xMax: 5, yMin: -10, yMax: 10 }

test('a visibly wrong parabola is not credited because its coefficients differ by less than tolerance', () => {
  const answer = {
    mode: 'parabola',
    points: [{ x: -1, y: 1 }, { x: 0, y: 0 }, { x: 1, y: 1 }],
    bound: bounds,
    tolerance: 0.15,
  }
  const response = {
    points: [{ x: -1, y: 0.86 }, { x: 0, y: 0.14 }, { x: 1, y: 1.14 }],
  }

  assert.deepEqual(check('graph', answer, response), { correct: false, reason: 'wrong' })
  assert.deepEqual(check('graph', answer, { points: answer.points }), { correct: true, reason: null })
})
