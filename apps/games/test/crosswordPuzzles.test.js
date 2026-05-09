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

test('crossword numbering follows grid position and shares numbers across/down at same start', () => {
  const normalized = normalizeCrosswordPuzzle({
    title: 'Numbering',
    level: 'elementary',
    entries: [
      // Across at (0,0) and Down at (0,0) — must share number 1
      { id: 'A1', clue: 'a', answer: 'CAT', row: 0, col: 0, direction: 'across' },
      { id: 'D1', clue: 'd', answer: 'COW', row: 0, col: 0, direction: 'down' },
      // Down at (0,2) — next start by row-major order = 2
      { id: 'D2', clue: 'd2', answer: 'TOE', row: 0, col: 2, direction: 'down' },
      // Across at (2,0) — last start = 3
      { id: 'A3', clue: 'a3', answer: 'WOE', row: 2, col: 0, direction: 'across' },
    ],
  })
  const byId = Object.fromEntries(normalized.entries.map((e) => [e.id, e]))
  assert.equal(byId.A1.number, 1)
  assert.equal(byId.D1.number, 1, 'across+down at same start must share number')
  assert.equal(byId.D2.number, 2)
  assert.equal(byId.A3.number, 3)
})

test('generated crossword assigns shared numbers in row-major order', () => {
  for (const level of ['elementary', 'middleschool', 'highschool']) {
    const puzzle = pickCrosswordPuzzle(level, 0.31)
    // Every entry has a number.
    for (const entry of puzzle.entries) {
      assert.equal(typeof entry.number, 'number', `${level} ${entry.id} missing number`)
      assert.ok(entry.number >= 1)
    }
    // Entries with the same (row,col) start share the same number.
    const byStart = new Map()
    for (const entry of puzzle.entries) {
      const key = `${entry.row},${entry.col}`
      if (byStart.has(key)) {
        assert.equal(byStart.get(key), entry.number, `${level} shared start ${key} should share number`)
      } else {
        byStart.set(key, entry.number)
      }
    }
    // Numbers are 1..N where N = unique starts, ordered row-major.
    const starts = [...byStart.keys()]
      .map((k) => k.split(',').map(Number))
      .sort((a, b) => (a[0] - b[0]) || (a[1] - b[1]))
    starts.forEach(([r, c], idx) => {
      assert.equal(byStart.get(`${r},${c}`), idx + 1, `${level} numbering off at start ${r},${c}`)
    })
  }
})
