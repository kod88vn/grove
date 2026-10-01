import { test } from 'node:test'
import assert from 'node:assert/strict'
import { check, getProblem, listProblems, render, toInstance } from '../../../index.js'

const ID = 'm5.oa.order-of-operations/ordered-parentheses-steps'

test('the Grade 5 order-of-operations standard has an ordered-steps sample', () => {
  assert.deepEqual(listProblems().filter(({ id }) => id === ID).map(({ grade, skill, widget }) => ({ grade, skill, widget })), [
    { grade: 5, skill: 'm5.oa.order-of-operations', widget: 'steps' },
  ])
})

test('500 ordered-step seeds keep private expressions and check each expected position', () => {
  for (let seed = 1; seed <= 500; seed++) {
    const full = render(getProblem(ID), seed)
    const instance = toInstance(full)
    const responses = full.answer.steps.map(({ expression }) => expression)
    assert.equal(instance.widget, 'steps', `seed ${seed}`)
    assert.equal(instance.visual.items.length, full.answer.steps.length, `seed ${seed}`)
    assert.equal(Object.hasOwn(instance, 'answer'), false, `seed ${seed}`)
    assert.doesNotMatch(JSON.stringify(instance), /"answer"|"explanation"|"solution"/, `seed ${seed}`)
    assert.deepEqual(check('steps', full.answer, { steps: responses }), { correct: true, reason: null }, `seed ${seed}`)
    assert.deepEqual(check('steps', full.answer, { steps: [...responses].reverse() }), { correct: false, reason: 'wrong' }, `seed ${seed}`)
  }
})
