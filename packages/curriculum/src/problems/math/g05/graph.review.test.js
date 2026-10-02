import { test } from 'node:test'
import assert from 'node:assert/strict'
import { getProblem, render } from '../../../index.js'

test('negative parabola coefficients are explained with mathematical signs, not plus-negative text', () => {
  const template = getProblem('m5.oa.variables/graph-parabola')
  const problems = Array.from({ length: 50 }, (_, index) => render(template, index + 1))
  const withNegativeCoefficient = problems.filter(({ prompt }) => /-\s*\d/.test(prompt))
  assert.ok(withNegativeCoefficient.length > 0, 'some seeded graphs have negative coefficients')
  for (const problem of problems) {
    assert.doesNotMatch(problem.explanation, /\+\s*-\d/, `explanation for ${problem.prompt}`)
  }
})
