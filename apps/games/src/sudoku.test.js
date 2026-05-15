import test from 'node:test'
import assert from 'node:assert/strict'

import {
  SUDOKU_LEVELS,
  SUDOKU_SIZES,
  cloneMiniSudokuBoard,
  generateSudokuForLevel,
  getSudokuBlockDims,
  isMiniSudokuPlacementValid,
  isMiniSudokuSolved,
  pickSudokuPuzzle,
} from '../src/index.js'
import { generateSudokuPuzzle } from '../src/sudoku.js'

function countBlanks(board) {
  let n = 0
  for (const row of board) for (const v of row) if (v === 0) n += 1
  return n
}

test('sudoku block dims match standard sizes', () => {
  assert.deepEqual(getSudokuBlockDims(4), { blockRows: 2, blockCols: 2 })
  assert.deepEqual(getSudokuBlockDims(6), { blockRows: 2, blockCols: 3 })
  assert.deepEqual(getSudokuBlockDims(9), { blockRows: 3, blockCols: 3 })
  assert.throws(() => getSudokuBlockDims(5))
})

test('generated sudoku solution is valid for every supported size', () => {
  for (const size of [4, 6, 9]) {
    const { solution } = generateSudokuPuzzle(size, 0, 0.42)
    assert.equal(solution.length, size)
    assert.equal(isMiniSudokuSolved(solution), true, `size ${size} solution must be valid`)
  }
})

test('generated sudoku board contains the requested number of blanks (small grids)', () => {
  for (const size of [4, 6]) {
    const removals = size === 4 ? 6 : 14
    const { board } = generateSudokuPuzzle(size, removals, 0.31)
    assert.equal(countBlanks(board), removals, `size ${size} blank count`)
  }
})

test('pickSudokuPuzzle scales grid size by level', () => {
  for (const level of SUDOKU_LEVELS) {
    const puzzle = pickSudokuPuzzle(level, 0.27)
    assert.equal(puzzle.size, SUDOKU_SIZES[level])
    assert.equal(puzzle.board.length, puzzle.size)
    assert.equal(puzzle.solution.length, puzzle.size)
    assert.equal(isMiniSudokuSolved(puzzle.solution), true)
  }
})

test('pickSudokuPuzzle is deterministic per level + seed', () => {
  const a = pickSudokuPuzzle('middleschool', 0.5)
  const b = pickSudokuPuzzle('middleschool', 0.5)
  assert.deepEqual(a.board, b.board)
  assert.deepEqual(a.solution, b.solution)
})

test('isMiniSudokuPlacementValid handles 6x6 row/col/block conflicts', () => {
  const { solution } = generateSudokuForLevel('middleschool', 0.11)
  const board = cloneMiniSudokuBoard(solution)
  const original = board[2][2]
  board[2][2] = 0
  assert.equal(isMiniSudokuPlacementValid(board, 2, 2, original), true)
  // Any other value already exists in row, column, or block — must be rejected.
  for (let v = 1; v <= 6; v += 1) {
    if (v === original) continue
    assert.equal(isMiniSudokuPlacementValid(board, 2, 2, v), false, `value ${v} should conflict`)
  }
})

test('isMiniSudokuPlacementValid rejects values out of range for the grid size', () => {
  const board = generateSudokuForLevel('elementary', 0.1).board
  assert.equal(isMiniSudokuPlacementValid(board, 0, 0, 5), false)
  assert.equal(isMiniSudokuPlacementValid(board, 0, 0, 0), false)
})
