import { test } from 'node:test'
import assert from 'node:assert/strict'
import { check } from './check.js'

const RIGHT = { correct: true, reason: null }
const INVALID = { correct: false, reason: 'invalid' }

test('a nonzero scalar multiplying genuine factors is still a factored answer', () => {
  const answer = { grammar: 'polynomial', expression: '2*x^2-2', form: 'factored' }
  assert.deepEqual(check('expression', answer, { text: '2*(x-1)*(x+1)' }), RIGHT)
  assert.deepEqual(check('expression', answer, { text: '(x-1)*(x+1)*2' }), RIGHT)
})

test('a malformed or undefined child expression is invalid even if it fails the required form', () => {
  const answer = { grammar: 'polynomial', expression: 'x^2-1', form: 'factored' }
  assert.deepEqual(check('expression', answer, { text: '(x-1)*(x+1)+(1/(x-x))' }), INVALID)
  assert.deepEqual(check('expression', answer, { text: '(x-1)*(x+1)*(1/(x-x))' }), INVALID)
})

test('raising an undefined rational expression to the zeroth power does not make it valid', () => {
  assert.deepEqual(check('expression', { grammar: 'rational', expression: '1' }, { text: '(1/(x-x))^0' }), INVALID)
  assert.deepEqual(check('steps', { steps: [{ grammar: 'rational', expression: '1' }] }, { steps: ['(1/(x-x))^0'] }), INVALID)
})
