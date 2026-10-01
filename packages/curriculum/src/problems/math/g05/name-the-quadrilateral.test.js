import { test } from 'node:test'
import assert from 'node:assert/strict'
import { check, getProblem, listProblems, render, toInstance } from '../../../index.js'

const ID = 'm5.g.classify-shapes/name-the-quadrilateral'
const NAMES = ['square', 'rectangle', 'rhombus', 'parallelogram']
const SHAPE_WORD = /\b(square|rectangle|rhombus|parallelogram|trapezoid|kite)s?\b/i
const MORE_GENERAL = {
  square: 'rectangle',
  rectangle: 'parallelogram',
  rhombus: 'parallelogram',
  parallelogram: 'quadrilateral',
}

function properties(text) {
  const pairs = /two pairs of parallel sides/i.test(text)
  const rightAngles = /(?<!not )four right angles/i.test(text)
  const equalSides = /(?<!not )all (four )?sides (are )?equal/i.test(text)
  return { pairs, rightAngles, equalSides }
}

test('a Grade 5 difficulty-two short-text sample is registered for the real gallery', () => {
  assert.deepEqual(listProblems().filter((entry) => entry.id === ID).map(({ widget, skill, grade, difficulty }) => ({ widget, skill, grade, difficulty })), [
    { widget: 'text', skill: 'm5.g.classify-shapes', grade: 5, difficulty: 2 },
  ])
})

test('500 seeds cover exactly four canonical figures and uniquely identify the most specific name by properties', () => {
  const seen = new Set()
  const clues = new Set()
  for (let seed = 1; seed <= 500; seed++) {
    const item = render(getProblem(ID), seed)
    const issued = toInstance(item)
    assert.equal(item.widget, 'text', `seed ${seed}`)
    assert.equal(item.difficulty, 2, `seed ${seed}`)
    assert.match(item.prompt, /most specific name/i, `seed ${seed}`)
    assert.equal(SHAPE_WORD.test(item.prompt), false, `seed ${seed}: prompt leaks a name`)
    assert.equal(SHAPE_WORD.test(JSON.stringify(item.visual)), false, `seed ${seed}: visual leaks a name`)
    for (const hint of item.hints) assert.equal(SHAPE_WORD.test(hint), false, `seed ${seed}: hint leaks a name`)
    const name = item.answer?.accept?.[0]
    assert.ok(NAMES.includes(name), `seed ${seed}: noncanonical ${name}`)
    assert.deepEqual(item.answer, { accept: [name, `a ${name}`] }, `seed ${seed}`)
    const shape = properties(item.prompt)
    assert.equal(shape.pairs, true, `seed ${seed}: missing parallel-side pairs`)
    assert.match(item.prompt, /right angles/i, `seed ${seed}: right-angle property unspecified`)
    assert.match(item.prompt, /all (four )?sides/i, `seed ${seed}: side-equality property unspecified`)
    if (!shape.rightAngles) assert.match(item.prompt, /(?:no|not four|without) right angles/i, `seed ${seed}: right-angle negation unspecified`)
    if (!shape.equalSides) assert.match(item.prompt, /(?:not all (four )?sides (are )?equal|all (four )?sides (are )?not equal)/i, `seed ${seed}: side-equality negation unspecified`)
    const expected = shape.rightAngles
      ? (shape.equalSides ? 'square' : 'rectangle')
      : (shape.equalSides ? 'rhombus' : 'parallelogram')
    assert.equal(name, expected, `seed ${seed}: incorrect most-specific classification`)
    assert.deepEqual(check('text', item.answer, { text: name }), { correct: true, reason: null }, `seed ${seed}`)
    assert.deepEqual(check('text', item.answer, { text: `A  ${name.toUpperCase()}` }), { correct: true, reason: null }, `seed ${seed}`)
    assert.deepEqual(check('text', item.answer, { text: MORE_GENERAL[name] }), { correct: false, reason: 'wrong' }, `seed ${seed}`)
    const envelope = JSON.stringify(issued)
    assert.equal(envelope.includes('"accept"'), false, `seed ${seed}: answer leaked`)
    assert.equal(envelope.includes('"answer"'), false, `seed ${seed}: answer leaked`)
    assert.equal(SHAPE_WORD.test(envelope), false, `seed ${seed}: public clue leaks name`)
    seen.add(name)
    clues.add(JSON.stringify(shape))
  }
  assert.deepEqual([...seen].sort(), [...NAMES].sort())
  assert.equal(clues.size, 4, 'the prompt must distinguish all four property combinations')
})

test('every explanation classifies this figure rather than claiming all members of a category share its properties', () => {
  for (let seed = 1; seed <= 500; seed++) {
    const item = render(getProblem(ID), seed)
    const name = item.answer.accept[0]
    assert.match(item.explanation, new RegExp(`^This figure is a ${name} because `), `seed ${seed}: explanation must describe this figure`)
  }
})
