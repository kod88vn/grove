/**
 * P1.2 (review follow-up, PR #76): sign handling and exact arithmetic.
 *
 *   - A leading minus negates the whole mixed number, even when the whole part is 0:
 *     "-0 1/2" is -1/2. It was parsed as +1/2 (the sign came from Number('-0') < 0, which is
 *     false), so a kid typing "-0 1/2" was graded correct for 1/2.
 *   - parseFraction never returns a negative zero numerator ("-0", "-0/5").
 *   - add, sub, mul, div compute exactly and reduce before the safety check, so an intermediate
 *     product past 2^53 is fine when the reduced result is safe. They still throw RangeError when
 *     the reduced result itself is not a safe fraction.
 */
import { test } from 'node:test'
import assert from 'node:assert/strict'

import { check } from './check.js'
import { add, div, mul, parseFraction, sub } from './fraction.js'

const M = Number.MAX_SAFE_INTEGER
const f = (num, den) => ({ num, den })

test('parseFraction: a leading minus negates a mixed number whose whole part is 0', () => {
  assert.deepEqual(parseFraction('-0 1/2'), f(-1, 2))
  assert.deepEqual(parseFraction('-0 3/4'), f(-3, 4))
  assert.deepEqual(parseFraction('0 3/4'), f(3, 4))
})

test('fraction: "-0 1/2" is wrong for 1/2 and right for -1/2', () => {
  assert.deepEqual(check('fraction', f(1, 2), { text: '-0 1/2' }), { correct: false, reason: 'wrong' })
  assert.deepEqual(check('fraction', f(-1, 2), { text: '-0 1/2' }), { correct: true, reason: null })
})

test('parseFraction never returns a negative zero numerator', () => {
  for (const text of ['-0', '-0/5', '-00', '-0/1']) {
    const value = parseFraction(text)
    assert.ok(value, text)
    assert.ok(Object.is(value.num, 0), `${text} gave num ${Object.is(value.num, -0) ? '-0' : value.num}`)
  }
})

test('arithmetic reduces exactly before checking safety, so overflowing intermediates are fine', () => {
  assert.deepEqual(mul(f(M, 2), f(2, M)), f(1, 1))
  assert.deepEqual(div(f(M, 2), f(M, 2)), f(1, 1))
  assert.deepEqual(add(f(M, M), f(M, M)), f(2, 1))
  assert.deepEqual(sub(f(M, M), f(M, M)), f(0, 1))
  assert.deepEqual(add(f(M - 1, M), f(1, M)), f(1, 1))
})

test('arithmetic still throws RangeError when the reduced result is not safe', () => {
  assert.throws(() => mul(f(M, 1), f(2, 1)), RangeError)
  assert.throws(() => add(f(M, 1), f(1, 1)), RangeError)
  assert.throws(() => div(f(M, 1), f(1, 2)), RangeError)
  assert.throws(() => sub(f(-M, 1), f(1, 1)), RangeError)
})
