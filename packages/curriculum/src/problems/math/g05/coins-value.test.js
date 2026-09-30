import { test } from 'node:test'
import assert from 'node:assert/strict'

import { check, getProblem, getSkill, listProblems, render, toInstance } from '../../../index.js'

const ID = 'm5.md.time-money/coins-value'
const SKILL = 'm5.md.time-money'
const DENOMINATIONS = [1, 5, 10, 25]

function makeCounts(target, offered) {
  const reachable = new Map([[0, {}]])
  for (let sum = 1; sum <= target; sum++) {
    for (const coin of offered) {
      if (reachable.has(sum - coin)) {
        const counts = { ...reachable.get(sum - coin) }
        counts[coin] = (counts[coin] ?? 0) + 1
        reachable.set(sum, counts)
        break
      }
    }
  }
  return reachable.get(target)
}

test('coins sample is catalogued on the existing off-grade time-money skill', () => {
  const skill = getSkill(SKILL)
  assert.equal(skill.legacyId, 'time-money')
  assert.deepEqual(skill.ccss, [])
  assert.ok(getProblem(ID))
  assert.equal(listProblems().find((row) => row.id === ID)?.widget, 'coins')
})

test('500 sample seeds have reachable, displayed cent targets without shipping an answer', () => {
  for (let seed = 1; seed <= 500; seed++) {
    const problem = render(getProblem(ID), seed)
    assert.equal(problem.widget, 'coins', `seed ${seed}`)
    assert.ok(Number.isInteger(problem.answer.total) && problem.answer.total > 0 && problem.answer.total <= 99)
    assert.match(problem.prompt, new RegExp(`\\b${problem.answer.total}¢`), `seed ${seed}`)
    assert.deepEqual(problem.visual, {
      kind: 'coins', target: problem.answer.total, denominations: problem.answer.denominations,
    })
    assert.ok(problem.answer.denominations.length > 0)
    assert.ok(problem.answer.denominations.every((coin) => DENOMINATIONS.includes(coin)))
    const counts = makeCounts(problem.answer.total, problem.answer.denominations)
    assert.ok(counts, `seed ${seed}: the target must be achievable with offered coins`)
    assert.deepEqual(check('coins', problem.answer, { counts }), { correct: true, reason: null })
    assert.deepEqual(check('coins', problem.answer, { counts: {} }), { correct: false, reason: 'wrong' })
    assert.ok(problem.hints.length >= 2)
    assert.ok(problem.explanation.includes(`${problem.answer.total}¢`))
    const client = toInstance(problem)
    assert.equal(Object.hasOwn(client, 'answer'), false)
    assert.equal(Object.hasOwn(client, 'hints'), false)
    assert.equal(Object.hasOwn(client, 'explanation'), false)
    assert.deepEqual(client.visual, problem.visual)
  }
})
