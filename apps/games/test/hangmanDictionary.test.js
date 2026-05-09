import test from 'node:test'
import assert from 'node:assert/strict'

import {
  HANGMAN_DICTIONARY,
  HANGMAN_LEVELS,
  pickHangmanRound,
} from '../src/index.js'

test('hangman dictionary provides all required school levels', () => {
  assert.deepEqual(HANGMAN_LEVELS, ['elementary', 'middleschool', 'highschool'])

  for (const level of HANGMAN_LEVELS) {
    assert.equal(Array.isArray(HANGMAN_DICTIONARY[level]), true)
    assert.equal(HANGMAN_DICTIONARY[level].length >= 10, true)
  }
})

test('hangman rounds are deterministic per level and seed', () => {
  const elementaryRoundA = pickHangmanRound('elementary', 0.42)
  const elementaryRoundB = pickHangmanRound('elementary', 0.42)
  assert.deepEqual(elementaryRoundA, elementaryRoundB)

  const middleRoundA = pickHangmanRound('middleschool', 0.73)
  const middleRoundB = pickHangmanRound('middleschool', 0.73)
  assert.deepEqual(middleRoundA, middleRoundB)
})

test('hangman rounds are level-appropriate and fallback safely', () => {
  const elementaryWords = new Set(HANGMAN_DICTIONARY.elementary.map((entry) => entry.word))
  const middleWords = new Set(HANGMAN_DICTIONARY.middleschool.map((entry) => entry.word))
  const highWords = new Set(HANGMAN_DICTIONARY.highschool.map((entry) => entry.word))

  const elementaryRound = pickHangmanRound('elementary', 0.1)
  const middleRound = pickHangmanRound('middleschool', 0.1)
  const highRound = pickHangmanRound('highschool', 0.1)
  const fallbackRound = pickHangmanRound('unknown-level', 0.1)

  assert.equal(elementaryWords.has(elementaryRound.word), true)
  assert.equal(middleWords.has(middleRound.word), true)
  assert.equal(highWords.has(highRound.word), true)
  assert.equal(elementaryWords.has(fallbackRound.word), true)
})
