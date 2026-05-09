import test from 'node:test'
import assert from 'node:assert/strict'

import {
  CROSSWORD_LEVELS,
  CROSSWORD_PUZZLES,
  normalizeCrosswordPuzzle,
  pickCrosswordPuzzle,
  scoreCrosswordAnswers,
} from '../src/index.js'

test('crossword puzzle bank provides all required levels', () => {
  assert.deepEqual(CROSSWORD_LEVELS, ['elementary', 'middleschool', 'highschool'])
  for (const level of CROSSWORD_LEVELS) {
    assert.equal(Array.isArray(CROSSWORD_PUZZLES[level]), true)
    assert.equal(CROSSWORD_PUZZLES[level].length >= 2, true)
  }
})

test('crossword puzzle picking is deterministic per level and seed', () => {
  const puzzleA = pickCrosswordPuzzle('elementary', 0.25)
  const puzzleB = pickCrosswordPuzzle('elementary', 0.25)
  const puzzleC = pickCrosswordPuzzle('middleschool', 0.25)
  assert.deepEqual(puzzleA, puzzleB)
  assert.notDeepEqual(puzzleA.title, '')
  assert.equal(puzzleC.level, 'middleschool')
})

test('crossword puzzle picking falls back safely to elementary', () => {
  const fallback = pickCrosswordPuzzle('unknown-level', 0.1)
  assert.equal(fallback.level, 'elementary')
})

test('crossword scoring uses the provided puzzle', () => {
  const puzzle = pickCrosswordPuzzle('highschool', 0.1)
  const answers = Object.fromEntries(puzzle.entries.map((entry) => [entry.id, entry.answer]))
  const result = scoreCrosswordAnswers(answers, puzzle)
  assert.deepEqual(result, {
    total: puzzle.entries.length,
    correct: puzzle.entries.length,
    solved: true,
  })
})

test('crossword normalization builds dimensions and grid from entries', () => {
  const normalized = normalizeCrosswordPuzzle({
    title: 'Tiny Test',
    level: 'elementary',
    entries: [
      { id: '1A', clue: 'Farm sound', answer: 'MOO', row: 0, col: 0, direction: 'across' },
      { id: '1D', clue: 'Night bird', answer: 'OWL', row: 0, col: 1, direction: 'down' },
    ],
  })
  assert.deepEqual(normalized.dimensions, { rows: 3, cols: 3 })
  assert.equal(normalized.grid[0][0], 'M')
  assert.equal(normalized.grid[0][1], 'O')
  assert.equal(normalized.grid[1][1], 'W')
})

test('crossword normalization rejects conflicting intersections', () => {
  const badPuzzle = {
    level: 'elementary',
    entries: [
      { id: '1', answer: 'CAT', row: 0, col: 0, direction: 'across' },
      { id: '2', answer: 'DOG', row: 0, col: 0, direction: 'down' },
    ],
  }
  assert.throws(() => normalizeCrosswordPuzzle(badPuzzle), { message: /crossword_conflict/ })
})

test('crossword normalization handles case and empty clues', () => {
  const normalized = normalizeCrosswordPuzzle({
    entries: [
      { id: '1', answer: 'ice', row: 0, col: 0, direction: 'across' },
      { id: '2', answer: 'ink', row: 0, col: 0, direction: 'down' },
    ],
  })
  assert.equal(normalized.entries[0].answer, 'ICE')
  assert.equal(normalized.entries[1].answer, 'INK')
  assert.equal(normalized.entries[0].clue, '')
})

test('crossword scoring handles partial correct answers', () => {
  const puzzle = {
    entries: [
      { id: '1', answer: 'TEST', row: 0, col: 0, direction: 'across' },
      { id: '2', answer: 'GRID', row: 1, col: 0, direction: 'across' },
    ],
  }
  const partial = { '1': 'TEST', '2': 'WRONG' }
  const result = scoreCrosswordAnswers(partial, puzzle)
  assert.equal(result.correct, 1)
  assert.equal(result.total, 2)
  assert.equal(result.solved, false)
})

test('pickCrosswordPuzzle returns dense puzzles per level', () => {
  const minByLevel = { elementary: 8, middleschool: 10, highschool: 12 }
  for (const [level, min] of Object.entries(minByLevel)) {
    const puzzle = pickCrosswordPuzzle(level, 0.42)
    assert.ok(
      puzzle.entries.length >= min,
      `${level} produced only ${puzzle.entries.length} entries (expected >= ${min})`,
    )
    // Every entry must intersect at least one other entry.
    const cellOwners = new Map()
    for (const entry of puzzle.entries) {
      for (let k = 0; k < entry.answer.length; k += 1) {
        const r = entry.row + (entry.direction === 'down' ? k : 0)
        const c = entry.col + (entry.direction === 'across' ? k : 0)
        const key = `${r},${c}`
        if (!cellOwners.has(key)) cellOwners.set(key, new Set())
        cellOwners.get(key).add(entry.id)
      }
    }
    const intersected = new Set()
    for (const owners of cellOwners.values()) {
      if (owners.size > 1) for (const id of owners) intersected.add(id)
    }
    for (const entry of puzzle.entries) {
      assert.ok(intersected.has(entry.id), `${level} entry ${entry.id} (${entry.answer}) does not intersect`)
    }
  }
})


