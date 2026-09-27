/**
 * P1.4 spec, second pass on `m5.oa.order-of-operations` — the expressions must be worth doing.
 *
 * `order-of-operations.test.js` proves the arithmetic and the shown working are right. It does
 * not stop the expression from being pointless, and two rendered seeds were:
 *
 *   difficulty 2, seed 1:  (1 - 1) × 20  =  0 × 20  =  0
 *   difficulty 1, seed 0:  3 + 1 × 2     =  3 + 2   =  5
 *
 * In the first, the bracket collapses to zero and the multiplication — the entire content of
 * the rung — evaluates itself. In the second the multiplication is by one. Both are correct
 * and both teach nothing, which is exactly the failure §9 cannot see by checking totals.
 *
 * The rule below is deliberately one line of reasoning rather than a second evaluator: every
 * value the working produces is written down as a literal in the very next step, so requiring
 * every number on every line to be at least 2 rules out a zero or a one appearing anywhere —
 * as an operand, as a bracket total, as a partial result, or as the answer.
 *
 * This tightens `order-of-operations.test.js` (operands 1..20, values 0..1000) rather than
 * contradicting it. That file stays as written; this one narrows the window.
 */
import { test } from 'node:test'
import assert from 'node:assert/strict'

import { templates } from './order-of-operations.js'
import { render } from '../../../engine/render.js'

const SEEDS = Array.from({ length: 500 }, (_, index) => index)
const NUMBER = /\d+/g

test('no line of working anywhere contains a zero or a one', () => {
  for (const template of templates) {
    for (const seed of SEEDS) {
      const problem = render(template, seed)
      for (const step of problem.visual.steps) {
        for (const token of step.match(NUMBER) ?? []) {
          const value = Number(token)
          assert.ok(
            value >= 2 && value <= 1000,
            `${template.id} @ ${seed}: ${value} in ${JSON.stringify(step)} makes the step pointless (working: ${problem.visual.steps.join(' = ')})`,
          )
        }
      }
      assert.ok(problem.answer.value >= 2, `${template.id} @ ${seed}: the answer is ${problem.answer.value}`)
    }
  }
})

// The same thing said about the expression itself, so it fails on the expression rather than
// three steps later if the working is ever shortened.
test('every number in the expression is at least two', () => {
  for (const template of templates) {
    for (const seed of SEEDS) {
      const { expression } = render(template, seed).visual
      for (const token of expression.match(NUMBER) ?? []) {
        assert.ok(Number(token) >= 2, `${template.id} @ ${seed}: ${token} in ${expression}`)
      }
    }
  }
})

// A bracket whose two sides are equal is the specific way difficulty 2 produced `(1 - 1)`.
// Stated separately because it stays true however the numbers are widened later.
test('a subtraction inside brackets never cancels to nothing', () => {
  for (const template of templates) {
    for (const seed of SEEDS) {
      const { expression, steps } = render(template, seed).visual
      for (const [left, right] of [...expression.matchAll(/\((\d+) - (\d+)\)/g)].map((match) => [match[1], match[2]])) {
        assert.notEqual(left, right, `${template.id} @ ${seed}: ${expression} cancels to zero (working: ${steps.join(' = ')})`)
      }
    }
  }
})
