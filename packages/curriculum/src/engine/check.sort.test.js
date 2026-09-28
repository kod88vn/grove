/**
 * P2.8 part 1a of 2 — `check('sort', …)`.
 *
 * HOMEWORK_PLAN.md §6.3 (line 189), quoted whole:
 *
 *   | `sort` (buckets) | nouns vs verbs, even vs odd, shapes | set equality per bucket | A |
 *
 * So the response says which bucket each issued item went into, and grading is
 * SET equality, bucket by bucket. The word "set" is the whole specification and it is the
 * one thing that separates this checker from `order`, which shipped one row earlier and
 * grades the same alphabet of ids by POSITION. Here, position must not matter: two kids who
 * drop the same three shapes into the same bucket in a different order have given the same
 * answer, and a checker that compared arrays would mark one of them wrong for nothing.
 *
 * The shape:
 *
 *   answer   = { buckets: { <bucketId>: [<itemId>, …], … } }
 *   response = { buckets: { <bucketId>: [<itemId>, …], … } }
 *
 * WHERE THE LINE BETWEEN `wrong` AND `invalid` IS DRAWN. Same rule as every other checker
 * in this engine (`check.test.js` header): a malformed ANSWER is our content bug and
 * throws; a malformed RESPONSE came from a kid's browser and is `invalid`, never thrown and
 * never correct. Applied to buckets:
 *
 *   - Every issued item placed exactly once, somewhere, but at least one in the wrong
 *     bucket ⇒ `wrong`. That is a real classification, and it is the ordinary way to be
 *     incorrect.
 *   - An item LEFT UNPLACED ⇒ `invalid`, not `wrong`. A half-sorted board is an unfinished
 *     answer, not a mistaken one, and this is the case an untouched widget produces: it
 *     starts with everything in the tray. Marking it `wrong` would burn a kid's attempt and
 *     a star for pressing Check too early.
 *   - An id we never issued, an id placed twice, a bucket we never issued, a missing
 *     bucket, a non-array, a non-object ⇒ `invalid`. None of those can be produced by
 *     moving the cards around, so none of them is a classification we can mark wrong.
 *
 * THE DUPLICATE TRAP, which is why counts are asserted and not just sets. `Set`-only
 * comparison says `{ yes: ['a','a','b'] }` equals `{ yes: ['a','b'] }`, because a Set
 * silently eats the repeat. A response that places one card in two buckets, or the same
 * card twice in one bucket, did not come from the widget — and if it were graded as a set
 * it would let a forged request cover both possibilities at once and always be right. Every
 * duplicate case below must be `invalid`.
 */
import { test } from 'node:test'
import assert from 'node:assert/strict'

import { check } from './check.js'

const RIGHT = { correct: true, reason: null }
const WRONG = { correct: false, reason: 'wrong' }
const INVALID = { correct: false, reason: 'invalid' }

const ANSWER = { buckets: { yes: ['a', 'b'], no: ['c'] } }

// A kid's browser can send anything at all.
const HOSTILE = [
  undefined,
  null,
  0,
  '',
  'abc',
  [],
  [['a', 'b'], ['c']],
  true,
  { buckets: null },
  { buckets: 'yes' },
  { buckets: [] },
  { buckets: [['a', 'b'], ['c']] },
  {},
  () => ({ buckets: { yes: ['a', 'b'], no: ['c'] } }),
]

test('sort: correct when every bucket holds the same items, whatever order they went in', () => {
  assert.deepEqual(check('sort', ANSWER, { buckets: { yes: ['a', 'b'], no: ['c'] } }), RIGHT)
  assert.deepEqual(check('sort', ANSWER, { buckets: { yes: ['b', 'a'], no: ['c'] } }), RIGHT, 'order inside a bucket')
  assert.deepEqual(check('sort', ANSWER, { buckets: { no: ['c'], yes: ['b', 'a'] } }), RIGHT, 'order of the buckets')
  assert.deepEqual(check('sort', { buckets: { only: ['a'] } }, { buckets: { only: ['a'] } }), RIGHT)
})

test('sort: every item placed, at least one in the wrong bucket, is wrong', () => {
  const arrangements = [
    { yes: ['a', 'c'], no: ['b'] },
    { yes: ['b', 'c'], no: ['a'] },
    { yes: ['c'], no: ['a', 'b'] },
    { yes: ['a'], no: ['b', 'c'] },
    { yes: ['b'], no: ['a', 'c'] },
    { yes: ['a', 'b', 'c'], no: [] },
    { yes: [], no: ['a', 'b', 'c'] },
  ]
  for (const buckets of arrangements) {
    assert.deepEqual(check('sort', ANSWER, { buckets }), WRONG, JSON.stringify(buckets))
  }
})

test('sort: an item still sitting in the tray is invalid — unfinished, not mistaken', () => {
  assert.deepEqual(check('sort', ANSWER, { buckets: { yes: ['a', 'b'], no: [] } }), INVALID, 'c unplaced')
  assert.deepEqual(check('sort', ANSWER, { buckets: { yes: ['a'], no: ['c'] } }), INVALID, 'b unplaced')
  assert.deepEqual(check('sort', ANSWER, { buckets: { yes: [], no: [] } }), INVALID, 'nothing placed')
})

test('sort: a repeated id is not a way to be in two places at once', () => {
  assert.deepEqual(check('sort', ANSWER, { buckets: { yes: ['a', 'a'], no: ['c'] } }), INVALID, 'twice in one bucket')
  assert.deepEqual(check('sort', ANSWER, { buckets: { yes: ['a', 'b'], no: ['a'] } }), INVALID, 'once in each bucket')
  assert.deepEqual(check('sort', ANSWER, { buckets: { yes: ['a', 'a', 'b'], no: ['c'] } }), INVALID, 'padded to the right count')
  assert.deepEqual(check('sort', ANSWER, { buckets: { yes: ['a', 'b'], no: ['c', 'c'] } }), INVALID, 'one too many')
})

test('sort: an id we never issued is invalid, however plausible it looks', () => {
  assert.deepEqual(check('sort', ANSWER, { buckets: { yes: ['a', 'b'], no: ['z'] } }), INVALID)
  assert.deepEqual(check('sort', ANSWER, { buckets: { yes: ['x', 'y'], no: ['z'] } }), INVALID)
  assert.deepEqual(check('sort', ANSWER, { buckets: { yes: ['a', 'b'], no: ['c', 'd'] } }), INVALID, 'an extra card')
  assert.deepEqual(check('sort', ANSWER, { buckets: { yes: ['A', 'b'], no: ['c'] } }), INVALID, 'ids are case-sensitive')
  assert.deepEqual(check('sort', ANSWER, { buckets: { yes: [' a', 'b'], no: ['c'] } }), INVALID, 'ids are not trimmed')
})

test('sort: the buckets must be exactly the ones we issued', () => {
  assert.deepEqual(check('sort', ANSWER, { buckets: { yes: ['a', 'b'], maybe: ['c'] } }), INVALID, 'renamed')
  assert.deepEqual(check('sort', ANSWER, { buckets: { yes: ['a', 'b', 'c'] } }), INVALID, 'one bucket missing')
  assert.deepEqual(check('sort', ANSWER, { buckets: { yes: ['a', 'b'], no: ['c'], extra: [] } }), INVALID, 'one bucket too many')
})

test('sort: a bucket that is not an array of strings is invalid', () => {
  for (const buckets of [
    { yes: 'ab', no: ['c'] },
    { yes: ['a', 'b'], no: 'c' },
    { yes: ['a', 'b'], no: null },
    { yes: ['a', 2], no: ['c'] },
    { yes: ['a', 'b'], no: [['c']] },
    { yes: ['a', 'b'], no: [null] },
    { yes: new Array(2), no: ['c'] },
    { yes: ['a', 'b'], no: { 0: 'c' } },
  ]) {
    assert.deepEqual(check('sort', ANSWER, { buckets }), INVALID, JSON.stringify(buckets))
  }
})

test('sort: a hostile response is invalid, never thrown and never correct', () => {
  for (const response of HOSTILE) {
    const result = check('sort', ANSWER, response)
    assert.deepEqual(result, INVALID, String(response))
    assert.equal(result.correct, false)
  }
})

test('sort: an answer with an empty bucket is legal, and must be left empty', () => {
  const answer = { buckets: { yes: ['a', 'b'], no: [] } }
  assert.deepEqual(check('sort', answer, { buckets: { yes: ['b', 'a'], no: [] } }), RIGHT)
  assert.deepEqual(check('sort', answer, { buckets: { yes: ['a'], no: ['b'] } }), WRONG)
  assert.deepEqual(check('sort', answer, { buckets: { yes: ['a'], no: [] } }), INVALID)
})

test('sort: a malformed answer is our bug and throws, whatever the response is', () => {
  const answers = [
    undefined,
    null,
    'buckets',
    [],
    {},
    { buckets: null },
    { buckets: [] },
    { buckets: 'yes' },
    { buckets: {} },
    { buckets: { yes: [], no: [] } },
    { buckets: { yes: 'ab' } },
    { buckets: { yes: [''] } },
    { buckets: { yes: ['a', 2] } },
    { buckets: { yes: [null] } },
    { buckets: { yes: new Array(1) } },
    { buckets: { yes: ['a', 'a'] } },
    { buckets: { yes: ['a'], no: ['a'] } },
  ]
  for (const answer of answers) {
    assert.throws(() => check('sort', answer, { buckets: { yes: ['a', 'b'], no: ['c'] } }), TypeError, JSON.stringify(answer))
    // The ordering matters: our own content bug must surface even when the response is junk,
    // or a kid's bad request hides it (`check.untrusted.test.js`).
    assert.throws(() => check('sort', answer, undefined), TypeError, `${JSON.stringify(answer)} + junk`)
  }
})

test('sort: grading does not mutate the answer or the response it was handed', () => {
  const answer = { buckets: { yes: ['a', 'b'], no: ['c'] } }
  const response = { buckets: { yes: ['b', 'a'], no: ['c'] } }
  const answerBefore = JSON.stringify(answer)
  const responseBefore = JSON.stringify(response)
  check('sort', answer, response)
  assert.equal(JSON.stringify(answer), answerBefore)
  assert.equal(JSON.stringify(response), responseBefore)
})

test('sort: a very long forged id is graded, not thrown', () => {
  assert.deepEqual(check('sort', ANSWER, { buckets: { yes: ['a', 'b'], no: ['x'.repeat(10_000)] } }), INVALID)
})
