import { test } from 'node:test'
import assert from 'node:assert/strict'

import { equivalentExpression, hasFactoredForm } from './symbolic.js'

test('polynomial equivalence is exact for every rational coefficient', () => {
  assert.equal(equivalentExpression('polynomial', 'x^2 - 1', '(x-1)*(x+1)'), true)
  assert.equal(equivalentExpression('polynomial', 'x', '1/2*x + 1/2*x'), true)
  assert.equal(equivalentExpression('polynomial', 'x/2', '1/2*x'), true)
  assert.equal(equivalentExpression('polynomial', '0', '(x-1)*(x-2)*(x-3)*(x-4)*(x-5)'), false)
})

test('rational-function equivalence cross-multiplies and rejects zero denominators', () => {
  assert.equal(equivalentExpression('rational', '(x^2-1)/(x-1)', 'x+1'), true)
  assert.equal(equivalentExpression('rational', 'x^-1', '1/x'), true)
  assert.throws(() => equivalentExpression('rational', 'x+1', '0/(x-x)'), /zero polynomial/)
})

test('only an actual product of grouped factors satisfies factored form', () => {
  assert.equal(hasFactoredForm('(x-1)*(x+1)'), true)
  assert.equal(hasFactoredForm('x^2-1'), false)
  assert.equal(hasFactoredForm('(x^2-1)'), false)
})

test('the documented grammar rejects unsupported or malformed authored expressions', () => {
  assert.throws(() => equivalentExpression('polynomial', 'sqrt(x)', 'x'), SyntaxError)
  assert.throws(() => equivalentExpression('sampled', 'x', 'x'), TypeError)
  assert.throws(() => equivalentExpression('polynomial', 'x', 'x/y'), SyntaxError)
})
