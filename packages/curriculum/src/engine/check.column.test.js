/**
 * P1.4 spec — engine/check.js gains the `column` widget's checker.
 *
 * HOMEWORK_PLAN.md §6.3 lists `column` (Band B) as "add/sub/mult/div (port existing grid from
 * MathExercise.js)" with the checker "final answer + per-digit rows", and §10 Phase 1 requires
 * `m5.nbt.long-multiplication` to ship on the `column` widget. §9.4 requires every template's
 * own answer to pass `check`, so P1.4 cannot render a `column` problem it cannot grade.
 *
 * Scope split, stated because the plan splits it: P1.4 implements only the **final answer**
 * half. The "per-digit rows" half needs a response shape that the plan never defines — that
 * arrives with the widget component in Phase 2, which the tracker's Phase 2 table already owns
 * (`column (port) | Component | Checker | Tests`). So `column` here grades the final product
 * exactly as `number` does, and an extra `rows` key in a kid's response is ignored rather than
 * rejected, so that a Phase 2 response stays gradeable by a Phase 1 grader.
 *
 * As in check.test.js: `answer` is ours and a malformed one must throw; `response` is the
 * kid's and a malformed one is graded { correct: false, reason: 'invalid' }, never thrown.
 */
import { test } from 'node:test'
import assert from 'node:assert/strict'

import { check } from './check.js'

const RIGHT = { correct: true, reason: null }
const WRONG = { correct: false, reason: 'wrong' }
const INVALID = { correct: false, reason: 'invalid' }

const HOSTILE = [undefined, null, 0, '', 'b', [], ['b'], true, () => ({ value: 42 })]

test('column grades the final product exactly', () => {
  assert.deepEqual(check('column', { value: 4522 }, { value: 4522 }), RIGHT)
  assert.deepEqual(check('column', { value: 4522 }, { value: 4521 }), WRONG)
  assert.deepEqual(check('column', { value: 4522 }, { value: -4522 }), WRONG)
})

test('column accepts a typed answer, with or without thousands separators', () => {
  assert.deepEqual(check('column', { value: 4522 }, { value: '4522' }), RIGHT)
  assert.deepEqual(check('column', { value: 4522 }, { value: ' 4,522 ' }), RIGHT)
  assert.deepEqual(check('column', { value: 4522 }, { value: '4523' }), WRONG)
})

// A Phase 2 grid sends its working as well as the total. Phase 1 grades the total and ignores
// the rest, rather than failing a kid whose final answer is right.
test('column ignores extra keys a Phase 2 grid would send', () => {
  assert.deepEqual(check('column', { value: 4522 }, { value: 4522, rows: [2261, 2261] }), RIGHT)
  assert.deepEqual(check('column', { value: 4522 }, { value: 4521, rows: [2261, 2261] }), WRONG)
})

test('a malformed column response from the kid is invalid, never thrown, never correct', () => {
  for (const response of HOSTILE) {
    const result = check('column', { value: 4522 }, response)
    assert.equal(result.correct, false, `${String(response)} was graded correct`)
  }
  assert.deepEqual(check('column', { value: 4522 }, {}), INVALID)
  assert.deepEqual(check('column', { value: 4522 }, { value: 'four thousand' }), INVALID)
  assert.deepEqual(check('column', { value: 4522 }, { value: Number.NaN }), INVALID)
  assert.deepEqual(check('column', { value: 4522 }, { value: Number.POSITIVE_INFINITY }), INVALID)
})

test('a malformed column answer from our own content throws', () => {
  assert.throws(() => check('column', {}, { value: 1 }), TypeError)
  assert.throws(() => check('column', { value: '4522' }, { value: 1 }), TypeError)
  assert.throws(() => check('column', { value: Number.NaN }, { value: 1 }), TypeError)
  assert.throws(() => check('column', null, { value: 1 }), TypeError)
})

test('adding column leaves an unimplemented widget still throwing', () => {
  assert.throws(() => check('abacus', { value: 1 }, { value: 1 }), /abacus/)
  assert.throws(() => check('graph', { value: 1 }, { value: 1 }), /graph/)
})
