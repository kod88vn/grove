import { test } from 'node:test'
import assert from 'node:assert/strict'

import { check } from './check.js'

const INVALID = { correct: false, reason: 'invalid' }
const WRONG = { correct: false, reason: 'wrong' }
const answer = { grammar: 'polynomial', expression: 'x^2-1' }

test('malformed child syntax is invalid, not an authoring error', () => {
  assert.deepEqual(check('expression', answer, { text: 'sqrt(x)' }), INVALID)
})

test('malformed curriculum syntax and zero rational denominators throw', () => {
  assert.throws(() => check('expression', { grammar: 'polynomial', expression: 'sqrt(x)' }, { text: 'x' }), SyntaxError)
  assert.throws(() => check('expression', { grammar: 'rational', expression: '1/(x-x)' }, { text: 'x' }), /zero polynomial/)
})

test('ordered positions are distinct and every submitted expression is validated', () => {
  const steps = { steps: [answer, { grammar: 'polynomial', expression: 'x+1' }] }
  assert.deepEqual(check('steps', steps, { steps: ['x-1', 'x^2'] }), WRONG)
  assert.deepEqual(check('steps', steps, { steps: ['x^2', 'sqrt(x)'] }), INVALID)
})
