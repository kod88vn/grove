import test from 'node:test'
import assert from 'node:assert/strict'

import {
  GAME_SLUGS,
  chooseGomokuAIMove,
  coordKey,
  getGomokuWinner,
  isMiniSudokuSolved,
  MINI_SUDOKU_PUZZLE,
  pickHangmanRound,
} from '../src/index.js'

test('exports expected game slugs', () => {
  assert.equal(Array.isArray(GAME_SLUGS), true)
  assert.equal(GAME_SLUGS.includes('gomoku'), true)
})

test('provides deterministic hangman round from seed', () => {
  const round = pickHangmanRound(0)
  assert.equal(typeof round.word, 'string')
  assert.equal(typeof round.hint, 'string')
})

test('detects gomoku winner for five in a row', () => {
  const stones = {
    [coordKey(0, 0)]: 'human',
    [coordKey(1, 0)]: 'human',
    [coordKey(2, 0)]: 'human',
    [coordKey(3, 0)]: 'human',
    [coordKey(4, 0)]: 'human',
  }

  assert.equal(getGomokuWinner(stones), 'human')
})

test('returns center move for empty gomoku board', () => {
  assert.deepEqual(chooseGomokuAIMove({}), { x: 0, y: 0 })
})

test('validates solved mini sudoku board', () => {
  assert.equal(isMiniSudokuSolved(MINI_SUDOKU_PUZZLE.solution), true)
})
