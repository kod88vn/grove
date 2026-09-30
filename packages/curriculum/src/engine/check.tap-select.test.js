import { test } from 'node:test'
import assert from 'node:assert/strict'
import { check } from './check.js'

const answer = { ids: ['token-c', 'token-a'], availableIds: ['token-a', 'token-b', 'token-c', 'token-d', 'token-e'] }
const right = { correct: true, reason: null }
const wrong = { correct: false, reason: 'wrong' }
const invalid = { correct: false, reason: 'invalid' }

test('exact ID set grades correct in either selection order', () => {
  assert.deepEqual(check('tap-select', answer, { ids: ['token-c', 'token-a'] }), right)
  assert.deepEqual(check('tap-select', answer, { ids: ['token-a', 'token-c'] }), right)
})

test('a well-formed partial selection is wrong, not invalid', () => {
  assert.deepEqual(check('tap-select', answer, { ids: ['token-c'] }), wrong)
  assert.deepEqual(check('tap-select', answer, { ids: ['token-c', 'token-b'] }), wrong)
})

test('empty, all-wrong, malformed, duplicate and unknown selections are invalid', () => {
  const responses = [undefined, null, '', [], {}, { ids: [] }, { ids: ['token-b'] },
    { ids: ['token-b', 'token-d'] }, { ids: ['token-a', 'token-a'] },
    { ids: ['token-a', 'token-unknown'] }, { ids: [null, 'token-a'] },
    { ids: 'token-a' }, { ids: ['token-a'], extra: true },
    { ids: new Array(1) }]
  for (const response of responses) assert.deepEqual(check('tap-select', answer, response), invalid, String(response))
})

test('malformed authored answers throw even when the response is malformed', () => {
  const broken = [undefined, null, {}, { ids: [] }, { ids: ['token-a'] },
    { ids: ['token-a', 'token-a'], availableIds: ['token-a', 'token-b'] },
    { ids: ['token-z', 'token-a'], availableIds: ['token-a', 'token-b'] },
    { ids: ['token-a', 'token-b'], availableIds: ['token-a', 'token-a'] },
    { ids: ['token-a', 'token-b'], availableIds: [] },
    { ids: ['token-a', null], availableIds: ['token-a', 'token-b'] }]
  for (const value of broken) assert.throws(() => check('tap-select', value, null), TypeError, String(value))
})
