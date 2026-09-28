/**
 * P2.7 part 1a of 2 — `check('order', …)`.
 *
 * HOMEWORK_PLAN.md §6.3 (line 200), quoted whole:
 *
 *   | `order` (drag or tap-to-order) | sequence events, sentence scramble, proof steps |
 *   | sequence equality | A |
 *
 * So the response is a sequence of the ids the kid was shown, and grading is equality of
 * that sequence with the answer's. Everything interesting is in the three-way split, which
 * is the same split every other checker in this engine obeys (`check.test.js` header):
 * a malformed ANSWER is our content bug and throws; a malformed RESPONSE came from a kid's
 * browser and is `invalid`, never thrown and never correct.
 *
 * WHERE THE LINE BETWEEN `wrong` AND `invalid` IS DRAWN, and why it matters here more than
 * for any widget shipped so far:
 *
 *   - A PERMUTATION of the ids we issued is a real answer. If it is not the right
 *     permutation it is `wrong` — the kid arranged the cards and got the arrangement
 *     wrong. This is the ordinary case, and it is the case an untouched widget produces,
 *     because the widget starts life holding the shuffled order it was told to display.
 *   - ANYTHING ELSE is `invalid`: an id we never issued, a repeated id, a missing one, the
 *     wrong count, a non-string, a non-array. None of those can be produced by moving the
 *     cards around, so none of them is an arrangement we can mark wrong; they mean the
 *     request did not come from the widget.
 *
 * Get that backwards — mark an unreadable response `wrong` — and a kid whose browser sends
 * junk silently loses an attempt and a star. Get it backwards the other way — mark a real
 * arrangement `invalid` — and the widget can never express a wrong answer at all, which is
 * the failure mode `AnswerWidget.test.js` exists to catch.
 */
import { test } from 'node:test'
import assert from 'node:assert/strict'

import { check } from './check.js'

const RIGHT = { correct: true, reason: null }
const WRONG = { correct: false, reason: 'wrong' }
const INVALID = { correct: false, reason: 'invalid' }

const ANSWER = { sequence: ['a', 'b', 'c'] }

// A kid's browser can send anything at all.
const HOSTILE = [undefined, null, 0, '', 'abc', [], ['a', 'b', 'c'], true, () => ({ sequence: ['a', 'b', 'c'] })]

test('order: correct only when the whole sequence matches, position for position', () => {
  assert.deepEqual(check('order', ANSWER, { sequence: ['a', 'b', 'c'] }), RIGHT)
  assert.deepEqual(check('order', { sequence: ['only'] }, { sequence: ['only'] }), RIGHT)
})

test('order: every other arrangement of the same ids is wrong, not unreadable', () => {
  const arrangements = [
    ['a', 'c', 'b'],
    ['b', 'a', 'c'],
    ['b', 'c', 'a'],
    ['c', 'a', 'b'],
    ['c', 'b', 'a'],
  ]
  for (const sequence of arrangements) {
    assert.deepEqual(check('order', ANSWER, { sequence }), WRONG, sequence.join(''))
  }
})

test('order: one pair swapped is wrong — it is not graded leniently, and not partially', () => {
  // Five of six positions right is still not the right sequence. There is no partial credit
  // in this engine; §5.1 pays stars for solving, and check() only ever says right or wrong.
  const answer = { sequence: ['a', 'b', 'c', 'd', 'e', 'f'] }
  assert.deepEqual(check('order', answer, { sequence: ['a', 'b', 'c', 'd', 'f', 'e'] }), WRONG)
  assert.deepEqual(check('order', answer, { sequence: ['a', 'b', 'c', 'd', 'e', 'f'] }), RIGHT)
})

test('order: ids are compared exactly — no trimming, no case folding', () => {
  assert.deepEqual(check('order', { sequence: ['a', 'b'] }, { sequence: ['A', 'b'] }), INVALID, 'case')
  assert.deepEqual(check('order', { sequence: ['a', 'b'] }, { sequence: [' a', 'b'] }), INVALID, 'whitespace')
})

test('order: an id we never issued is unreadable, not a wrong arrangement', () => {
  assert.deepEqual(check('order', ANSWER, { sequence: ['a', 'b', 'z'] }), INVALID)
  assert.deepEqual(check('order', ANSWER, { sequence: ['z', 'y', 'x'] }), INVALID)
})

test('order: a repeated id is unreadable — the cards cannot be in two places at once', () => {
  assert.deepEqual(check('order', ANSWER, { sequence: ['a', 'a', 'b'] }), INVALID)
  assert.deepEqual(check('order', ANSWER, { sequence: ['a', 'a', 'a'] }), INVALID)
})

test('order: the wrong number of cards is unreadable, however right the ones sent are', () => {
  assert.deepEqual(check('order', ANSWER, { sequence: ['a', 'b'] }), INVALID, 'short')
  assert.deepEqual(check('order', ANSWER, { sequence: ['a', 'b', 'c', 'd'] }), INVALID, 'long')
  assert.deepEqual(check('order', ANSWER, { sequence: [] }), INVALID, 'empty')
})

test('order: a response that is not an array of strings is invalid, never correct', () => {
  const responses = [
    ...HOSTILE,
    {},
    { sequence: 'abc' },
    { sequence: null },
    { sequence: ['a', 'b', 3] },
    { sequence: ['a', 'b', null] },
    { sequence: ['a', 'b', ['c']] },
    { sequence: ['a', 'b', { toString: () => 'c' }] },
    { sequence: { 0: 'a', 1: 'b', 2: 'c', length: 3 } },
  ]
  for (const response of responses) {
    const result = check('order', ANSWER, response)
    assert.deepEqual(result, INVALID, JSON.stringify(response) ?? String(response))
    assert.equal(result.correct, false)
  }
})

test('order: an answer that is not a non-empty sequence of unique ids is a content bug and throws', () => {
  const answers = [
    undefined,
    null,
    {},
    'abc',
    ['a', 'b'],
    { sequence: [] },
    { sequence: 'abc' },
    { sequence: ['a', 1] },
    { sequence: ['a', null] },
    { sequence: ['a', ''] },
    { sequence: ['a', 'a'] },
  ]
  for (const answer of answers) {
    assert.throws(() => check('order', answer, { sequence: ['a', 'b'] }), TypeError, JSON.stringify(answer))
  }
})

test('order: grading reads the response, it never rewrites it', () => {
  // A checker that sorted the response in place to compare it would pass every test above
  // and quietly corrupt the row POST /attempts is about to store.
  const answer = { sequence: ['a', 'b', 'c'] }
  const response = { sequence: ['c', 'b', 'a'] }
  check('order', answer, response)
  assert.deepEqual(response, { sequence: ['c', 'b', 'a'] })
  assert.deepEqual(answer, { sequence: ['a', 'b', 'c'] })
})
