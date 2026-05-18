import { generateCrossword } from './crosswordGenerator.js'
import {
  SUDOKU_SIZES,
  generateSudokuForLevel,
  getSudokuBlockDims,
} from './sudoku.js'

export { SUDOKU_SIZES, generateSudokuForLevel, getSudokuBlockDims }

export const GAME_SLUGS = [
  'crossword',
  'hangman',
  'sudoku',
  'gomoku',
  'math-lightning',
  'word-scramble',
  'memory-match',
  'logic-code',
]

export const HANGMAN_LEVELS = ['elementary', 'middleschool', 'highschool']
export const SCRAMBLE_LEVELS = ['elementary', 'middleschool', 'highschool']
export {
  GOMOKU_DIFFICULTY_LEVELS,
  GOMOKU_AI_CONFIGS,
  chooseGomokuAIMove,
  coordKey,
  isGomokuMoveLegal as isGomokuMoveLegal,
  getGomokuWinner as getGomokuWinner,
  getCandidateMoves as getCandidateMoves,
} from './gomokuAI.js'

// Legacy alias for backward compatibility with GomokuGame.js imports
export { chooseGomokuAIMove as chooseGomokuAIMoveExpert } from './gomokuAI.js'

export function resolveHangmanLevel(value) {
  if (HANGMAN_LEVELS.includes(value)) return value
  return 'elementary'
}

export function resolveScrambleLevel(value) {
  if (SCRAMBLE_LEVELS.includes(value)) return value
  return 'elementary'
}

export const HANGMAN_DICTIONARY = {
  elementary: [
    { word: 'APPLE', hint: 'A red or green fruit.', mascot: '🍎' },
    { word: 'BUNNY', hint: 'A soft animal with long ears.', mascot: '🐰' },
    { word: 'CANDY', hint: 'A sweet treat.', mascot: '🍬' },
    { word: 'DOLPHIN', hint: 'A smart animal that swims.', mascot: '🐬' },
    { word: 'GARDEN', hint: 'A place where flowers grow.', mascot: '🌷' },
    { word: 'JACKET', hint: 'You wear this when it is cold.', mascot: '🧥' },
    { word: 'KITTEN', hint: 'A baby cat.', mascot: '🐱' },
    { word: 'MONKEY', hint: 'A playful animal that climbs.', mascot: '🐒' },
    { word: 'PENCIL', hint: 'Used for writing and drawing.', mascot: '✏️' },
    { word: 'RAINBOW', hint: 'Seven colors after rain.', mascot: '🌈' },
    { word: 'SCHOOL', hint: 'Where students learn.', mascot: '🏫' },
    { word: 'SUNSHINE', hint: 'Bright light from the sun.', mascot: '☀️' },
    { word: 'TURTLE', hint: 'An animal with a shell.', mascot: '🐢' },
    { word: 'WINDOW', hint: 'You look outside through it.', mascot: '🪟' },
    { word: 'ZEBRA', hint: 'An animal with black and white stripes.', mascot: '🦓' },
  ],
  middleschool: [
    { word: 'ALGEBRA', hint: 'Math with letters and equations.', mascot: '➕' },
    { word: 'ASTEROID', hint: 'A rocky object in space.', mascot: '☄️' },
    { word: 'BIOLOGY', hint: 'The study of living things.', mascot: '🧬' },
    { word: 'CIRCUIT', hint: 'A path for electricity.', mascot: '🔌' },
    { word: 'COMPASS', hint: 'A tool that points north.', mascot: '🧭' },
    { word: 'ECOSYSTEM', hint: 'Living things and their environment.', mascot: '🌿' },
    { word: 'FRACTION', hint: 'Part of a whole in math.', mascot: '📐' },
    { word: 'GALAXY', hint: 'A huge system of stars.', mascot: '🌌' },
    { word: 'HARMONY', hint: 'Notes sounding good together.', mascot: '🎵' },
    { word: 'JOURNAL', hint: 'A notebook for daily writing.', mascot: '📓' },
    { word: 'KINGDOM', hint: 'A group category in biology.', mascot: '👑' },
    { word: 'MAGNETIC', hint: 'Related to attraction by magnets.', mascot: '🧲' },
    { word: 'PYRAMID', hint: 'An ancient triangular monument.', mascot: '△' },
    { word: 'VOLCANO', hint: 'A mountain that can erupt.', mascot: '🌋' },
    { word: 'WEATHER', hint: 'Daily conditions like rain or sun.', mascot: '⛅' },
  ],
  highschool: [
    { word: 'ACCELERATION', hint: 'Rate of change in velocity.', mascot: '🚗' },
    { word: 'ANTITHESIS', hint: 'Direct contrast of ideas.', mascot: '⚖️' },
    { word: 'CALCULUS', hint: 'Math focused on change and limits.', mascot: '∫' },
    { word: 'CATALYST', hint: 'Speeds a reaction without being consumed.', mascot: '⚗️' },
    { word: 'CONSTITUTION', hint: 'Foundational legal framework of a state.', mascot: '📜' },
    { word: 'DERIVATIVE', hint: 'Instantaneous rate of change.', mascot: '📈' },
    { word: 'EQUILIBRIUM', hint: 'Balanced state in chemistry or physics.', mascot: '🧪' },
    { word: 'HYPOTHESIS', hint: 'A testable scientific explanation.', mascot: '🔬' },
    { word: 'ISOTOPE', hint: 'Atoms with same protons, different neutrons.', mascot: '⚛️' },
    { word: 'LITERATURE', hint: 'Written works studied in language arts.', mascot: '📚' },
    { word: 'PHOTOSYNTHESIS', hint: 'Plants convert light into energy.', mascot: '🌱' },
    { word: 'PROBABILITY', hint: 'Likelihood of an event.', mascot: '🎲' },
    { word: 'RHETORICAL', hint: 'Related to persuasive speaking and writing.', mascot: '🗣️' },
    { word: 'STOICHIOMETRY', hint: 'Quantitative relationships in reactions.', mascot: '🧫' },
    { word: 'TRIGONOMETRY', hint: 'Math of triangle ratios.', mascot: '📏' },
  ],
}

export function pickHangmanRound(levelOrSeed = 'elementary', maybeSeed = Math.random()) {
  const level = typeof levelOrSeed === 'number' ? 'elementary' : resolveHangmanLevel(levelOrSeed)
  const seed = typeof levelOrSeed === 'number' ? levelOrSeed : maybeSeed
  const rounds = HANGMAN_DICTIONARY[level]
  const index = Math.floor(Math.abs(seed) * rounds.length) % rounds.length
  return rounds[index]
}

export function pickScrambleRound(levelOrSeed = 'elementary', maybeSeed = Math.random()) {
  const level = typeof levelOrSeed === 'number' ? 'elementary' : resolveScrambleLevel(levelOrSeed)
  const seed = typeof levelOrSeed === 'number' ? levelOrSeed : maybeSeed
  const words = HANGMAN_DICTIONARY[level]
  const index = Math.floor(Math.abs(seed) * words.length) % words.length
  return words[index]
}

export const CROSSWORD_LEVELS = ['elementary', 'middleschool', 'highschool']

const RAW_CROSSWORD_PUZZLES = {
  elementary: [
    {
      title: 'Mini Giggle Crossword',
      entries: [
        { id: '1', clue: 'A common pet that purrs', answer: 'CAT', row: 0, col: 0, direction: 'across' },
        { id: '2', clue: 'Animal that barks', answer: 'DOG', row: 2, col: 0, direction: 'across' },
        { id: '3', clue: 'Type of fish', answer: 'COD', row: 0, col: 0, direction: 'down' },
        { id: '4', clue: 'A game tag phrase', answer: 'TAG', row: 0, col: 2, direction: 'down' },
      ],
    },
    {
      title: 'Forest Friends',
      entries: [
        { id: '1', clue: 'Light from the day sky', answer: 'SUN', row: 0, col: 0, direction: 'across' },
        { id: '2', clue: 'Paper drawing guide', answer: 'MAP', row: 2, col: 0, direction: 'across' },
        { id: '3', clue: 'Total from adding', answer: 'SUM', row: 0, col: 0, direction: 'down' },
        { id: '4', clue: 'Quick nap at school desk', answer: 'NAP', row: 0, col: 2, direction: 'down' },
      ],
    },
  ],
  middleschool: [
    {
      title: 'Galactic Grid',
      entries: [
        { id: '1', clue: 'A huge system of stars', answer: 'GALAXY', row: 0, col: 0, direction: 'across' },
        { id: '2', clue: 'A bright stellar explosion', answer: 'NOVA', row: 2, col: 0, direction: 'across' },
        { id: '3', clue: 'Tiny inherited unit', answer: 'GENE', row: 0, col: 0, direction: 'down' },
        { id: '4', clue: 'Tool for balance', answer: 'LEVER', row: 0, col: 2, direction: 'down' },
      ],
    },
    {
      title: 'Ocean Deep',
      entries: [
        { id: '1', clue: 'Large marine mammal', answer: 'WHALE', row: 0, col: 0, direction: 'across' },
        { id: '2', clue: 'A strong inner drive', answer: 'NERVE', row: 2, col: 0, direction: 'across' },
        { id: '3', clue: 'Moving air', answer: 'WIND', row: 0, col: 0, direction: 'down' },
        { id: '4', clue: 'Aircraft wing support shape', answer: 'AERO', row: 0, col: 2, direction: 'down' },
      ],
    },
  ],
  highschool: [
    {
      title: 'Academy Ace',
      entries: [
        { id: '1', clue: 'Scientific study of life', answer: 'BIOLOGY', row: 0, col: 0, direction: 'across' },
        { id: '2', clue: 'System of ideas explaining facts', answer: 'THEORY', row: 2, col: 0, direction: 'across' },
        { id: '3', clue: 'A market trend where price drops', answer: 'BETA', row: 0, col: 0, direction: 'down' },
        { id: '4', clue: 'Big cat used as a symbol of strength', answer: 'LION', row: 0, col: 3, direction: 'down' },
      ],
    },
    {
      title: 'Lab Logic',
      entries: [
        { id: '1', clue: 'Math of change and limits', answer: 'CALCULUS', row: 0, col: 0, direction: 'across' },
        { id: '2', clue: 'Math with unknown variables', answer: 'ALGEBRA', row: 2, col: 0, direction: 'across' },
        { id: '3', clue: 'Charred material used for fuel', answer: 'COAL', row: 0, col: 0, direction: 'down' },
        { id: '4', clue: 'Strongly held belief', answer: 'CREED', row: 0, col: 3, direction: 'down' },
      ],
    },
  ],
}


export const MINI_SUDOKU_PUZZLE = {
  // 0 means empty
  board: [
    [1, 0, 3, 4],
    [0, 4, 1, 0],
    [2, 0, 4, 3],
    [4, 3, 0, 1],
  ],
  solution: [
    [1, 2, 3, 4],
    [3, 4, 1, 2],
    [2, 1, 4, 3],
    [4, 3, 2, 1],
  ],
}
export const SUDOKU_LEVELS = ['elementary', 'middleschool', 'highschool']

const SUDOKU_PUZZLES_BY_LEVEL = {
  elementary: [
    {
      board: [
        [1, 0, 3, 4],
        [0, 4, 1, 0],
        [2, 0, 4, 3],
        [4, 3, 0, 1],
      ],
      solution: [
        [1, 2, 3, 4],
        [3, 4, 1, 2],
        [2, 1, 4, 3],
        [4, 3, 2, 1],
      ],
    },
    {
      board: [
        [2, 1, 0, 0],
        [0, 3, 2, 0],
        [0, 0, 1, 2],
        [3, 0, 0, 4],
      ],
      solution: [
        [2, 1, 4, 3],
        [4, 3, 2, 1],
        [3, 4, 1, 2],
        [1, 2, 3, 4],
      ],
    },
  ],
  middleschool: [
    {
      board: [
        [1, 0, 0, 4],
        [0, 4, 1, 0],
        [0, 0, 4, 3],
        [4, 3, 0, 0],
      ],
      solution: [
        [1, 2, 3, 4],
        [3, 4, 1, 2],
        [2, 1, 4, 3],
        [4, 3, 2, 1],
      ],
    },
    {
      board: [
        [0, 0, 3, 0],
        [3, 0, 1, 0],
        [2, 0, 0, 3],
        [0, 3, 0, 1],
      ],
      solution: [
        [1, 2, 3, 4],
        [3, 4, 1, 2],
        [2, 1, 4, 3],
        [4, 3, 2, 1],
      ],
    },
  ],
  highschool: [
    {
      board: [
        [0, 0, 3, 0],
        [0, 4, 0, 0],
        [0, 0, 4, 3],
        [4, 0, 0, 0],
      ],
      solution: [
        [1, 2, 3, 4],
        [3, 4, 1, 2],
        [2, 1, 4, 3],
        [4, 3, 2, 1],
      ],
    },
    {
      board: [
        [0, 0, 0, 4],
        [0, 0, 1, 0],
        [2, 0, 0, 0],
        [0, 3, 0, 0],
      ],
      solution: [
        [1, 2, 3, 4],
        [3, 4, 1, 2],
        [2, 1, 4, 3],
        [4, 3, 2, 1],
      ],
    },
  ],
}

function resolveSudokuLevel(level) {
  return SUDOKU_LEVELS.includes(level) ? level : 'elementary'
}

export function pickSudokuPuzzle(levelOrSeed = 'elementary', maybeSeed = Math.random()) {
  const level = typeof levelOrSeed === 'number' ? 'elementary' : resolveSudokuLevel(levelOrSeed)
  const seed = typeof levelOrSeed === 'number' ? levelOrSeed : maybeSeed
  const generated = generateSudokuForLevel(level, seed)
  return {
    level,
    size: generated.size,
    blockRows: generated.blockRows,
    blockCols: generated.blockCols,
    board: generated.board,
    solution: generated.solution,
  }
}

const DIRECTIONS = [
  [1, 0],
  [0, 1],
  [1, 1],
  [1, -1],
]

function resolveCrosswordLevel(level) {
  return CROSSWORD_LEVELS.includes(level) ? level : 'elementary'
}

function buildCrosswordGrid(entries) {
  let rows = 0
  let cols = 0
  const cells = new Map()
  const touchCounts = new Map()

  for (const entry of entries) {
    for (let offset = 0; offset < entry.answer.length; offset += 1) {
      const row = entry.row + (entry.direction === 'down' ? offset : 0)
      const col = entry.col + (entry.direction === 'across' ? offset : 0)
      const key = `${row},${col}`
      const letter = entry.answer[offset]
      const existing = cells.get(key)

      if (existing && existing !== letter) {
        throw new Error(`crossword_conflict:${entry.id}:${key}`)
      }

      cells.set(key, letter)
      touchCounts.set(key, (touchCounts.get(key) ?? 0) + 1)
      rows = Math.max(rows, row + 1)
      cols = Math.max(cols, col + 1)
    }
  }

  const grid = Array.from({ length: rows }, () => Array.from({ length: cols }, () => ''))
  for (const [key, letter] of cells.entries()) {
    const [row, col] = key.split(',').map((part) => Number(part))
    grid[row][col] = letter
  }

  return {
    grid,
    dimensions: { rows, cols },
    hasIntersection: Array.from(touchCounts.values()).some((count) => count > 1),
  }
}

export function normalizeCrosswordPuzzle(puzzle, fallbackLevel = 'elementary') {
  const level = resolveCrosswordLevel(puzzle?.level ?? fallbackLevel)
  const entries = Array.isArray(puzzle?.entries) ? puzzle.entries : []

  if (entries.length < 2) {
    throw new Error('crossword_entries_required')
  }

  const normalizedEntries = entries.map((entry) => {
    const answer = normalizeAnswer(entry?.answer)
    const direction = entry?.direction === 'down' ? 'down' : entry?.direction === 'across' ? 'across' : null
    const row = Number(entry?.row)
    const col = Number(entry?.col)

    if (!entry?.id || !direction || !Number.isInteger(row) || row < 0 || !Number.isInteger(col) || col < 0) {
      throw new Error('crossword_bad_entry')
    }

    if (!/^[A-Z]{3,12}$/.test(answer)) {
      throw new Error('crossword_bad_answer')
    }

    return {
      id: String(entry.id).trim().toUpperCase(),
      clue: String(entry?.clue ?? '').trim(),
      answer,
      row,
      col,
      direction,
    }
  })

  const { grid, dimensions, hasIntersection } = buildCrosswordGrid(normalizedEntries)

  // Disabling strict intersection check to allow simple puzzles
  // if (!hasIntersection && normalizedEntries.length > 1) {
  //   throw new Error('crossword_no_intersection')
  // }

  // Assign standard crossword numbers based on grid position (top-to-bottom,
  // then left-to-right). Entries that start at the same cell (one across +
  // one down) share the same number — matching real crossword conventions.
  const startKeys = []
  const seenStarts = new Set()
  for (const entry of normalizedEntries) {
    const key = `${entry.row},${entry.col}`
    if (!seenStarts.has(key)) {
      seenStarts.add(key)
      startKeys.push({ row: entry.row, col: entry.col, key })
    }
  }
  startKeys.sort((a, b) => (a.row - b.row) || (a.col - b.col))
  const numberByKey = new Map(startKeys.map((s, idx) => [s.key, idx + 1]))
  for (const entry of normalizedEntries) {
    entry.number = numberByKey.get(`${entry.row},${entry.col}`)
  }

  return {
    title: String(puzzle?.title ?? 'Crossword Challenge').trim() || 'Crossword Challenge',
    level,
    entries: normalizedEntries,
    grid,
    dimensions,
  }
}

export const CROSSWORD_PUZZLES = Object.fromEntries(
  CROSSWORD_LEVELS.map((level) => [
    level,
    RAW_CROSSWORD_PUZZLES[level].map((puzzle) => normalizeCrosswordPuzzle({ ...puzzle, level }, level)),
  ])
)

export const CROSSWORD_PUZZLE = CROSSWORD_PUZZLES.elementary[0]

export function pickCrosswordPuzzle(levelOrSeed = 'elementary', maybeSeed = Math.random()) {
  const level = typeof levelOrSeed === 'number' ? 'elementary' : resolveCrosswordLevel(levelOrSeed)
  const seed = typeof levelOrSeed === 'number' ? levelOrSeed : maybeSeed
  try {
    const generated = generateCrossword(level, seed)
    return normalizeCrosswordPuzzle(generated, level)
  } catch (error) {
    const puzzles = CROSSWORD_PUZZLES[level]
    const index = Math.floor(Math.abs(seed) * puzzles.length) % puzzles.length
    return puzzles[index]
  }
}

export function normalizeAnswer(value) {
  return String(value || '')
    .toUpperCase()
    .replace(/[^A-Z]/g, '')
}

export function scoreCrosswordAnswers(answers, puzzle = CROSSWORD_PUZZLE) {
  const result = {
    total: puzzle.entries.length,
    correct: 0,
    solved: false,
  }

  for (const entry of puzzle.entries) {
    const guess = normalizeAnswer(answers?.[entry.id])
    if (guess === entry.answer) {
      result.correct += 1
    }
  }

  result.solved = result.correct === result.total
  return result
}

export function cloneMiniSudokuBoard(board) {
  return board.map((row) => row.slice())
}

export function isMiniSudokuPlacementValid(board, row, col, value) {
  const size = board.length
  if (!Number.isInteger(value) || value < 1 || value > size) {
    return false
  }
  const { blockRows, blockCols } = getSudokuBlockDims(size)

  for (let i = 0; i < size; i += 1) {
    if (i !== col && board[row][i] === value) {
      return false
    }
    if (i !== row && board[i][col] === value) {
      return false
    }
  }

  const blockRowStart = Math.floor(row / blockRows) * blockRows
  const blockColStart = Math.floor(col / blockCols) * blockCols

  for (let r = blockRowStart; r < blockRowStart + blockRows; r += 1) {
    for (let c = blockColStart; c < blockColStart + blockCols; c += 1) {
      if ((r !== row || c !== col) && board[r][c] === value) {
        return false
      }
    }
  }

  return true
}

export function isMiniSudokuSolved(board) {
  const size = board.length
  for (let row = 0; row < size; row += 1) {
    for (let col = 0; col < size; col += 1) {
      const value = board[row][col]
      if (!value || !isMiniSudokuPlacementValid(board, row, col, value)) {
        return false
      }
    }
  }

  return true
}

// ─── parseCoordKey — needed by SudokuGame which imports from index.js ──
// coordKey is re-exported from gomokuAI.js above

export function parseCoordKey(key) {
  const [x, y] = String(key).split(',').map((part) => Number(part))
  return { x, y }
}
