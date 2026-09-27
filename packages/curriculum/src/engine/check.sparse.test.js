/**
 * P1.5 review follow-up — `check('cloze', …)` must not be fooled by array holes.
 *
 * PR #81 review thread on `src/engine/check.js:52`. `Array.prototype.some` and
 * `Array.prototype.every` skip holes: a hole is not visited, so `some` cannot see a bad
 * entry and `every` returns `true` over a list it never read. Both of `cloze`'s guards are
 * written with them, and both are therefore blind to a sparse array. Measured before this
 * spec was written, against `src/engine/check.js` at 2022f01:
 *
 *     check('cloze', { blanks: [{ accept: ['vivid'] }] }, { blanks: new Array(1) })
 *       → { correct: true, reason: null }
 *
 * A child who submits nothing is told they are right. That is the whole defect: it is not a
 * tidiness complaint about holes, it is a grading result that is wrong in the child's favour
 * and silently so. `{ blanks: [null] }` is already rejected, which is the point — the hole
 * gets through the exact check that catches `null`.
 *
 * The same blindness runs the other way, for the author. A bank written with a hole in
 * `blanks` or in an `accept` list passes the `TypeError` guard that exists to catch it, and
 * then either throws from deep inside the grader while reading a real child's answer, or
 * quietly grades against an accept list it never validated. An authoring mistake must be
 * found when the answer key is inspected, not when a response happens to reach it, so these
 * cases are asserted with `response` left `undefined`: nothing about the response can excuse
 * a malformed key.
 *
 * ── The rule ──────────────────────────────────────────────────────────────────────────────
 *  1. A hole anywhere in a response's `blanks` is `invalid`, exactly as `null` is. It is
 *     never `correct`, and never `wrong` either — a hole is a missing answer, not a bad one.
 *  2. A hole anywhere in an answer key — in `blanks`, or in any `accept` list — is a
 *     `TypeError`, raised from the key alone, before any response is considered.
 *  3. Dense input keeps behaving exactly as `check.cloze.test.js` already pins it. The cheap
 *     way to pass rule 1 is to reject more than holes, so the positive cases are asserted
 *     here too and this file fails if grading is made stricter than it was.
 *  4. Every blank is validated before any blank is graded. This one was added after the
 *     first pass at rules 1–3 replaced the two whole-array guards with a single loop that
 *     validated and graded each blank in turn, which silently moved the boundary:
 *
 *         check('cloze', two, { blanks: ['nope', null] })
 *           was  { correct: false, reason: 'invalid' }
 *           became { correct: false, reason: 'wrong' }
 *
 *     A child who answered one box incorrectly and left the next one empty was told their
 *     answer was wrong, instead of being sent back to the empty box. 'invalid' and 'wrong'
 *     are different messages to a ten-year-old, so the order is part of the contract, not an
 *     implementation detail: validate the whole response, then grade it.
 *
 * ── Limits ────────────────────────────────────────────────────────────────────────────────
 * `some`/`every` appear nowhere else in `check.js`, so the class is contained to `cloze`;
 * the other four widgets read scalars and are not re-asserted here. This spec also says
 * nothing about *how* the holes are closed — `Array.from`, a `for` loop over indices, or an
 * explicit `length` walk are all acceptable, as long as every index is visited.
 */
import { test } from 'node:test'
import assert from 'node:assert/strict'

import { check } from './check.js'

const INVALID = { correct: false, reason: 'invalid' }
const WRONG = { correct: false, reason: 'wrong' }
const RIGHT = { correct: true, reason: null }

/** A copy of `values` with index `index` deleted, which is a hole and not `undefined`. */
const withHole = (values, index) => {
  const array = [...values]
  delete array[index]
  return array
}

const ONE = { blanks: [{ accept: ['vivid'] }] }
const THREE = { blanks: [{ accept: ['one'] }, { accept: ['two'] }, { accept: ['three'] }] }

test('a hole is not an answer, even when it is the only blank', () => {
  assert.deepEqual(check('cloze', ONE, { blanks: new Array(1) }), INVALID)
  assert.deepEqual(check('cloze', ONE, withHole(['vivid'], 0)), INVALID)
})

test('a hole beside a right answer does not make the response right', () => {
  const response = { blanks: withHole(['one', 'two', 'three'], 1) }
  assert.deepEqual(check('cloze', THREE, response), INVALID)
})

test('a hole at any index of the response is rejected', () => {
  for (const index of [0, 1, 2]) {
    const response = { blanks: withHole(['one', 'two', 'three'], index) }
    assert.deepEqual(
      check('cloze', THREE, response),
      INVALID,
      `a hole at index ${index} was not rejected`,
    )
  }
  assert.deepEqual(check('cloze', THREE, { blanks: new Array(3) }), INVALID)
})

test('a hole in the answer key is an authoring error, found without any response', () => {
  assert.throws(() => check('cloze', { blanks: new Array(1) }, undefined), TypeError)
  assert.throws(() => check('cloze', { blanks: withHole([{ accept: ['a'] }], 0) }, undefined), TypeError)
  assert.throws(
    () => check('cloze', { blanks: withHole([{ accept: ['a'] }, { accept: ['b'] }], 1) }, undefined),
    TypeError,
  )
})

test('a hole in an accept list is an authoring error, found without any response', () => {
  assert.throws(() => check('cloze', { blanks: [{ accept: new Array(1) }] }, undefined), TypeError)
  assert.throws(
    () => check('cloze', { blanks: [{ accept: withHole(['vivid', 'bright'], 1) }] }, undefined),
    TypeError,
  )
})

test('a sparse answer key is refused rather than throwing later, mid-grade', () => {
  assert.throws(() => check('cloze', { blanks: new Array(1) }, { blanks: ['vivid'] }), TypeError)
  assert.throws(
    () => check('cloze', { blanks: [{ accept: new Array(1) }] }, { blanks: ['vivid'] }),
    TypeError,
  )
})

test('a malformed blank invalidates the response even when an earlier blank is wrong', () => {
  const two = { blanks: [{ accept: ['one'] }, { accept: ['two'] }] }
  assert.deepEqual(check('cloze', two, { blanks: ['nope', null] }), INVALID)
  assert.deepEqual(check('cloze', two, { blanks: ['nope', '   '] }), INVALID)
  assert.deepEqual(check('cloze', two, { blanks: ['nope', 7] }), INVALID)
  assert.deepEqual(check('cloze', two, { blanks: withHole(['nope', 'two'], 1) }), INVALID)
  assert.deepEqual(check('cloze', THREE, { blanks: ['bad', 'worse', null] }), INVALID)
})

test('dense responses keep grading exactly as they did', () => {
  assert.deepEqual(check('cloze', ONE, { blanks: ['vivid'] }), RIGHT)
  assert.deepEqual(check('cloze', ONE, { blanks: ['  VIVID '] }), RIGHT)
  assert.deepEqual(check('cloze', ONE, { blanks: ['dull'] }), WRONG)
  assert.deepEqual(check('cloze', ONE, { blanks: [null] }), INVALID)
  assert.deepEqual(check('cloze', ONE, { blanks: [''] }), INVALID)
  assert.deepEqual(check('cloze', ONE, { blanks: [] }), INVALID)
  assert.deepEqual(check('cloze', THREE, { blanks: ['one', 'two', 'three'] }), RIGHT)
  assert.deepEqual(check('cloze', THREE, { blanks: ['one', 'two', 'nope'] }), WRONG)
})
