import { test } from 'node:test'
import assert from 'node:assert/strict'

import { check, getProblem, getSkill, getPath, listPaths, render } from './index.js'

const bossIds = [
  'm5.nf.add-fractions-unlike/fraction-boss',
  'm5.oa.variables/expression-boss',
  'm5.g.coordinate-plane/rectangle-boss',
]

test('every Grade 5 boss problem resolves from the public surface', () => {
  for (const id of bossIds) {
    const template = getProblem(id)
    assert.ok(template, `expected ${id} to be registered`)
    assert.equal(template.difficulty, 3)
    assert.equal(template.widget, 'steps')
  }
})

test('listPaths(5) returns the three Grade 5 paths with their chains', () => {
  const paths = listPaths(5)
  assert.deepEqual(
    paths.map((path) => path.id),
    ['fraction-forest', 'expression-express', 'shape-scout'],
  )

  const fraction = paths.find((path) => path.id === 'fraction-forest')
  assert.equal(fraction.grade, 5)
  assert.equal(fraction.terminal, 'm5.nf.add-fractions-unlike')
  assert.equal(fraction.bossProblemId, 'm5.nf.add-fractions-unlike/fraction-boss')
  // Chain: the terminal's prerequisite chain ends with the terminal skill.
  assert.equal(fraction.skills.at(-1), 'm5.nf.add-fractions-unlike')
  assert.ok(fraction.skills.includes('m5.nf.equiv-fractions'))

  const shape = paths.find((path) => path.id === 'shape-scout')
  assert.equal(shape.skills.at(-1), 'm5.g.coordinate-plane')
  assert.ok(shape.skills.includes('m5.nbt.place-value'))

  for (const path of paths) {
    for (const skillId of path.skills) {
      assert.equal(getProblem(path.bossProblemId) !== null, true, `boss of ${path.id} must exist`)
      assert.doesNotThrow(() => getSkillOrThrow(skillId))
    }
  }
})

function getSkillOrThrow(id) {
  const skill = getSkill(id)
  if (!skill) throw new Error(`unknown skill ${id}`)
  return skill
}

test('listPaths filters by grade; getPath resolves by id', () => {
  assert.deepEqual(listPaths(6), [])
  const all = listPaths()
  assert.equal(all.length, 3)
  assert.equal(getPath('fraction-forest').id, 'fraction-forest')
  assert.equal(getPath('nope'), null)
})

test('boss problems render and their own answers check correct', () => {
  for (const id of bossIds) {
    const template = getProblem(id)
    const rendered = render(template, 42)
    assert.equal(rendered.widget, 'steps')
    const verdict = check('steps', rendered.answer, { steps: rendered.answer.steps.map((step) => step.expression) })
    assert.equal(verdict.correct, true, `${id}: ${JSON.stringify(verdict)}`)
  }
})

test('a wrong step in a boss answer checks wrong, not invalid', () => {
  const template = getProblem('m5.oa.variables/expression-boss')
  const rendered = render(template, 7)
  const steps = rendered.answer.steps.map((step) => step.expression)
  const broken = [...steps]
  broken[2] = `${Number(broken[2]) + 1}`
  const verdict = check('steps', rendered.answer, { steps: broken })
  assert.equal(verdict.correct, false)
  assert.equal(verdict.reason, 'wrong')
})

test('a malformed steps response is invalid', () => {
  const template = getProblem('m5.oa.variables/expression-boss')
  const rendered = render(template, 7)
  const verdict = check('steps', rendered.answer, { steps: ['only-one-step'] })
  assert.equal(verdict.correct, false)
  assert.equal(verdict.reason, 'invalid')
})
