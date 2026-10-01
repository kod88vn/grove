import { test } from 'node:test'
import assert from 'node:assert/strict'
import { check, getProblem, listProblems, render, toInstance } from '../../../index.js'

const ID = 'm5.oa.variables/factor-difference-of-squares'

test('the Grade 5 variable-expression item is registered without an unsupported standard claim', () => {
  assert.deepEqual(listProblems().filter(({ id }) => id === ID).map(({ grade, skill, widget }) => ({ grade, skill, widget })), [
    { grade: 5, skill: 'm5.oa.variables', widget: 'expression' },
  ])
  assert.deepEqual(getProblem(ID).skill, 'm5.oa.variables')
})

test('500 expression seeds remain playable and keep solutions private', () => {
  for (let seed = 1; seed <= 500; seed++) {
    const full = render(getProblem(ID), seed)
    const instance = toInstance(full)
    const response = { text: full.answer.expression }
    assert.equal(instance.widget, 'expression', `seed ${seed}`)
    assert.equal(instance.visual.kind, 'expression', `seed ${seed}`)
    assert.equal(Object.hasOwn(instance, 'answer'), false, `seed ${seed}`)
    assert.doesNotMatch(JSON.stringify(instance), /"answer"|"explanation"|"solution"/, `seed ${seed}`)
    assert.deepEqual(check('expression', full.answer, response), { correct: true, reason: null }, `seed ${seed}`)
    assert.deepEqual(check('expression', full.answer, { text: 'x^2' }), { correct: false, reason: 'wrong' }, `seed ${seed}`)
  }
})
