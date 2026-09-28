/**
 * P2.9 part 1a of 2 — `check('match', …)`.
 *
 * HOMEWORK_PLAN.md §6.3 (line 190), quoted whole:
 *
 *   | `match` (pairs) | synonyms, word↔picture, fraction↔decimal | pair set equality | A |
 *
 * So the response says which right-hand card each issued left-hand card was joined to, and
 * grading is SET equality over the PAIRS. Two words in that row do all the work:
 *
 *   "pairs"  — the unit of the answer is a (left, right) couple, not a position and not a
 *              bucket. This is the third widget in a row to grade the same alphabet of ids
 *              and the third rule for doing it: `order` compares by POSITION, `sort`
 *              compares SETS per bucket, and `match` compares a SET OF COUPLES.
 *   "set"    — the order the couples arrive in must not matter. A kid who joins the last
 *              card first has given the same answer as one who worked top to bottom, and a
 *              checker that compared arrays would mark one of them wrong for nothing.
 *
 * The shape:
 *
 *   answer   = { pairs: [ { left: <leftId>, right: <rightId> }, … ] }
 *   response = { pairs: [ { left: <leftId>, right: <rightId> }, … ] }
 *
 * WHERE THE LINE BETWEEN `wrong` AND `invalid` IS DRAWN. Same rule as every other checker
 * in this engine (`check.test.js` header): a malformed ANSWER is our content bug and
 * throws; a malformed RESPONSE came from a kid's browser and is `invalid`, never thrown and
 * never correct. Applied to pairs:
 *
 *   - Every left card joined to exactly one right card, every right card used exactly once,
 *     but at least one couple wrong ⇒ `wrong`. That is a complete board, and it is the
 *     ordinary way to be incorrect.
 *   - A left card LEFT UNJOINED ⇒ `invalid`, not `wrong`. A half-finished board is an
 *     unfinished answer, not a mistaken one, and it is exactly what an untouched widget
 *     produces: every card starts in the tray. Marking it `wrong` would burn a kid's
 *     attempt and a star for pressing Check too early.
 *   - A left id used twice, a right id used twice, an id we never issued, a pair that is
 *     not a couple, a non-array, a non-object ⇒ `invalid`. None of those can be produced by
 *     moving cards around a board where every slot holds at most one card, so none of them
 *     is a matching we can mark wrong.
 *
 * THE DOUBLE-BOOKING TRAP, which is why both sides are counted and not just compared.
 * A response that joins one right card to two different left cards covers two possibilities
 * at once. If only the left ids were required to be unique, `[{l1,r1},{l2,r1},{l3,r3}]`
 * would be a legal-looking board in which `r1` hedges; if only a set difference were taken,
 * a repeat would be silently eaten. Both directions must be `invalid`.
 *
 * WHY `wrong` IS REACHABLE AT ALL. With every left and every right used exactly once the
 * response is a permutation, so a wrong board is a derangement of the right one — always
 * available for two or more pairs. The test below uses a rotation, which is the wrong-ness
 * a child actually produces.
 */
import { test } from 'node:test'
import assert from 'node:assert/strict'

import { check } from './check.js'

const RIGHT = { correct: true, reason: null }
const WRONG = { correct: false, reason: 'wrong' }
const INVALID = { correct: false, reason: 'invalid' }

/** Deliberately not index-aligned: `l1` belongs with `r2`, not with `r1`. */
const ANSWER = {
  pairs: [
    { left: 'l1', right: 'r2' },
    { left: 'l2', right: 'r3' },
    { left: 'l3', right: 'r1' },
  ],
}

const pairs = (...couples) => ({ pairs: couples.map(([left, right]) => ({ left, right })) })

// A kid's browser can send anything at all.
const HOSTILE = [
  undefined,
  null,
  0,
  '',
  'abc',
  true,
  [],
  {},
  { pairs: null },
  { pairs: {} },
  { pairs: 'l1r2' },
  { pairs: [null] },
  { pairs: [['l1', 'r2']] },
  { pairs: [{ left: 'l1' }] },
  { pairs: [{ right: 'r2' }] },
  { pairs: [{ left: 1, right: 2 }] },
  { pairs: [{ left: 'l1', right: 'r2' }, { left: 'l2', right: 'r3' }] },
  { pairs: Object.assign([{ left: 'l1', right: 'r2' }], { length: 3 }) },
]

test('match: the same couples in a different order are the same answer', () => {
  assert.deepEqual(check('match', ANSWER, pairs(['l3', 'r1'], ['l1', 'r2'], ['l2', 'r3'])), RIGHT)
  assert.deepEqual(check('match', ANSWER, pairs(['l2', 'r3'], ['l3', 'r1'], ['l1', 'r2'])), RIGHT)
  assert.deepEqual(check('match', ANSWER, pairs(['l1', 'r2'], ['l2', 'r3'], ['l3', 'r1'])), RIGHT)
})

test('match: a complete board with at least one couple wrong is wrong', () => {
  // A rotation: every card used exactly once, and not one couple right.
  assert.deepEqual(check('match', ANSWER, pairs(['l1', 'r3'], ['l2', 'r1'], ['l3', 'r2'])), WRONG)
  // One transposition: two couples right, one pair swapped. Still wrong, not partly right.
  assert.deepEqual(check('match', ANSWER, pairs(['l1', 'r3'], ['l2', 'r2'], ['l3', 'r1'])), WRONG)
})

test('match: a card still in the tray is invalid — unfinished, not mistaken', () => {
  assert.deepEqual(check('match', ANSWER, pairs(['l1', 'r2'], ['l2', 'r3'])), INVALID)
  assert.deepEqual(check('match', ANSWER, { pairs: [] }), INVALID)
})

test('match: one right card cannot be joined to two left cards', () => {
  assert.deepEqual(check('match', ANSWER, pairs(['l1', 'r2'], ['l2', 'r2'], ['l3', 'r1'])), INVALID)
})

test('match: one left card cannot be joined to two right cards', () => {
  assert.deepEqual(check('match', ANSWER, pairs(['l1', 'r2'], ['l1', 'r3'], ['l3', 'r1'])), INVALID)
})

test('match: an id we never issued is invalid, however plausible it looks', () => {
  assert.deepEqual(check('match', ANSWER, pairs(['l1', 'r2'], ['l2', 'r3'], ['l4', 'r1'])), INVALID)
  assert.deepEqual(check('match', ANSWER, pairs(['l1', 'r2'], ['l2', 'r3'], ['l3', 'r4'])), INVALID)
  // The two columns are separate alphabets: a left id is not a right id.
  assert.deepEqual(check('match', ANSWER, pairs(['l1', 'r2'], ['l2', 'r3'], ['l3', 'l3'])), INVALID)
  assert.deepEqual(check('match', ANSWER, pairs(['r1', 'r2'], ['l2', 'r3'], ['l3', 'r1'])), INVALID)
})

test('match: a hostile response is invalid, never thrown and never correct', () => {
  for (const response of HOSTILE) {
    assert.deepEqual(check('match', ANSWER, response), INVALID, JSON.stringify(response ?? null))
  }
})

test('match: a very long forged id is graded, not thrown', () => {
  const huge = 'r'.repeat(100_000)
  assert.deepEqual(check('match', ANSWER, pairs(['l1', huge], ['l2', 'r3'], ['l3', 'r1'])), INVALID)
})

test('match: a single-couple answer still grades all three ways', () => {
  const one = { pairs: [{ left: 'only-left', right: 'only-right' }] }
  assert.deepEqual(check('match', one, pairs(['only-left', 'only-right'])), RIGHT)
  assert.deepEqual(check('match', one, pairs(['only-left', 'nope'])), INVALID)
  assert.deepEqual(check('match', one, { pairs: [] }), INVALID)
})

test('match: a malformed answer is our bug and throws, whatever the response is', () => {
  const broken = [
    undefined,
    null,
    'l1',
    [],
    {},
    { pairs: null },
    { pairs: [] },
    { pairs: {} },
    { pairs: [null] },
    { pairs: [['l1', 'r1']] },
    { pairs: [{ left: 'l1' }] },
    { pairs: [{ right: 'r1' }] },
    { pairs: [{ left: '', right: 'r1' }] },
    { pairs: [{ left: 'l1', right: '' }] },
    { pairs: [{ left: 1, right: 2 }] },
    // Our own content must never double-book either side.
    { pairs: [{ left: 'l1', right: 'r1' }, { left: 'l1', right: 'r2' }] },
    { pairs: [{ left: 'l1', right: 'r1' }, { left: 'l2', right: 'r1' }] },
  ]
  for (const answer of broken) {
    assert.throws(() => check('match', answer, pairs(['l1', 'r1'])), TypeError, JSON.stringify(answer ?? null))
    assert.throws(() => check('match', answer, undefined), TypeError, JSON.stringify(answer ?? null))
  }
})

test('match: grading does not mutate the answer or the response it was handed', () => {
  const answer = structuredClone(ANSWER)
  const response = pairs(['l3', 'r1'], ['l1', 'r2'], ['l2', 'r3'])
  const answerBefore = structuredClone(answer)
  const responseBefore = structuredClone(response)
  check('match', answer, response)
  assert.deepEqual(answer, answerBefore)
  assert.deepEqual(response, responseBefore)
})

test('match: the left column is what must be complete, whichever order it is listed in', () => {
  // Same three couples, answer written back-to-front: still correct, still wrong, still
  // invalid in the same three places. `set` means the answer's own order is irrelevant too.
  const reversed = { pairs: [...ANSWER.pairs].reverse() }
  assert.deepEqual(check('match', reversed, pairs(['l1', 'r2'], ['l2', 'r3'], ['l3', 'r1'])), RIGHT)
  assert.deepEqual(check('match', reversed, pairs(['l1', 'r3'], ['l2', 'r1'], ['l3', 'r2'])), WRONG)
  assert.deepEqual(check('match', reversed, pairs(['l1', 'r2'], ['l2', 'r3'])), INVALID)
})
