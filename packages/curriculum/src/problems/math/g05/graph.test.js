import { test } from 'node:test'
import assert from 'node:assert/strict'
import { check, getProblem, getSkill, listProblems, render, toInstance } from '../../../index.js'

const CASES = [
  ['m5.g.coordinate-plane/plot-point', 'm5.g.coordinate-plane', 'point'],
  ['m5.oa.variables/graph-line', 'm5.oa.variables', 'line'],
  ['m5.oa.variables/graph-parabola', 'm5.oa.variables', 'parabola'],
]
const verdict = (correct, reason) => ({ correct, reason })

test('graph templates use the intended existing grade-five skills', () => {
  for (const [id, skill, mode] of CASES) {
    const template = getProblem(id)
    assert.ok(template, `${id} is registered`)
    const listed = listProblems().find((problem) => problem.id === id)
    assert.equal(listed.skill, skill)
    assert.equal(listed.widget, 'graph')
    assert.equal(template.widget, 'graph')
    assert.equal(render(template, 2505).visual.mode, mode)
  }
  assert.deepEqual(getSkill('m5.oa.variables').ccss, [])
  assert.deepEqual(getSkill('m5.g.coordinate-plane').ccss, ['5.G.A.1', '5.G.A.2'])
})

test('500 seeds per graph mode stay private, in bounds, varied, and grade through geometry', () => {
  for (const [id, skill, mode] of CASES) {
    const answers = new Set()
    const count = { point: 1, line: 2, parabola: 3 }[mode]
    for (let seed = 1; seed <= 500; seed++) {
      const full = render(getProblem(id), seed)
      const instance = toInstance(full)
      assert.equal(full.skill, skill, `${id}@${seed}`)
      assert.deepEqual(instance.visual, {
        kind: 'graph', mode,
        xMin: full.visual.xMin, xMax: full.visual.xMax,
        yMin: full.visual.yMin, yMax: full.visual.yMax,
      }, `${id}@${seed}`)
      assert.equal(full.answer.points.length, count, `${id}@${seed}`)
      assert.equal(new Set(full.answer.points.map(({ x }) => x)).size, count, `${id}@${seed}`)
      for (const point of full.answer.points) {
        assert.ok(point.x >= full.answer.bound.xMin && point.x <= full.answer.bound.xMax, `${id}@${seed}`)
        assert.ok(point.y >= full.answer.bound.yMin && point.y <= full.answer.bound.yMax, `${id}@${seed}`)
      }
      assert.doesNotMatch(JSON.stringify(instance), /"(?:answer|hints|explanation|points|tolerance|bound)"\s*:/, `${id}@${seed}`)
      assert.deepEqual(render(getProblem(id), seed), full, `${id}@${seed} is stable`)
      assert.deepEqual(check('graph', full.answer, { points: full.answer.points }), verdict(true, null), `${id}@${seed}`)

      const moved = full.answer.points.map((point, index) => index === count - 1
        ? { ...point, y: point.y + (point.y + 1 <= full.answer.bound.yMax ? 1 : -1) }
        : point)
      assert.deepEqual(check('graph', full.answer, { points: moved }), verdict(false, 'wrong'), `${id}@${seed}`)
      answers.add(JSON.stringify(full.answer.points))
    }
    assert.ok(answers.size > 20, `${id} only produced ${answers.size} distinct point sets`)
  }
})
