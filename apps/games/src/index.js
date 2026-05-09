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

export const HANGMAN_ROUNDS = HANGMAN_DICTIONARY.elementary

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

function resolveHangmanLevel(level) {
  return HANGMAN_LEVELS.includes(level) ? level : 'elementary'
}

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

export function pickHangmanRound(levelOrSeed = 'elementary', maybeSeed = Math.random()) {
  const level = typeof levelOrSeed === 'number' ? 'elementary' : resolveHangmanLevel(levelOrSeed)
  const seed = typeof levelOrSeed === 'number' ? levelOrSeed : maybeSeed
  const rounds = HANGMAN_DICTIONARY[level]
  const index = Math.floor(Math.abs(seed) * rounds.length) % rounds.length
  return rounds[index]
}

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

export function coordKey(x, y) {
  return `${x},${y}`
}

export function parseCoordKey(key) {
  const [x, y] = String(key)
    .split(',')
    .map((part) => Number(part))
  return { x, y }
}

function countDirection(stones, x, y, dx, dy, player) {
  let count = 0
  let cursorX = x + dx
  let cursorY = y + dy

  while (stones[coordKey(cursorX, cursorY)] === player) {
    count += 1
    cursorX += dx
    cursorY += dy
  }

  return count
}

function lineLengthThrough(stones, x, y, player, dx, dy) {
  return 1 + countDirection(stones, x, y, dx, dy, player) + countDirection(stones, x, y, -dx, -dy, player)
}

function longestLineAfterMove(stones, x, y, player) {
  const next = {
    ...stones,
    [coordKey(x, y)]: player,
  }

  return Math.max(...DIRECTIONS.map(([dx, dy]) => lineLengthThrough(next, x, y, player, dx, dy)))
}

export function getClosestChebyshevDistance(stones, x, y) {
  const entries = Object.keys(stones)
  if (!entries.length) {
    return 0
  }

  let best = Number.POSITIVE_INFINITY
  for (const key of entries) {
    const point = parseCoordKey(key)
    const distance = Math.max(Math.abs(point.x - x), Math.abs(point.y - y))
    if (distance < best) {
      best = distance
    }
  }

  return best
}

export function isGomokuMoveLegal(stones, x, y) {
  if (!Number.isInteger(x) || !Number.isInteger(y)) {
    return false
  }

  if (stones[coordKey(x, y)]) {
    return false
  }

  if (!Object.keys(stones).length) {
    return true
  }

  return getClosestChebyshevDistance(stones, x, y) <= 3
}

export function getGomokuWinner(stones, lastMove) {
  if (!Object.keys(stones).length) {
    return null
  }

  const pointsToCheck = lastMove ? [lastMove] : Object.keys(stones).map(parseCoordKey)

  for (const point of pointsToCheck) {
    const player = stones[coordKey(point.x, point.y)]
    if (!player) {
      continue
    }

    for (const [dx, dy] of DIRECTIONS) {
      const line = lineLengthThrough(stones, point.x, point.y, player, dx, dy)
      if (line >= 5) {
        return player
      }
    }
  }

  return null
}

function getCandidateMoves(stones, radius = 1) {
  if (!Object.keys(stones).length) {
    return [{ x: 0, y: 0 }]
  }

  const candidates = new Set()

  for (const key of Object.keys(stones)) {
    const { x, y } = parseCoordKey(key)
    if (!Number.isInteger(x) || !Number.isInteger(y)) {
      continue
    }

    for (let dx = -radius; dx <= radius; dx += 1) {
      for (let dy = -radius; dy <= radius; dy += 1) {
        if (dx === 0 && dy === 0) {
          continue
        }
        const nextX = x + dx
        const nextY = y + dy
        if (isGomokuMoveLegal(stones, nextX, nextY)) {
          candidates.add(coordKey(nextX, nextY))
        }
      }
    }
  }

  return Array.from(candidates).map(parseCoordKey)
}

function adjacencyScore(stones, x, y, player) {
  let score = 0
  for (let dx = -1; dx <= 1; dx += 1) {
    for (let dy = -1; dy <= 1; dy += 1) {
      if (dx === 0 && dy === 0) {
        continue
      }
      const occupant = stones[coordKey(x + dx, y + dy)]
      if (occupant === player) {
        score += 2
      } else if (occupant) {
        score += 1
      }
    }
  }
  return score
}

function maxCurrentLine(stones, player) {
  let best = 0

  for (const key of Object.keys(stones)) {
    if (stones[key] !== player) {
      continue
    }

    const { x, y } = parseCoordKey(key)
    if (!Number.isInteger(x) || !Number.isInteger(y)) {
      continue
    }

    for (const [dx, dy] of DIRECTIONS) {
      best = Math.max(best, lineLengthThrough(stones, x, y, player, dx, dy))
    }
  }

  return best
}

function moveUrgencyScore(stones, move, player) {
  const opponent = player === 'ai' ? 'human' : 'ai'
  const ownLine = longestLineAfterMove(stones, move.x, move.y, player)
  const blockLine = longestLineAfterMove(stones, move.x, move.y, opponent)
  const adjacency = adjacencyScore(stones, move.x, move.y, player)

  return ownLine * 14 + blockLine * 10 + adjacency
}

function countOpenEndedThreeDirections(stones, x, y, player) {
  const next = {
    ...stones,
    [coordKey(x, y)]: player,
  }

  let total = 0

  for (const [dx, dy] of DIRECTIONS) {
    const lineLength = lineLengthThrough(next, x, y, player, dx, dy)
    if (lineLength < 3) {
      continue
    }

    let startX = x
    let startY = y
    while (next[coordKey(startX - dx, startY - dy)] === player) {
      startX -= dx
      startY -= dy
    }

    let endX = x
    let endY = y
    while (next[coordKey(endX + dx, endY + dy)] === player) {
      endX += dx
      endY += dy
    }

    const openStart = !next[coordKey(startX - dx, startY - dy)]
    const openEnd = !next[coordKey(endX + dx, endY + dy)]
    if (openStart || openEnd) {
      total += 1
    }
  }

  return total
}

function createsDoubleThreeThreat(stones, move, player) {
  return countOpenEndedThreeDirections(stones, move.x, move.y, player) >= 2
}

function getImmediateThreatMoves(stones, attacker) {
  const candidates = getCandidateMoves(stones, 2)
  const winningMoves = []
  const strongThreatMoves = []

  for (const candidate of candidates) {
    const lineLength = longestLineAfterMove(stones, candidate.x, candidate.y, attacker)
    if (lineLength >= 5) {
      winningMoves.push(candidate)
      continue
    }

    if (lineLength >= 4 || createsDoubleThreeThreat(stones, candidate, attacker)) {
      strongThreatMoves.push(candidate)
    }
  }

  return {
    winningMoves,
    strongThreatMoves,
  }
}

function pickBestTacticalMove(stones, moves, player) {
  const ranked = rankMoves(stones, moves, player)
  return ranked.length ? { x: ranked[0].x, y: ranked[0].y } : null
}

function rankMoves(stones, moves, player) {
  return moves
    .map((move) => ({
      ...move,
      score: moveUrgencyScore(stones, move, player),
    }))
    .sort((left, right) => right.score - left.score || left.y - right.y || left.x - right.x)
}

function weightedRandomMove(rankedMoves, rng) {
  if (!rankedMoves.length) {
    return null
  }

  const weights = rankedMoves.map((move) => Math.max(1, move.score + 1) ** 1.35)
  const total = weights.reduce((sum, value) => sum + value, 0)
  const roll = rng() * total

  let cumulative = 0
  for (let i = 0; i < rankedMoves.length; i += 1) {
    cumulative += weights[i]
    if (roll <= cumulative) {
      return rankedMoves[i]
    }
  }

  return rankedMoves[rankedMoves.length - 1]
}

function evaluateBoard(stones) {
  const aiLine = maxCurrentLine(stones, 'ai')
  const humanLine = maxCurrentLine(stones, 'human')
  const normalized = (aiLine - humanLine) / 10
  const clamped = Math.max(-0.45, Math.min(0.45, normalized))
  return 0.5 + clamped
}

function rollout(stones, playerToMove, options) {
  const board = { ...stones }
  let player = playerToMove
  const opponent = (value) => (value === 'ai' ? 'human' : 'ai')

  for (let depth = 0; depth < options.maxRolloutDepth; depth += 1) {
    if (Date.now() >= options.deadlineTs) {
      break
    }

    const candidates = getCandidateMoves(board, 2)
    if (!candidates.length) {
      return 0.5
    }

    const ranked = rankMoves(board, candidates, player).slice(0, options.rolloutCandidateLimit)
    const chosen = weightedRandomMove(ranked, options.rng)
    if (!chosen) {
      return 0.5
    }

    board[coordKey(chosen.x, chosen.y)] = player
    const winner = getGomokuWinner(board, chosen)
    if (winner) {
      return winner === 'ai' ? 1 : 0
    }

    player = opponent(player)
  }

  return evaluateBoard(board)
}

export function chooseGomokuAIMove(stones, config = {}) {
  const options = {
    timeBudgetMs: 110,
    maxPlayouts: 260,
    maxRolloutDepth: 10,
    candidateLimit: 18,
    rolloutCandidateLimit: 8,
    explorationConstant: 1.25,
    rng: Math.random,
    ...config,
  }

  const deadlineTs = Date.now() + Math.max(8, options.timeBudgetMs)
  const candidates = getCandidateMoves(stones, 2)
  if (!candidates.length) {
    return null
  }

  const aiThreats = getImmediateThreatMoves(stones, 'ai')
  if (aiThreats.winningMoves.length) {
    return pickBestTacticalMove(stones, aiThreats.winningMoves, 'ai')
  }

  const humanThreats = getImmediateThreatMoves(stones, 'human')
  if (humanThreats.winningMoves.length) {
    return pickBestTacticalMove(stones, humanThreats.winningMoves, 'ai')
  }

  if (humanThreats.strongThreatMoves.length) {
    return pickBestTacticalMove(stones, humanThreats.strongThreatMoves, 'ai')
  }

  if (aiThreats.strongThreatMoves.length) {
    return pickBestTacticalMove(stones, aiThreats.strongThreatMoves, 'ai')
  }

  const rankedRoots = rankMoves(stones, candidates, 'ai').slice(0, options.candidateLimit)
  if (!rankedRoots.length) {
    return null
  }

  if (rankedRoots.length === 1) {
    return { x: rankedRoots[0].x, y: rankedRoots[0].y }
  }

  const rootStats = rankedRoots.map((move) => ({
    x: move.x,
    y: move.y,
    baseScore: move.score,
    visits: 0,
    value: 0,
  }))

  let totalPlayouts = 0
  while (Date.now() < deadlineTs && totalPlayouts < options.maxPlayouts) {
    let selected = rootStats[0]
    let bestUct = Number.NEGATIVE_INFINITY
    const logVisits = Math.log(totalPlayouts + 2)

    for (const root of rootStats) {
      const exploration =
        root.visits === 0
          ? Number.POSITIVE_INFINITY
          : options.explorationConstant * Math.sqrt(logVisits / root.visits)
      const exploitation = root.visits === 0 ? 0 : root.value / root.visits
      const uct = exploitation + exploration + root.baseScore * 0.0005

      if (uct > bestUct) {
        selected = root
        bestUct = uct
      }
    }

    const trialBoard = {
      ...stones,
      [coordKey(selected.x, selected.y)]: 'ai',
    }

    const immediate = getGomokuWinner(trialBoard, selected)
    const score = immediate
      ? 1
      : rollout(trialBoard, 'human', {
          deadlineTs,
          maxRolloutDepth: options.maxRolloutDepth,
          rolloutCandidateLimit: options.rolloutCandidateLimit,
          rng: options.rng,
        })

    selected.visits += 1
    selected.value += score
    totalPlayouts += 1
  }

  rootStats.sort((left, right) => {
    const leftAvg = left.visits ? left.value / left.visits : 0
    const rightAvg = right.visits ? right.value / right.visits : 0
    const leftRobust = left.visits / (totalPlayouts || 1)
    const rightRobust = right.visits / (totalPlayouts || 1)
    const leftScore = leftAvg * 0.8 + leftRobust * 0.2
    const rightScore = rightAvg * 0.8 + rightRobust * 0.2
    return rightScore - leftScore || right.baseScore - left.baseScore
  })

  return { x: rootStats[0].x, y: rootStats[0].y }
}
