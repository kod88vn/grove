/**
 * P1.2: engine/check.js — one checker per widget type (HOMEWORK_PLAN §6.1, §6.3).
 *
 * POST /attempts re-renders the problem from its seed on the server and calls
 * check(widget, answer, response). `answer` comes from our own template, so a malformed answer
 * is a bug in our content and must throw. `response` comes from the kid's browser, so it is
 * untrusted: anything malformed is graded { correct: false, reason: 'invalid' }, never thrown
 * and never counted as correct.
 *
 * Phase 1 needs the checkers for choice, number and fraction (§6.3 table); the rest arrive
 * with their widgets in Phase 2.
 *
 * Result shape: { correct: boolean, reason: null | 'wrong' | 'invalid' | 'not-simplest' },
 * with reason null exactly when correct.
 */
import { test } from 'node:test'
import assert from 'node:assert/strict'

import { check } from './check.js'

const RIGHT = { correct: true, reason: null }
const WRONG = { correct: false, reason: 'wrong' }
const INVALID = { correct: false, reason: 'invalid' }
const NOT_SIMPLEST = { correct: false, reason: 'not-simplest' }

// A kid's browser can send anything at all.
const HOSTILE = [undefined, null, 0, '', 'b', [], ['b'], true, () => ({ id: 'b', value: 42, text: '3/4' })]

test('an unknown widget type throws and names the widget', () => {
  assert.throws(() => check('abacus', { value: 1 }, { value: 1 }), /abacus/)
})

// ---------------------------------------------------------------- choice

test('choice: correct only when the chosen id equals the answer id', () => {
  assert.deepEqual(check('choice', { id: 'b' }, { id: 'b' }), RIGHT)
  assert.deepEqual(check('choice', { id: 'b' }, { id: 'c' }), WRONG)
  assert.deepEqual(check('choice', { id: 'b' }, { id: 'B' }), WRONG, 'ids are case-sensitive')
})

test('choice: a response without a string id is invalid, never correct', () => {
  for (const response of [...HOSTILE, {}, { id: 2 }, { id: ['b'] }, { id: { toString: () => 'b' } }]) {
    assert.deepEqual(check('choice', { id: 'b' }, response), INVALID, String(response))
  }
})

test('choice: an answer without a non-empty string id is a content bug and throws', () => {
  for (const answer of [undefined, null, {}, { id: '' }, { id: 2 }]) {
    assert.throws(() => check('choice', answer, { id: 'b' }), TypeError)
  }
})

// ---------------------------------------------------------------- number

test('number: exact equality by default, from a typed string or a number', () => {
  assert.deepEqual(check('number', { value: 42 }, { value: '42' }), RIGHT)
  assert.deepEqual(check('number', { value: 42 }, { value: 42 }), RIGHT)
  assert.deepEqual(check('number', { value: 42 }, { value: '43' }), WRONG)
  assert.deepEqual(check('number', { value: -7 }, { value: '-7' }), RIGHT)
  assert.deepEqual(check('number', { value: 2.5 }, { value: '2.5' }), RIGHT)
  assert.deepEqual(check('number', { value: 2.5 }, { value: '2.50' }), RIGHT)
  assert.deepEqual(check('number', { value: 0.3 }, { value: '0.3' }), RIGHT)
})

test('number: surrounding whitespace is ignored', () => {
  assert.deepEqual(check('number', { value: 42 }, { value: ' 42 ' }), RIGHT)
})

test('number: thousands separators are accepted only in valid groups of three', () => {
  assert.deepEqual(check('number', { value: 1234 }, { value: '1,234' }), RIGHT)
  assert.deepEqual(check('number', { value: 1234567 }, { value: '1,234,567' }), RIGHT)
  assert.deepEqual(check('number', { value: -1234.5 }, { value: '-1,234.5' }), RIGHT)
  assert.deepEqual(check('number', { value: 1234 }, { value: '12,34' }), INVALID)
  assert.deepEqual(check('number', { value: 1234 }, { value: '1,2345' }), INVALID)
  assert.deepEqual(check('number', { value: 1234 }, { value: ',1234' }), INVALID)
})

test('number: text that is not a plain decimal numeral is invalid, never correct', () => {
  // Number('') is 0, Number('0x10') is 16 and Number('1e1') is 10: none of them may pass.
  const cases = [
    [0, ''], [0, '   '], [16, '0x10'], [10, '1e1'], [0.5, '.5'], [5, '5.'], [5, '+5'],
    [5, '5 5'], [5, 'five'], [5, 'Infinity'], [5, '-Infinity'], [5, '--5'], [5, '5-'], [0, '0b0'],
  ]
  for (const [value, text] of cases) {
    assert.deepEqual(check('number', { value }, { value: text }), INVALID, JSON.stringify(text))
  }
})

test('number: a response value that is not a finite number or a string is invalid', () => {
  for (const response of [...HOSTILE, {}, { value: NaN }, { value: Infinity }, { value: null }, { value: [42] }, { value: true }]) {
    assert.deepEqual(check('number', { value: 42 }, response), INVALID, String(response))
  }
})

test('number: an optional tolerance accepts values within it and rejects those outside', () => {
  const answer = { value: 3.14, tolerance: 0.01 }
  assert.deepEqual(check('number', answer, { value: '3.145' }), RIGHT)
  assert.deepEqual(check('number', answer, { value: '3.135' }), RIGHT)
  assert.deepEqual(check('number', answer, { value: '3.2' }), WRONG)
  assert.deepEqual(check('number', answer, { value: '3.1' }), WRONG)
})

test('number: an answer without a finite value, or with a bad tolerance, is a content bug and throws', () => {
  for (const answer of [undefined, {}, { value: '42' }, { value: NaN }, { value: Infinity }, { value: -Infinity }, { value: 1, tolerance: -1 }, { value: 1, tolerance: '0.1' }, { value: 1, tolerance: Infinity }]) {
    assert.throws(() => check('number', answer, { value: '42' }), TypeError)
  }
})

// ---------------------------------------------------------------- fraction

test('fraction: any equal value is correct when simplest form is not required', () => {
  const answer = { num: 3, den: 4 }
  assert.deepEqual(check('fraction', answer, { text: '3/4' }), RIGHT)
  assert.deepEqual(check('fraction', answer, { text: '6/8' }), RIGHT)
  assert.deepEqual(check('fraction', answer, { text: '4/3' }), WRONG)
})

test('fraction: a mixed number and an improper fraction are the same value', () => {
  const answer = { num: 3, den: 2, simplest: true }
  assert.deepEqual(check('fraction', answer, { text: '1 1/2' }), RIGHT)
  assert.deepEqual(check('fraction', answer, { text: '3/2' }), RIGHT)
})

test('fraction: with simplest required, the right value not in lowest terms says so', () => {
  const answer = { num: 7, den: 12, simplest: true }
  assert.deepEqual(check('fraction', answer, { text: '7/12' }), RIGHT)
  assert.deepEqual(check('fraction', answer, { text: '14/24' }), NOT_SIMPLEST)
  assert.deepEqual(check('fraction', answer, { text: '5/12' }), WRONG)
  assert.deepEqual(check('fraction', { num: 2, den: 1, simplest: true }, { text: '4/2' }), NOT_SIMPLEST)
  assert.deepEqual(check('fraction', { num: 2, den: 1, simplest: true }, { text: '2' }), RIGHT)
  assert.deepEqual(check('fraction', { num: 3, den: 2, simplest: true }, { text: '1 2/4' }), NOT_SIMPLEST)
})

test('fraction: the answer may be stored unreduced; the value is what counts', () => {
  assert.deepEqual(check('fraction', { num: 6, den: 8, simplest: true }, { text: '3/4' }), RIGHT)
})

test('fraction: a wrong value is wrong, not not-simplest, even when it is not in lowest terms', () => {
  assert.deepEqual(check('fraction', { num: 7, den: 12, simplest: true }, { text: '10/24' }), WRONG)
})

test('fraction: text that does not parse, or a response without text, is invalid', () => {
  const answer = { num: 3, den: 4 }
  for (const response of [...HOSTILE, {}, { text: '' }, { text: '3/0' }, { text: '0.75' }, { text: 3 }, { num: 3, den: 4 }]) {
    assert.deepEqual(check('fraction', answer, response), INVALID, JSON.stringify(response) ?? String(response))
  }
})

test('fraction: an answer without integer parts and a non-zero denominator is a content bug and throws', () => {
  for (const answer of [undefined, {}, { num: 3 }, { num: 3, den: 0 }, { num: 1.5, den: 2 }, { num: '3', den: 4 }]) {
    assert.throws(() => check('fraction', answer, { text: '3/4' }), TypeError)
  }
})
