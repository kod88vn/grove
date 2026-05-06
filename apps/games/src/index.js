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

export const HANGMAN_ROUNDS = [
  { word: 'DRAGON', hint: 'A fire-breathing fantasy creature', mascot: '🐉' },
  { word: 'PIZZA', hint: 'Cheesy circle sliced into triangles', mascot: '🍕' },
  { word: 'ROCKET', hint: 'It blasts off to space', mascot: '🚀' },
  { word: 'UNICORN', hint: 'A magical horse with a horn', mascot: '🦄' },
  { word: 'JUNGLE', hint: 'A wild place full of vines and animals', mascot: '🦜' },
]

export const CROSSWORD_PUZZLE = {
  title: 'Mini Giggle Crossword',
  grid: [
    ['C', '', '', '', 'G', '', ''],
    ['O', 'I', 'C', 'E', 'C', 'R', 'E', 'A', 'M'],
    ['W', '', '', '', 'E', '', ''],
    ['', '', 'K', 'I', 'T', 'E', ''],
  ],
  dimensions: { rows: 4, cols: 9 },
  entries: [
    { id: '1A', clue: 'Sweet frozen summer treat (Across)', answer: 'ICECREAM', row: 1, col: 1, direction: 'across' },
    { id: '2A', clue: 'Rides the wind with a string (Across)', answer: 'KITE', row: 3, col: 2, direction: 'across' },
    { id: '1D', clue: 'Goes moo on a farm (Down)', answer: 'COW', row: 0, col: 0, direction: 'down' },
    { id: '2D', clue: 'Color of grass (Down)', answer: 'GREEN', row: 0, col: 4, direction: 'down' },
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

const DIRECTIONS = [
  [1, 0],
  [0, 1],
  [1, 1],
  [1, -1],
]

export function pickHangmanRound(seed = Math.random()) {
  const index = Math.floor(Math.abs(seed) * HANGMAN_ROUNDS.length) % HANGMAN_ROUNDS.length
  return HANGMAN_ROUNDS[index]
}

export function normalizeAnswer(value) {
  return String(value || '')
    .toUpperCase()
    .replace(/[^A-Z]/g, '')
}

export function scoreCrosswordAnswers(answers) {
  const result = {
    total: CROSSWORD_PUZZLE.entries.length,
    correct: 0,
    solved: false,
  }

  for (const entry of CROSSWORD_PUZZLE.entries) {
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
  if (![1, 2, 3, 4].includes(value)) {
    return false
  }

  for (let i = 0; i < 4; i += 1) {
    if (i !== col && board[row][i] === value) {
      return false
    }
    if (i !== row && board[i][col] === value) {
      return false
    }
  }

  const blockRowStart = Math.floor(row / 2) * 2
  const blockColStart = Math.floor(col / 2) * 2

  for (let r = blockRowStart; r < blockRowStart + 2; r += 1) {
    for (let c = blockColStart; c < blockColStart + 2; c += 1) {
      if ((r !== row || c !== col) && board[r][c] === value) {
        return false
      }
    }
  }

  return true
}

export function isMiniSudokuSolved(board) {
  for (let row = 0; row < 4; row += 1) {
    for (let col = 0; col < 4; col += 1) {
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
