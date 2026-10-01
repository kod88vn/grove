import { test } from 'node:test'
import assert from 'node:assert/strict'
import { check, getProblem, listProblems, render, toInstance } from '../../../index.js'

const ID = 'm5.md.metric-units/convert-meters-to-centimeters'

test('meters-to-centimeters is registered as Grade 5 table-fill content', () => {
  assert.deepEqual(listProblems().filter(({ id }) => id === ID).map(({ id, skill, grade, widget }) => ({ id, skill, grade, widget })), [
    { id: ID, skill: 'm5.md.metric-units', grade: 5, widget: 'table-fill' },
  ])
});


test('500 seeds produce distinct, private answers for four independently checkable rows', () => {
  const distinctBoards = new Set()
  for (let seed = 1; seed <= 500; seed++) {
    const full = render(getProblem(ID), seed)
    const instance = toInstance(full)
    const rows = instance.visual.rows
    const ids = rows.map(({ id }) => id)
    const meters = rows.map(({ meters: value }) => value)
    assert.equal(full.widget, 'table-fill', `seed ${seed}`)
    assert.equal(rows.length, 4, `seed ${seed}`)
    assert.equal(new Set(ids).size, 4, `seed ${seed}`)
    assert.equal(new Set(meters).size, 4, `seed ${seed}`)
    assert.deepEqual(Object.keys(full.answer.cells).sort(), [...ids].sort(), `seed ${seed}`)
    assert.deepEqual(Object.keys(instance.visual).sort(), ['kind', 'rows'], `seed ${seed}`)
    assert.equal(Object.hasOwn(instance, 'answer'), false, `seed ${seed}`)
    assert.equal(JSON.stringify(instance).includes('explanation'), false, `seed ${seed}`)
    for (const { id, meters: value } of rows) {
      assert.ok(Number.isInteger(value) && value > 0, `seed ${seed}, ${id}`)
      assert.equal(full.answer.cells[id], value * 100, `seed ${seed}, ${id}`)
    }
    const response = { cells: Object.fromEntries(rows.map(({ id, meters: value }) => [id, String(value * 100)])) }
    assert.deepEqual(check('table-fill', full.answer, response), { correct: true, reason: null }, `seed ${seed}`)
    const wrong = { ...response.cells, [ids[0]]: String(full.answer.cells[ids[0]] + 100) }
    assert.deepEqual(check('table-fill', full.answer, { cells: wrong }), { correct: false, reason: 'wrong' }, `seed ${seed}`)
    distinctBoards.add(JSON.stringify(meters))
  }
  assert.ok(distinctBoards.size > 100)
})
