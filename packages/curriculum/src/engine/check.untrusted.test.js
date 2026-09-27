/**
 * P1.2 (referee follow-up): check() must grade any kid response and never throw on one.
 *
 * POST /attempts (P1.7) calls check(widget, answer, response) with whatever the browser sent. A
 * throw there is a 500 for the kid, not a graded attempt. Two gaps found in review:
 *   - parseFraction threw RangeError on a typed mixed number whose value is too large
 *     ("9007199254740 1/1000000"), instead of returning null.
 *   - equals threw RangeError when the cross products pass 2^53, so a large but valid typed
 *     fraction ("9007199254740991/1") crashed the fraction checker instead of being wrong.
 * And one ordering gap: a malformed answer (our content bug) was hidden whenever the response was
 * junk, because the number checker looked at the response first. An answer of Infinity is also a
 * content bug and must throw, whatever the response.
 */
import { test } from 'node:test'
import assert from 'node:assert/strict'

import { check } from './check.js'
import { equals, parseFraction } from './fraction.js'

const WRONG = { correct: false, reason: 'wrong' }
const INVALID = { correct: false, reason: 'invalid' }

test('parseFraction returns null, never throws, for a mixed number too large to be exact', () => {
  assert.equal(parseFraction('9007199254740 1/1000000'), null)
  assert.equal(parseFraction('-9007199254740 1/1000000'), null)
})

test('parseFraction accepts the largest safe integer as written', () => {
  assert.deepEqual(parseFraction('9007199254740991/1'), { num: 9007199254740991, den: 1 })
  assert.deepEqual(parseFraction('1/9007199254740991'), { num: 1, den: 9007199254740991 })
})

test('equals is exact for any safe-integer fractions, even when cross products pass 2^53', () => {
  const k = 1_000_000_000_007
  const m = 999_999_999_989
  assert.equal(equals({ num: 3 * k, den: 3 * m }, { num: k, den: m }), true)
  assert.equal(equals({ num: k, den: m }, { num: k + 1, den: m }), false)
  assert.equal(equals({ num: 2 ** 53 - 1, den: 3 }, { num: 2 ** 53 - 2, den: 3 }), false)
  assert.equal(equals({ num: -(2 ** 53 - 1), den: 2 ** 53 - 2 }, { num: 2 ** 53 - 1, den: -(2 ** 53 - 2) }), true)
})

test('fraction: a large typed fraction is graded wrong, not thrown', () => {
  const answer = { num: 3, den: 4, simplest: true }
  assert.deepEqual(check('fraction', answer, { text: '9007199254740991/1' }), WRONG)
  assert.deepEqual(check('fraction', answer, { text: '9007199254740991/9007199254740990' }), WRONG)
  assert.deepEqual(check('fraction', answer, { text: '1/9007199254740991' }), WRONG)
})

test('fraction: a typed value too large to be exact is invalid, not thrown', () => {
  const answer = { num: 3, den: 4 }
  assert.deepEqual(check('fraction', answer, { text: '9007199254740 1/1000000' }), INVALID)
  assert.deepEqual(check('fraction', answer, { text: `${'1'.repeat(20)}/3` }), INVALID)
  assert.deepEqual(check('fraction', answer, { text: '1'.repeat(400) }), INVALID)
})

test('number: a typed numeral too long to be finite is invalid, not thrown', () => {
  assert.deepEqual(check('number', { value: 42 }, { value: '9'.repeat(400) }), INVALID)
})

test('choice: a very long id is graded, not thrown', () => {
  assert.deepEqual(check('choice', { id: 'b' }, { id: 'x'.repeat(10_000) }), WRONG)
})

test('a malformed answer throws even when the response is junk, for every widget', () => {
  for (const response of [null, undefined, 'junk', {}]) {
    assert.throws(() => check('choice', { id: '' }, response), TypeError, `choice ${String(response)}`)
    assert.throws(() => check('number', { value: '42' }, response), TypeError, `number ${String(response)}`)
    assert.throws(() => check('fraction', { num: 3, den: 0 }, response), TypeError, `fraction ${String(response)}`)
  }
})

test('number: a non-finite answer throws before the response is looked at', () => {
  for (const value of [Infinity, -Infinity]) {
    for (const response of [null, {}, { value: 'Infinity' }, { value: '42' }]) {
      assert.throws(() => check('number', { value }, response), TypeError, `${value} ${JSON.stringify(response)}`)
    }
  }
})
