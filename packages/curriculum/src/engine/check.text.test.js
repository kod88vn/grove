import { test } from 'node:test'
import assert from 'node:assert/strict'
import { check } from './check.js'

const RIGHT = { correct: true, reason: null }
const WRONG = { correct: false, reason: 'wrong' }
const INVALID = { correct: false, reason: 'invalid' }
const answer = { accept: ['square', 'a square'] }

test('closed text accept list shares cloze case and whitespace normalization', () => {
  for (const typed of ['square', ' SQUARE ', '\tA   SQUARE\n']) {
    assert.deepEqual(check('text', answer, { text: typed }), RIGHT, typed)
  }
  assert.deepEqual(check('text', { accept: ['  right    angle '] }, { text: 'Right angle' }), RIGHT)
})

test('nonempty alternate names, punctuation and diacritic differences are wrong, not invalid', () => {
  for (const typed of ['rectangle', 'parallelogram', 'square.', 'squaré', 'squares']) {
    assert.deepEqual(check('text', answer, { text: typed }), WRONG, typed)
  }
})

test('nonstring and empty text responses are invalid', () => {
  for (const response of [undefined, null, {}, [], { text: null }, { text: 7 }, { text: '' }, { text: ' \t ' }]) {
    assert.deepEqual(check('text', answer, response), INVALID, JSON.stringify(response))
  }
})

test('malformed accept lists throw TypeError before inspecting the response', () => {
  const unreadable = { get text() { throw new Error('response was accessed') } }
  for (const malformed of [undefined, null, {}, [], { accept: [] }, { accept: 'square' },
    { accept: [null] }, { accept: [''] }, { accept: ['  '] }, { accept: [,'square'] },
    { accept: ['square', 7] }]) {
    assert.throws(() => check('text', malformed, unreadable), TypeError, JSON.stringify(malformed))
  }
})

test('text checker leaves author answer and child response unchanged', () => {
  const authored = Object.freeze({ accept: Object.freeze(['square', 'a square']) })
  const response = Object.freeze({ text: '  A SQUARE  ' })
  assert.deepEqual(check('text', authored, response), RIGHT)
  assert.deepEqual(authored.accept, ['square', 'a square'])
  assert.equal(response.text, '  A SQUARE  ')
})
