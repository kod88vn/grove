import { test } from 'node:test'
import assert from 'node:assert/strict'

import { check } from './check.js'

const answer = { total: 37, denominations: [1, 5, 10, 25] }
const right = { correct: true, reason: null }
const wrong = { correct: false, reason: 'wrong' }
const invalid = { correct: false, reason: 'invalid' }

test('coins: different combinations of offered coins with the same value both count', () => {
  assert.deepEqual(check('coins', answer, { counts: { 25: 1, 10: 1, 1: 2 } }), right)
  assert.deepEqual(check('coins', answer, { counts: { 25: 1, 5: 2, 1: 2 } }), right)
  assert.deepEqual(check('coins', answer, { counts: { 25: 1, 5: 1, 1: 2 } }), wrong)
})

test('coins: every denomination in the response must be offered by the problem', () => {
  const restricted = { total: 30, denominations: [5, 10] }
  assert.deepEqual(check('coins', restricted, { counts: { 10: 3 } }), right)
  assert.deepEqual(check('coins', restricted, { counts: { 25: 1, 5: 1 } }), invalid)
  assert.deepEqual(check('coins', answer, { counts: { 50: 1 } }), invalid)
})

test('coins: only nonnegative whole safe counts in an exact response shape are valid', () => {
  for (const counts of [{ 1: -1 }, { 5: 0.5 }, { 10: '2' }, { 25: Infinity }, { 1: 1e20 }]) {
    assert.deepEqual(check('coins', answer, { counts }), invalid, JSON.stringify(counts))
  }
  for (const response of [null, [], {}, { counts: null }, { counts: [] }, { counts: { 1: 2 }, extra: true }]) {
    assert.deepEqual(check('coins', answer, response), invalid, JSON.stringify(response))
  }
  assert.deepEqual(check('coins', answer, { counts: {} }), wrong)
})

test('coins: malformed content is a content bug, not a wrong child response', () => {
  for (const malformed of [null, { total: -1, denominations: [1] }, { total: 37, denominations: [] }, { total: 37, denominations: [3] }, { total: 37, denominations: [1, 1] }]) {
    assert.throws(() => check('coins', malformed, { counts: {} }), TypeError)
  }
})
