import { test } from 'node:test'
import assert from 'node:assert/strict'
import { check } from './check.js'

const answer = { cells: { north: 125, south: 300 } }
const right = { correct: true, reason: null }
const wrong = { correct: false, reason: 'wrong' }
const invalid = { correct: false, reason: 'invalid' }

test('table-fill grades each numeric cell independently', () => {
  assert.deepEqual(check('table-fill', answer, { cells: { north: '125', south: '300' } }), right)
  assert.deepEqual(check('table-fill', answer, { cells: { north: '125', south: '301' } }), wrong)
  assert.deepEqual(check('table-fill', answer, { cells: { north: '124', south: '300' } }), wrong)
});


test('table-fill rejects incomplete, foreign, malformed, and extra response fields', () => {
  for (const response of [
    null,
    {},
    { cells: {} },
    { cells: { north: '125' } },
    { cells: { north: '125', south: '300', extra: '1' } },
    { cells: { north: '', south: '300' } },
    { cells: { north: '1e2', south: '300' } },
    { cells: { north: '125', south: Infinity } },
    { cells: { north: '125', south: '300' }, extra: true },
  ]) assert.deepEqual(check('table-fill', answer, response), invalid)
})

test('table-fill rejects malformed author cell maps as content errors', () => {
  for (const malformed of [
    null,
    {},
    { cells: {} },
    { cells: { north: Infinity } },
    { cells: 'not a cell map' },
    { cells: { ' ': 1 } },
    { cells: { north: 1 }, extra: true },
  ]) assert.throws(() => check('table-fill', malformed, { cells: { north: '1' } }), TypeError)
  })
