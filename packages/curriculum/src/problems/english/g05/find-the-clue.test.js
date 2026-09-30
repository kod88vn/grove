import { test } from 'node:test'
import assert from 'node:assert/strict'
import { items } from '../../../content/english/items/g05/context-clues.js'
import { check, getProblem, listProblems, render, toInstance } from '../../../index.js'

const ID = 'e5.l.context-clues/find-the-clue'
const seeds = Array.from({ length: 500 }, (_, index) => index + 1)
const normal = (text) => text.toLowerCase().replace(/^[^\p{L}\p{N}]+|[^\p{L}\p{N}]+$/gu, '')
const words = (text) => text.split(/\s+/).map(normal).filter(Boolean)
const blankIndex = (text) => {
  const parts = text.split(/\s+/)
  const blank = parts.findIndex((part) => part.includes('____'))
  assert.ok(blank >= 0, `no visible blank in: ${text}`)
  return parts.slice(0, blank).map(normal).filter(Boolean).length
}

function oracle(sentence, clue) {
  const sentenceWords = words(sentence)
  const clueWords = words(clue)
  const starts = sentenceWords.flatMap((word, index) => clueWords.every((clueWord, offset) => sentenceWords[index + offset] === clueWord) ? [index] : [])
  assert.equal(starts.length, 1, `the existing clue must have exactly one contiguous run: ${clue}`)
  return Array.from({ length: clueWords.length }, (_, index) => starts[0] + index)
}

test('existing content requires no named exclusions: all twenty clues are unique consecutive runs', () => {
  assert.equal(items.length, 20)
  for (const item of items) assert.ok(oracle(item.sentence, item.clue).length > 0, item.id)
  assert.ok(items.every((item) => item.reviewedBy === 'agent-draft:pending-parent-review'))
})

test('a real registered Grade 5 English problem uses the existing skill without new catalog keys', () => {
  const listed = listProblems().filter((row) => row.id === ID)
  assert.equal(listed.length, 1)
  assert.equal(listed[0].skill, 'e5.l.context-clues')
  assert.equal(listed[0].grade, 5)
  assert.equal(listed[0].subject, 'english')
  assert.equal(listed[0].widget, 'tap-select')
  assert.ok(getProblem(ID))
})

test('500 seeds derive exactly the existing clue, no answer metadata or hint leak', () => {
  const seen = new Set()
  let lowestIdPrediction = 0
  let firstPositionPrediction = 0
  for (const seed of seeds) {
    const full = render(getProblem(ID), seed)
    assert.equal(full.widget, 'tap-select', `seed ${seed}`)
    assert.equal(full.visual.kind, 'tap-select', `seed ${seed}`)
    assert.ok(Array.isArray(full.visual.tokens), `seed ${seed}`)
    const tokens = full.visual.tokens
    assert.ok(tokens.length > 3, `seed ${seed}: too few tokens`)
    assert.ok(tokens.every((token) => /[\p{L}\p{N}]/u.test(token.label)), `seed ${seed}: empty selectable word`)
    const source = items.find((item) => words(item.sentence).join(' ') === tokens.map((token) => normal(token.label)).join(' '))
    assert.ok(source, `seed ${seed}: invented or altered content`)
    seen.add(source.id)
    assert.equal(full.visual.blankIndex, blankIndex(source.sentence), `seed ${seed}: blank moved or hidden`)
    assert.ok(full.visual.blankIndex >= 0 && full.visual.blankIndex <= tokens.length, `seed ${seed}: blank outside sentence`)
    const expected = oracle(source.sentence, source.clue)
    assert.ok(expected.length > 0 && tokens.length - expected.length >= 3, `seed ${seed}: no meaningful distractors`)
    assert.ok(tokens.every((token) => Object.keys(token).sort().join(',') === 'id,label'), `seed ${seed}: answer marker in token`)
    const ids = tokens.map((token) => token.id)
    assert.equal(new Set(ids).size, ids.length, `seed ${seed}: duplicate public IDs`)
    assert.ok(ids.every((id) => /^token-[a-z0-9]+$/i.test(id)), `seed ${seed}: IDs are not opaque tokens`)
    assert.deepEqual(new Set(full.answer.ids), new Set(expected.map((index) => ids[index])), `seed ${seed}: wrong clue run`)
    assert.deepEqual(new Set(full.answer.availableIds), new Set(ids), `seed ${seed}: checker not bound to issued tokens`)
    const instance = toInstance(full)
    assert.deepEqual(instance.visual, full.visual, `seed ${seed}: token payload lost across allowlist`)
    assert.equal(Object.hasOwn(instance, 'answer'), false)
    assert.equal(JSON.stringify(instance).includes(source.clue), false, `seed ${seed}: standalone clue leaked in payload`)
    assert.ok(full.prompt && !full.prompt.toLowerCase().includes(source.clue.toLowerCase()), `seed ${seed}: prompt reveals clue`)
    assert.ok(!full.prompt.toLowerCase().includes(source.answer.toLowerCase()), `seed ${seed}: prompt reveals cloze answer`)
    for (const hint of full.hints) {
      assert.ok(!hint.toLowerCase().includes(source.clue.toLowerCase()), `seed ${seed}: hint reveals clue`)
      assert.ok(!hint.toLowerCase().includes(source.answer.toLowerCase()), `seed ${seed}: hint reveals cloze answer`)
    }
    const selected = [...full.answer.ids].reverse()
    assert.deepEqual(check('tap-select', full.answer, { ids: selected }), { correct: true, reason: null }, `seed ${seed}`)
    assert.deepEqual(check('tap-select', full.answer, { ids: [ids.find((id) => !selected.includes(id))] }), { correct: false, reason: 'invalid' }, `seed ${seed}`)
    if (expected.includes(0)) firstPositionPrediction++
    const sorted = [...ids].sort()
    if (sorted.slice(0, expected.length).every((id) => full.answer.ids.includes(id))) lowestIdPrediction++
  }
  assert.deepEqual(seen, new Set(items.map((item) => item.id)), 'not every bank item was exercised')
  assert.ok(firstPositionPrediction < seeds.length * 0.7, 'first position reveals the clue')
  assert.ok(lowestIdPrediction < seeds.length * 0.2, 'ID ordering reveals the clue')
})
