/**
 * P1.2: engine/fraction.js — parse "3/4" and "1 1/2", test simplest form, and exact
 * arithmetic (HOMEWORK_PLAN §6.1). The fraction checker (check.js) grades a kid's typed
 * answer with it, and poly.js (a later phase) uses it for exact coefficients, so it must never
 * round and never return a wrong value silently.
 *
 * A fraction is a plain object { num, den } of safe integers. parseFraction keeps the
 * fraction as written (6/8 stays 6/8) so the checker can tell whether the kid simplified;
 * the arithmetic functions always return lowest terms with a positive denominator.
 */
import { test } from 'node:test'
import assert from 'node:assert/strict'

import {
  parseFraction,
  reduce,
  isSimplest,
  equals,
  add,
  sub,
  mul,
  div,
  format,
} from './fraction.js'

const f = (num, den) => ({ num, den })

test('parses a proper fraction, an improper one, and a whole number as written', () => {
  assert.deepEqual(parseFraction('3/4'), f(3, 4))
  assert.deepEqual(parseFraction('7/4'), f(7, 4))
  assert.deepEqual(parseFraction('6/8'), f(6, 8), 'not reduced: the checker needs to see 6/8')
  assert.deepEqual(parseFraction('5'), f(5, 1))
  assert.deepEqual(parseFraction('0'), f(0, 1))
})

test('parses a mixed number into an improper fraction', () => {
  assert.deepEqual(parseFraction('1 1/2'), f(3, 2))
  assert.deepEqual(parseFraction('2 3/4'), f(11, 4))
  assert.deepEqual(parseFraction('1 2/4'), f(6, 4), 'as written, not reduced')
  assert.deepEqual(parseFraction('3   1/3'), f(10, 3), 'several spaces between the parts')
})

test('a leading minus sign negates the whole value, including a mixed number', () => {
  assert.deepEqual(parseFraction('-3/4'), f(-3, 4))
  assert.deepEqual(parseFraction('-1 1/2'), f(-3, 2))
  assert.deepEqual(parseFraction('-5'), f(-5, 1))
})

test('ignores surrounding whitespace', () => {
  assert.deepEqual(parseFraction('  3/4 \n'), f(3, 4))
})

test('returns null for text that is not a fraction', () => {
  const bad = [
    '', '   ', 'abc', '3/', '/4', '3//4', '1/2/3', '3/0', '1 1/0', '0/0',
    '1.5', '1,5', '.5', '1e3', '3 / 4', '1/-2', '--1/2', '+1/2', '1 -1/2',
    '1 3/2', '1 2/2', '1 0/3', '1 1', '½', '3/4x',
    '9007199254740993/2', '1/9007199254740993',
  ]
  for (const text of bad) assert.equal(parseFraction(text), null, JSON.stringify(text))
})

test('returns null for input that is not a string', () => {
  for (const value of [undefined, null, 3, { num: 1, den: 2 }, ['1/2']]) {
    assert.equal(parseFraction(value), null, String(value))
  }
})

test('reduce returns lowest terms with a positive denominator', () => {
  assert.deepEqual(reduce(f(6, 8)), f(3, 4))
  assert.deepEqual(reduce(f(-6, 8)), f(-3, 4))
  assert.deepEqual(reduce(f(6, -8)), f(-3, 4))
  assert.deepEqual(reduce(f(-6, -8)), f(3, 4))
  assert.deepEqual(reduce(f(0, 5)), f(0, 1))
  assert.deepEqual(reduce(f(12, 4)), f(3, 1))
})

test('reduce rejects a zero denominator or a part that is not a safe integer', () => {
  assert.throws(() => reduce(f(1, 0)), RangeError)
  assert.throws(() => reduce(f(1.5, 2)), RangeError)
  assert.throws(() => reduce(f(1, 2.5)), RangeError)
  assert.throws(() => reduce(f('1', 2)), RangeError)
  assert.throws(() => reduce(f(2 ** 53, 3)), RangeError)
})

test('isSimplest is true only for lowest terms with a positive denominator', () => {
  assert.equal(isSimplest(f(3, 4)), true)
  assert.equal(isSimplest(f(-3, 4)), true)
  assert.equal(isSimplest(f(7, 4)), true)
  assert.equal(isSimplest(f(5, 1)), true)
  assert.equal(isSimplest(f(0, 1)), true)
  assert.equal(isSimplest(f(6, 8)), false)
  assert.equal(isSimplest(f(4, 2)), false)
  assert.equal(isSimplest(f(0, 5)), false)
  assert.equal(isSimplest(f(3, -4)), false)
})

test('equals compares values, not spellings', () => {
  assert.equal(equals(f(3, 4), f(6, 8)), true)
  assert.equal(equals(f(-1, 2), f(1, -2)), true)
  assert.equal(equals(f(0, 1), f(0, 7)), true)
  assert.equal(equals(f(3, 4), f(4, 3)), false)
  assert.equal(equals(f(1, 2), f(-1, 2)), false)
})

test('add, sub, mul and div return exact results in lowest terms', () => {
  assert.deepEqual(add(f(1, 3), f(1, 4)), f(7, 12))
  assert.deepEqual(add(f(1, 6), f(1, 3)), f(1, 2))
  assert.deepEqual(add(f(3, 4), f(-3, 4)), f(0, 1))
  assert.deepEqual(sub(f(1, 2), f(3, 4)), f(-1, 4))
  assert.deepEqual(mul(f(2, 3), f(9, 4)), f(3, 2))
  assert.deepEqual(mul(f(-2, 3), f(3, -2)), f(1, 1))
  assert.deepEqual(div(f(1, 2), f(1, 4)), f(2, 1))
  assert.deepEqual(div(f(3, 5), f(-6, 5)), f(-1, 2))
})

test('add of 1/10 and 2/10 is exactly 3/10 (no floating point)', () => {
  assert.deepEqual(add(f(1, 10), f(2, 10)), f(3, 10))
})

test('div by a zero fraction throws instead of returning a value', () => {
  assert.throws(() => div(f(1, 2), f(0, 3)), RangeError)
})

test('arithmetic throws when a result would not be a safe integer, instead of rounding', () => {
  assert.throws(() => mul(f(2 ** 40, 1), f(2 ** 40, 1)), RangeError)
  assert.throws(() => add(f(1, 2 ** 30 + 1), f(1, 2 ** 30 - 1)), RangeError)
})

test('format writes a/b, or just the numerator when the denominator is 1', () => {
  assert.equal(format(f(3, 4)), '3/4')
  assert.equal(format(f(-3, 4)), '-3/4')
  assert.equal(format(f(7, 4)), '7/4')
  assert.equal(format(f(5, 1)), '5')
  assert.equal(format(f(6, 8)), '6/8', 'format does not reduce')
})

test('format output parses back to the same fraction', () => {
  for (const x of [f(3, 4), f(-3, 4), f(7, 4), f(5, 1), f(0, 1), f(-12, 1)]) {
    assert.deepEqual(parseFraction(format(x)), x)
  }
})
