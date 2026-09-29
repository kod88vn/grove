/**
 * P2.10 part 1a of 2 — `check('clock', …)`.
 *
 * HOMEWORK_PLAN.md §6.3 (line 191), quoted whole:
 *
 *   | `clock` | telling time | hh:mm equality | A |
 *
 * That row is the entire specification, and it decides the widget's mode as well as its
 * checker. "hh:mm equality" compares an HOUR and a MINUTE carried by the response — which
 * is what a pair of hands points at. A "read the clock and type it" exercise would be
 * graded by `number` over the typed text, and would additionally require the face to print
 * the answer before the child has solved anything. So:
 *
 *   the `clock` widget SETS THE HANDS, and the response is where they point.
 *
 * The shape:
 *
 *   answer   = { hour: 1..12, minute: 0..59 }
 *   response = { hour: 1..12, minute: 0..59 }
 *
 * TWELVE-HOUR, AND NO am/pm. An analogue face has no way to express one, so there is no
 * `period` field — which also means there is no `period` field for a checker to forget to
 * compare. `hour` runs 1..12 and `12` is the top of the dial, never `0`. A response of
 * `{ hour: 0 }` or `{ hour: 16 }` therefore did not come from a clock face, and is
 * `invalid` rather than quietly normalised: normalising is how `16:20` would come back
 * "correct" for `4:20` from a client that was never supposed to be able to say it.
 *
 * NO KNOWLEDGE OF THE FIVE-MINUTE GRID. The widget snaps the minute hand to five-minute
 * marks (see `ClockWidget.test.js` for why, and for the plan rows that fix it). The checker
 * knows nothing about that: a clock CAN point at 4:21, so `4:21` against `4:20` is `wrong`.
 * Putting the grid in the checker would make a legal hand position unreadable, and would
 * silently break the day a finer-grained template lands.
 *
 * WHERE THE LINE BETWEEN `wrong` AND `invalid` IS DRAWN. Same rule as every other checker
 * in this engine (`check.test.js` header): a malformed ANSWER is our content bug and
 * throws; a malformed RESPONSE came from a kid's browser and is `invalid`, never thrown and
 * never correct.
 *
 *   - Hands somewhere a clock can point, but not the right somewhere ⇒ `wrong`.
 *   - Hands somewhere no clock can point (hour 0 or 13, minute 60 or −1, a fraction, a
 *     string, a missing field, an extra field) ⇒ `invalid`.
 *
 * WHY AN EXTRA KEY IS `invalid` AND NOT IGNORED. The one thing this response shape could
 * plausibly grow is `period: 'am' | 'pm'`. A checker that ignores unknown keys would grade
 * such a response without ever comparing it, and a child who had picked "pm" would be told
 * they were right about a thing that was never read. Refusing the shape outright is the
 * only behaviour that cannot do that.
 */
import { test } from 'node:test'
import assert from 'node:assert/strict'

import { check } from './check.js'

const RIGHT = { correct: true, reason: null }
const WRONG = { correct: false, reason: 'wrong' }
const INVALID = { correct: false, reason: 'invalid' }

const at = (hour, minute) => ({ hour, minute })

/** Every hh:mm a twelve-hour face can hold — 12 hours × 60 minutes. */
const EVERY_TIME = []
for (let hour = 1; hour <= 12; hour++) {
  for (let minute = 0; minute < 60; minute++) EVERY_TIME.push(at(hour, minute))
}

test('clock: the same hour and the same minute is correct', () => {
  assert.deepEqual(check('clock', at(4, 20), at(4, 20)), RIGHT)
  assert.deepEqual(check('clock', at(12, 0), at(12, 0)), RIGHT)
  assert.deepEqual(check('clock', at(11, 55), at(11, 55)), RIGHT)
  assert.deepEqual(check('clock', at(1, 5), at(1, 5)), RIGHT)
})

test('clock: every one of the 720 readable times grades itself correct', () => {
  for (const time of EVERY_TIME) {
    assert.deepEqual(check('clock', time, { ...time }), RIGHT, `${time.hour}:${time.minute}`)
  }
})

test('clock: the right hour with the wrong minute is wrong, not correct', () => {
  assert.deepEqual(check('clock', at(4, 20), at(4, 25)), WRONG)
  assert.deepEqual(check('clock', at(4, 20), at(4, 0)), WRONG)
  // One minute out. A clock can point there, so it is a reading, and a reading that is not
  // the answer is `wrong` — the five-minute grid the WIDGET uses is not the checker's business.
  assert.deepEqual(check('clock', at(4, 20), at(4, 21)), WRONG)
})

test('clock: the right minute with the wrong hour is wrong, not correct', () => {
  assert.deepEqual(check('clock', at(4, 20), at(5, 20)), WRONG)
  assert.deepEqual(check('clock', at(12, 30), at(11, 30)), WRONG)
  // Twelve hours out on a twelve-hour face is the SAME reading, so this must not be
  // reachable: 16 is not a position, and is handled by the invalid test below.
  assert.deepEqual(check('clock', at(1, 0), at(12, 0)), WRONG)
})

test('clock: both hands wrong is wrong', () => {
  assert.deepEqual(check('clock', at(4, 20), at(7, 45)), WRONG)
  for (const time of EVERY_TIME) {
    const other = at((time.hour % 12) + 1, (time.minute + 5) % 60)
    assert.deepEqual(check('clock', time, other), WRONG, `${time.hour}:${time.minute}`)
  }
})

test('clock: an hour no dial carries is invalid, never normalised into a correct answer', () => {
  // The 24-hour bug this exists to catch: a client that sent 16:20 for twenty past four
  // must NOT be graded right by a checker that quietly takes hour % 12.
  assert.deepEqual(check('clock', at(4, 20), at(16, 20)), INVALID)
  assert.deepEqual(check('clock', at(12, 0), at(0, 0)), INVALID)
  assert.deepEqual(check('clock', at(12, 0), at(24, 0)), INVALID)
  for (const hour of [-1, 0, 13, 23, 99, 1e6]) {
    assert.deepEqual(check('clock', at(4, 20), at(hour, 20)), INVALID, `hour ${hour}`)
  }
})

test('clock: a minute no dial carries is invalid, never normalised into a correct answer', () => {
  // Same trap from the other side: 4:80 must not become 5:20.
  assert.deepEqual(check('clock', at(5, 20), at(4, 80)), INVALID)
  for (const minute of [-1, 60, 61, 120, 1e6]) {
    assert.deepEqual(check('clock', at(4, 20), at(4, minute)), INVALID, `minute ${minute}`)
  }
})

test('clock: a hand that is not a whole number is invalid', () => {
  for (const value of [4.5, 0.1, Number.NaN, Number.POSITIVE_INFINITY, Number.NEGATIVE_INFINITY]) {
    assert.deepEqual(check('clock', at(4, 20), at(value, 20)), INVALID, `hour ${String(value)}`)
    assert.deepEqual(check('clock', at(4, 20), at(4, value)), INVALID, `minute ${String(value)}`)
  }
})

test('clock: a time written as text is invalid — the response carries two numbers', () => {
  assert.deepEqual(check('clock', at(4, 20), { hour: '4', minute: '20' }), INVALID)
  assert.deepEqual(check('clock', at(4, 20), { hour: '4', minute: 20 }), INVALID)
  assert.deepEqual(check('clock', at(4, 20), { time: '4:20' }), INVALID)
  assert.deepEqual(check('clock', at(4, 20), '4:20'), INVALID)
})

test('clock: a missing or extra field is invalid, never silently ignored', () => {
  assert.deepEqual(check('clock', at(4, 20), { hour: 4 }), INVALID)
  assert.deepEqual(check('clock', at(4, 20), { minute: 20 }), INVALID)
  assert.deepEqual(check('clock', at(4, 20), {}), INVALID)
  // The field this shape would plausibly grow. Graded, it would be compared; ignored, a kid
  // could be told they were right about something nobody read. Refused instead.
  assert.deepEqual(check('clock', at(4, 20), { hour: 4, minute: 20, period: 'pm' }), INVALID)
  assert.deepEqual(check('clock', at(4, 20), { hour: 4, minute: 20, seconds: 0 }), INVALID)
})

test('clock: a hostile response is invalid, never thrown and never correct', () => {
  const hostile = [
    null,
    undefined,
    0,
    4.2,
    true,
    'clock',
    [],
    [4, 20],
    { hour: null, minute: null },
    { hour: [4], minute: [20] },
    { hour: { valueOf: () => 4 }, minute: 20 },
    // Inherited, not own. `match` already reads own keys only (`Object.keys(pair).length`),
    // and the same must hold here or a prototype could smuggle a reading in.
    Object.create({ hour: 4, minute: 20 }),
    new Map([['hour', 4], ['minute', 20]]),
    JSON.parse('{"__proto__": {"hour": 4, "minute": 20}}'),
  ]
  for (const response of hostile) {
    let result
    assert.doesNotThrow(() => {
      result = check('clock', at(4, 20), response)
    }, `check threw on ${JSON.stringify(response) ?? String(response)}`)
    assert.equal(result.correct, false, `graded correct: ${String(response)}`)
    assert.equal(result.reason, 'invalid', `graded ${result.reason}: ${String(response)}`)
  }
})

test('clock: a malformed answer is our bug and throws, whatever the response is', () => {
  const broken = [
    null,
    undefined,
    'four twenty',
    42,
    [],
    [4, 20],
    {},
    { hour: 4 },
    { minute: 20 },
    { hour: 0, minute: 0 },
    { hour: 13, minute: 0 },
    { hour: -1, minute: 0 },
    { hour: 4, minute: 60 },
    { hour: 4, minute: -1 },
    { hour: 4.5, minute: 20 },
    { hour: '4', minute: '20' },
    { hour: Number.NaN, minute: 20 },
    { hour: 4, minute: 20, period: 'pm' },
  ]
  for (const answer of broken) {
    assert.throws(
      () => check('clock', answer, at(4, 20)),
      TypeError,
      `did not throw for answer ${JSON.stringify(answer) ?? String(answer)}`,
    )
    assert.throws(() => check('clock', answer, null), TypeError)
  }
})

test('clock: grading does not mutate the answer or the response it was handed', () => {
  const answer = at(4, 20)
  const response = at(4, 25)
  const answerBefore = JSON.stringify(answer)
  const responseBefore = JSON.stringify(response)

  check('clock', answer, response)
  check('clock', answer, { ...answer })

  assert.equal(JSON.stringify(answer), answerBefore)
  assert.equal(JSON.stringify(response), responseBefore)
})
