import { test } from 'node:test'
import assert from 'node:assert/strict'
import { check } from './check.js'

const INVALID = { correct: false, reason: 'invalid' }
const WRONG = { correct: false, reason: 'wrong' }

test('rejects expressions whose polynomial expansion exceeds a safe budget', () => {
  const text = Array.from({ length: 13 }, (_, index) => `(x${index}+1)`).join('*')
  const answer = { grammar: 'polynomial', expression: '1' }
  assert.deepEqual(check('expression', answer, { text }), INVALID)
  assert.deepEqual(check('steps', { steps: [answer] }, { steps: [text] }), INVALID)
})

test('zero raised to zero cannot be accepted as the expression one', () => {
  const answer = { grammar: 'rational', expression: '1' }
  assert.deepEqual(check('expression', answer, { text: '0^0' }), INVALID)
  assert.deepEqual(check('expression', answer, { text: '(x-x)^0' }), INVALID)
  assert.deepEqual(check('steps', { steps: [answer] }, { steps: ['(x-x)^0'] }), INVALID)
})

test('a grouped nonconstant quotient is not a genuine factored-form factor', () => {
  const answer = { grammar: 'rational', expression: '1', form: 'factored' }
  assert.deepEqual(check('expression', answer, { text: '(x/x)*(x/x)' }), WRONG)
})
