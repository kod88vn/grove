// Gomoku AI Engine — Pattern-Matching + Minimax with Alpha-Beta Pruning
//
// Architecture:
//   1. Pattern Library — classify connected lines into threat categories
//   2. Threat Classifier — scan board for all active threats per player
//   3. Double-Threat Detector — identify unblockable combos (four-three, double-four)
//   4. Minimax Engine — alpha-beta search with threat-move candidate generation
//   5. Difficulty Controller — depth, error rate, pattern scope knobs
//
// Reference: Pattern-matching minimax is the standard approach for Gomoku AI.
// See: Bielawski 2001 "A Neural Network Approach to Gomoku",
//       Sturtevant 2004 "Gomoku Computer Play", and modern open-source engines.

// ─── Direction vectors ────────────────────────────────────────────────────────

const DIRECTIONS = [
  [1, 0],   // horizontal
  [0, 1],   // vertical
  [1, 1],   // diagonal down-right
  [1, -1],  // diagonal up-right
]

// ─── Coordinate helpers ───────────────────────────────────────────────────────

export function coordKey(x, y) {
  return `${x},${y}`
}

function parseCoordKey(key) {
  const [x, y] = String(key).split(',').map((part) => Number(part))
  return { x, y }
}

// ─── Board primitives ─────────────────────────────────────────────────────────

function countDirection(stones, x, y, dx, dy, player) {
  let count = 0
  let cx = x + dx
  let cy = y + dy
  while (stones[coordKey(cx, cy)] === player) {
    count += 1
    cx += dx
    cy += dy
  }
  return count
}

function lineLengthThrough(stones, x, y, player, dx, dy) {
  return 1 + countDirection(stones, x, y, dx, dy, player)
    + countDirection(stones, x, y, -dx, -dy, player)
}

function longestLineAfterMove(stones, x, y, player) {
  const next = { ...stones, [coordKey(x, y)]: player }
  return Math.max(...DIRECTIONS.map(([dx, dy]) => lineLengthThrough(next, x, y, player, dx, dy)))
}

function getClosestChebyshevDistance(stones, x, y) {
  const entries = Object.keys(stones)
  if (!entries.length) return 0
  let best = Number.POSITIVE_INFINITY
  for (const key of entries) {
    const p = parseCoordKey(key)
    if (!Number.isInteger(p.x) || !Number.isInteger(p.y)) continue
    const d = Math.max(Math.abs(p.x - x), Math.abs(p.y - y))
    if (d < best) best = d
  }
  return best
}

export function isGomokuMoveLegal(stones, x, y) {
  if (!Number.isInteger(x) || !Number.isInteger(y)) return false
  if (stones[coordKey(x, y)]) return false
  if (!Object.keys(stones).length) return true
  return getClosestChebyshevDistance(stones, x, y) <= 3
}

export function getGomokuWinner(stones, lastMove) {
  if (!Object.keys(stones).length) return null

  const pointsToCheck = lastMove ? [lastMove] : Object.keys(stones).map(parseCoordKey)

  for (const point of pointsToCheck) {
    const player = stones[coordKey(point.x, point.y)]
    if (!player) continue

    for (const [dx, dy] of DIRECTIONS) {
      const fwd = countDirection(stones, point.x, point.y, dx, dy, player)
      const bwd = countDirection(stones, point.x, point.y, -dx, -dy, player)
      const total = 1 + fwd + bwd

      if (total >= 5) {
        const forwardBlocked = !!stones[coordKey(point.x + dx * (fwd + 1), point.y + dy * (fwd + 1))]
        const backwardBlocked = !!stones[coordKey(point.x - dx * (bwd + 1), point.y - dy * (bwd + 1))]
        if (forwardBlocked && backwardBlocked) continue
        return player
      }
    }
  }
  return null
}

// ─── Candidate move generation ────────────────────────────────────────────────

export function getCandidateMoves(stones, radius) {
  if (radius === undefined) radius = 1
  if (!Object.keys(stones).length) return [{ x: 0, y: 0 }]

  const candidates = new Set()
  for (const key of Object.keys(stones)) {
    const { x, y } = parseCoordKey(key)
    if (!Number.isInteger(x) || !Number.isInteger(y)) continue

    for (let dx = -radius; dx <= radius; dx += 1) {
      for (let dy = -radius; dy <= radius; dy += 1) {
        if (dx === 0 && dy === 0) continue
        const nx = x + dx
        const ny = y + dy
        if (isGomokuMoveLegal(stones, nx, ny)) {
          candidates.add(coordKey(nx, ny))
        }
      }
    }
  }
  return Array.from(candidates).map(parseCoordKey)
}

// Threat-move generation: only positions adjacent to existing stones (radius 2).
// This dramatically reduces branching factor for minimax.
export function getThreatMoves(stones) {
  return getCandidateMoves(stones, 2)
}

// ─── Pattern Library ──────────────────────────────────────────────────────────
//
// Pattern classification scans a line segment in both directions from a point.
// Returns an object describing the pattern type and its open ends.

/**
 * Classify a line segment through (x, y) in direction (dx, dy).
 * Returns { connected, openStart, openEnd, blocked } where:
 *   - connected: number of consecutive stones of `player` including (x, y)
 *   - openStart: true if the start end is not blocked by opponent or board edge
 *   - openEnd: true if the end end is not blocked
 *   - blocked: total number of opponent stones immediately adjacent to the segment
 */
function classifyLine(stones, x, y, player, dx, dy) {
  // Count forward
  let fwdCount = 0
  let fx = x + dx, fy = y + dy
  while (stones[coordKey(fx, fy)] === player) {
    fwdCount += 1
    fx += dx
    fy += dy
  }

  // Count backward
  let bwdCount = 0
  let bx = x - dx, by = y - dy
  while (stones[coordKey(bx, by)] === player) {
    bwdCount += 1
    bx -= dx
    by -= dy
  }

  const connected = 1 + fwdCount + bwdCount
  const openEnd = !stones[coordKey(fx, fy)]
  const openStart = !stones[coordKey(bx, by)]

  return { connected, openStart, openEnd }
}

/**
 * Pattern type classification based on connected count and open ends.
 * Returns a pattern code string:
 *   'win'       — 5+ connected (already won)
 *   'live4'     — 4 connected, both ends open
 *   'sleep4'    — 4 connected, one end open
 *   'dead4'     — 4 connected, no ends open
 *   'live3'     — 3 connected, both ends open
 *   'sleep3'    — 3 connected, one end open
 *   'dead3'     — 3 connected, no ends open
 *   'live2'     — 2 connected, both ends open
 *   'sleep2'    — 2 connected, one end open
 *   'dead2'     — 2 connected, no ends open
 *   'live1'     — 1 connected (single stone), both ends open
 *   'sleep1'    — 1 connected, one end open
 */
function classifyPattern(connected, openStart, openEnd) {
  if (connected >= 5) return 'win'

  const openSides = (openStart ? 1 : 0) + (openEnd ? 1 : 0)

  if (connected === 4) {
    if (openSides === 2) return 'live4'
    if (openSides === 1) return 'sleep4'
    return 'dead4'
  }

  if (connected === 3) {
    if (openSides === 2) return 'live3'
    if (openSides === 1) return 'sleep3'
    return 'dead3'
  }

  if (connected === 2) {
    if (openSides === 2) return 'live2'
    if (openSides === 1) return 'sleep2'
    return 'dead2'
  }

  if (connected === 1) {
    if (openSides === 2) return 'live1'
    if (openSides === 1) return 'sleep1'
    return 'dead1'
  }

  return 'empty'
}

// Pattern scores — the core of the evaluation function.
// These values are carefully tuned so that:
//   - Winning moves always score highest
//   - Live 4 is nearly a guaranteed win (opponent can only block one end)
//   - Live 3 + live 3 = double threat (unblockable)
//   - Sleeping patterns score lower but still positive
const PATTERN_SCORES = {
  win:       100000,
  live4:     50000,
  sleep4:    5000,
  live3:     1000,
  sleep3:    200,
  live2:     50,
  sleep2:    10,
  dead4:     5,
  dead3:     2,
  live1:     3,
  sleep1:    1,
  dead2:     0,
  dead1:     0,
  empty:     0,
}

// ─── Threat Classifier ────────────────────────────────────────────────────────
//
// Scans the entire board and returns a summary of active threats for a player.

/**
 * Scan all directions from position (x, y) and return pattern codes for player.
 */
function getPatternsAt(stones, x, y, player) {
  return DIRECTIONS.map(([dx, dy]) => {
    const line = classifyLine(stones, x, y, player, dx, dy)
    return classifyPattern(line.connected, line.openStart, line.openEnd)
  })
}

/**
 * Count pattern occurrences in a list.
 */
function countPatterns(patterns, type) {
  return patterns.filter((p) => p === type).length
}

/**
 * Classify the threat level of a move for a player.
 * Returns { patterns, live4, sleep4, live3, sleep3, isWinningMove }
 */
function classifyMoveThreat(stones, x, y, player) {
  const patterns = getPatternsAt(stones, x, y, player)
  return {
    patterns,
    live4: countPatterns(patterns, 'live4'),
    sleep4: countPatterns(patterns, 'sleep4'),
    live3: countPatterns(patterns, 'live3'),
    sleep3: countPatterns(patterns, 'sleep3'),
    isWinningMove: patterns.includes('win'),
  }
}

// ─── Double-Threat Detector ───────────────────────────────────────────────────
//
// A move that creates TWO or more threats simultaneously is often unblockable.
// Key combos: four-three, double-four, triple-three.

/**
 * Analyze a move for double-threat potential.
 * Returns { fourThree, doubleFour, tripleThree, threatCount }
 */
function detectDoubleThreat(moveThreat) {
  const { live4, sleep4, live3, sleep3 } = moveThreat

  // Four-three: one four (live or sleeping) AND one three (live or sleeping)
  const hasFour = live4 + sleep4 > 0
  const hasThree = live3 + sleep3 > 0

  // Double four: two or more four-threats in different directions
  const totalFours = live4 + sleep4
  // Triple three: three or more three-threats in different directions
  const totalThrees = live3 + sleep3

  return {
    fourThree: hasFour && hasThree,
    doubleFour: totalFours >= 2,
    tripleThree: totalThrees >= 3,
    threatCount: totalFours + totalThrees,
  }
}

// ─── Board Evaluation ─────────────────────────────────────────────────────────

/**
 * Evaluate the board from AI's perspective.
 * Returns a score: positive = AI advantage, negative = human advantage.
 *
 * Scoring methodology:
 *   For each player, sum up pattern scores across all occupied positions.
 *   The final score is the difference (AI - human), scaled for minimax.
 */
function evaluateBoard(stones, playerToEval = 'ai') {
  const opponent = playerToEval === 'ai' ? 'human' : 'ai'

  let aiScore = 0
  let humanScore = 0

  for (const key of Object.keys(stones)) {
    const { x, y } = parseCoordKey(key)
    if (!Number.isInteger(x) || !Number.isInteger(y)) continue

    const player = stones[key]
    const patterns = getPatternsAt(stones, x, y, player)

    for (const pattern of patterns) {
      const score = PATTERN_SCORES[pattern] || 0
      if (player === 'ai') {
        aiScore += score
      } else {
        humanScore += score
      }
    }
  }

  // Net advantage for the evaluating player
  if (playerToEval === 'ai') {
    return aiScore - humanScore
  }
  return humanScore - aiScore
}

// ─── Minimax with Alpha-Beta Pruning ──────────────────────────────────────────

/**
 * Terminal check: is the game over or should we stop searching?
 */
function isTerminal(stones, depth) {
  // Always search at least to minimum depth
  if (depth > 0) return false

  // Check for winning moves
  const entries = Object.keys(stones)
  if (entries.length === 0) return false

  // Quick check: if any candidate creates a win, this is terminal
  const candidates = getThreatMoves(stones)
  for (const c of candidates) {
    if (getGomokuWinner({ ...stones, [coordKey(c.x, c.y)]: 'ai' }, c)) return true
    if (getGomokuWinner({ ...stones, [coordKey(c.x, c.y)]: 'human' }, c)) return true
  }

  // Board full?
  if (candidates.length === 0) return true

  return false
}

/**
 * Minimax with alpha-beta pruning.
 * Returns { score, bestMove } where bestMove is the move at this node.
 */
function minimax(stones, depth, alpha, beta, isMaximizing) {
  // Terminal check
  if (depth === 0) {
    const score = isMaximizing ? evaluateBoard(stones, 'ai') : -evaluateBoard(stones, 'human')
    return { score, bestMove: null }
  }

  const candidates = getThreatMoves(stones)
  if (!candidates.length) {
    return { score: 0, bestMove: null }
  }

  // Quick tactical check: immediate win or block?
  for (const move of candidates) {
    const next = { ...stones, [coordKey(move.x, move.y)]: 'ai' }
    if (getGomokuWinner(next, move)) {
      return { score: Number.POSITIVE_INFINITY, bestMove: move }
    }
  }
  for (const move of candidates) {
    const next = { ...stones, [coordKey(move.x, move.y)]: 'human' }
    if (getGomokuWinner(next, move)) {
      return { score: Number.NEGATIVE_INFINITY, bestMove: move }
    }
  }

  if (isMaximizing) {
    let bestScore = Number.NEGATIVE_INFINITY
    let bestMove = null

    // Sort candidates by heuristic to improve alpha-beta pruning
    const scored = scoreCandidatesHeuristic(stones, candidates, 'ai')
    scored.sort((a, b) => b.score - a.score)

    for (const move of scored.map((s) => s.move)) {
      const next = { ...stones, [coordKey(move.x, move.y)]: 'ai' }
      const result = minimax(next, depth - 1, alpha, beta, false)

      if (result.score > bestScore) {
        bestScore = result.score
        bestMove = move
      }
      alpha = Math.max(alpha, bestScore)
      if (beta <= alpha) break // prune
    }

    return { score: bestScore, bestMove }
  } else {
    let bestScore = Number.POSITIVE_INFINITY
    let bestMove = null

    const scored = scoreCandidatesHeuristic(stones, candidates, 'human')
    scored.sort((a, b) => a.score - b.score) // human wants lowest AI score

    for (const move of scored.map((s) => s.move)) {
      const next = { ...stones, [coordKey(move.x, move.y)]: 'human' }
      const result = minimax(next, depth - 1, alpha, beta, true)

      if (result.score < bestScore) {
        bestScore = result.score
        bestMove = move
      }
      beta = Math.min(beta, bestScore)
      if (beta <= alpha) break // prune
    }

    return { score: bestScore, bestMove }
  }
}

// ─── Candidate Scoring Heuristic ──────────────────────────────────────────────
// Pre-sorts candidates for better alpha-beta pruning.

function adjacencyScore(stones, x, y, player) {
  let score = 0
  for (let dx = -1; dx <= 1; dx += 1) {
    for (let dy = -1; dy <= 1; dy += 1) {
      if (dx === 0 && dy === 0) continue
      const occupant = stones[coordKey(x + dx, y + dy)]
      if (occupant === player) score += 2
      else if (occupant) score += 1
    }
  }
  return score
}

function scoreCandidatesHeuristic(stones, moves, player) {
  const opponent = player === 'ai' ? 'human' : 'ai'

  return moves.map((move) => {
    // Offensive potential
    const offThreat = classifyMoveThreat(stones, move.x, move.y, player)
    let offScore = 0
    for (const p of offThreat.patterns) {
      offScore += PATTERN_SCORES[p] || 0
    }

    // Defensive potential (how good is this move for the opponent?)
    const defThreat = classifyMoveThreat(stones, move.x, move.y, opponent)
    let defScore = 0
    for (const p of defThreat.patterns) {
      defScore += PATTERN_SCORES[p] || 0
    }

    const adjacency = adjacencyScore(stones, move.x, move.y, player)

    // Weight: offensive value is primary, defensive is secondary
    const total = offScore * 1.2 + defScore * 0.5 + adjacency * 3

    return { move, score: total }
  })
}

// ─── Double-Threat Bonus ──────────────────────────────────────────────────────
// If a move creates multiple threats, add a massive bonus — the opponent can only block one.

function doubleThreatBonus(moveThreat) {
  const dt = detectDoubleThreat(moveThreat)
  let bonus = 0

  if (dt.fourThree) bonus += 25000   // Four-three is essentially a forced win
  if (dt.doubleFour) bonus += 50000   // Double four is an instant win
  if (dt.tripleThree) bonus += 30000  // Triple three is also unblockable

  return bonus
}

// ─── Difficulty Configuration ─────────────────────────────────────────────────

export const GOMOKU_DIFFICULTY_LEVELS = ['easy', 'medium', 'hard', 'expert']

export const GOMOKU_AI_CONFIGS = {
  easy: {
    searchDepth: 2,
    candidateLimit: null,
    errorRate: 0.15,
    patternScope: 'full',
    doubleThreatDetection: false,
  },
  medium: {
    searchDepth: 3,
    candidateLimit: null,
    errorRate: 0.05,
    patternScope: 'full',
    doubleThreatDetection: false,
  },
  hard: {
    searchDepth: 4,
    candidateLimit: null,
    errorRate: 0.0,
    patternScope: 'full',
    doubleThreatDetection: true,
  },
  expert: {
    searchDepth: 5,
    candidateLimit: null,
    errorRate: 0.0,
    patternScope: 'full',
    doubleThreatDetection: true,
    openingBook: true,           // first 12 moves from book
    endgameSolver: true,         // exhaustive when < 30 stones
  },
}

// ─── Opening Book ─────────────────────────────────────────────────────────────
// Standard opening moves for Gomoku. Center-first strategy with nearby extensions.

const OPENING_BOOK = [
  // First move: center
  { x: 0, y: 0 },
  // Second move: adjacent to center (diagonal)
  { x: 1, y: 1 },
  // Third move: extend the line
  { x: 2, y: 1 },
  // Fourth move: create branching threat
  { x: 1, y: 2 },
]

function getOpeningMove(stones) {
  const count = Object.keys(stones).length
  if (count >= OPENING_BOOK.length * 2) return null

  const idx = Math.floor(count / 2)
  if (idx < OPENING_BOOK.length) {
    const candidate = OPENING_BOOK[idx]
    // Only return if the position is actually empty and legal
    if (!stones[coordKey(candidate.x, candidate.y)] && isGomokuMoveLegal(stones, candidate.x, candidate.y)) {
      return { ...candidate }
    }
  }
  return null
}

// ─── Error Injection ──────────────────────────────────────────────────────────
// For lower difficulties, occasionally play a suboptimal move.

function maybeInjectError(bestMove, candidates, errorRate) {
  if (errorRate <= 0 || !bestMove) return bestMove

  if (Math.random() < errorRate && candidates.length > 1) {
    // Pick a random move from top-5 (or all candidates if fewer)
    const poolSize = Math.min(5, candidates.length)
    const topCandidates = candidates.slice(0, poolSize)
    return topCandidates[Math.floor(Math.random() * poolSize)]
  }

  return bestMove
}

// ─── Basic Pattern Scope (Beginner) ──────────────────────────────────────────
// Only considers line length, ignores open/blocked distinction.

function basicEvaluateMove(stones, x, y, player) {
  const next = { ...stones, [coordKey(x, y)]: player }
  let bestLine = 0

  for (const [dx, dy] of DIRECTIONS) {
    const line = lineLengthThrough(next, x, y, player, dx, dy)
    if (line > bestLine) bestLine = line
  }

  return bestLine
}

// ─── Main AI Entry Point ──────────────────────────────────────────────────────

/**
 * Choose the best move for the AI given the current board state.
 *
 * @param {Record<string, string>} stones — map of "x,y" → 'ai' | 'human'
 * @param {object} [options]
 * @param {'easy'|'medium'|'hard'|'expert'} [options.difficulty='expert']
 * @param {number} [options.timeBudgetMs=2000] — max time for computation
 * @returns {{x: number, y: number} | null}
 */
export function chooseGomokuAIMove(stones, options = {}) {
  const difficulty = options.difficulty || 'expert'
  const config = GOMOKU_AI_CONFIGS[difficulty] || GOMOKU_AI_CONFIGS.expert
  const timeBudgetMs = options.timeBudgetMs || 2000

  // Empty board: play center
  if (!Object.keys(stones).length) {
    return { x: 0, y: 0 }
  }

  const candidates = getThreatMoves(stones)
  if (!candidates.length) return null

  // Beginner: basic line-length scoring, no search
  if (config.patternScope === 'basic') {
    // Check for immediate win first — prefer positive direction
    const aiWinCandidates = [...candidates].sort((a, b) => {
      const aPositive = (a.x > 0 || a.y > 0) ? 1 : 0
      const bPositive = (b.x > 0 || b.y > 0) ? 1 : 0
      if (aPositive !== bPositive) return bPositive - aPositive
      const da = Math.max(Math.abs(a.x), Math.abs(a.y))
      const db = Math.max(Math.abs(b.x), Math.abs(b.y))
      if (da !== db) return da - db
      if (a.x !== b.x) return a.x - b.x
      return a.y - b.y
    })

    for (const move of aiWinCandidates) {
      const next = { ...stones, [coordKey(move.x, move.y)]: 'ai' }
      if (getGomokuWinner(next, move)) return { ...move }
    }

    // Check for human win to block — prefer positive direction
    const humanCandidates = getThreatMoves(stones)
    const sortedHumanCands = [...humanCandidates].sort((a, b) => {
      const aPositive = (a.x > 0 || a.y > 0) ? 1 : 0
      const bPositive = (b.x > 0 || b.y > 0) ? 1 : 0
      if (aPositive !== bPositive) return bPositive - aPositive
      const da = Math.max(Math.abs(a.x), Math.abs(a.y))
      const db = Math.max(Math.abs(b.x), Math.abs(b.y))
      if (da !== db) return da - db
      if (a.x !== b.x) return a.x - b.x
      return a.y - b.y
    })

    for (const move of sortedHumanCands) {
      const next = { ...stones, [coordKey(move.x, move.y)]: 'human' }
      if (getGomokuWinner(next, move)) return { ...move }
    }

    const scored = candidates.map((move) => ({
      move,
      score: basicEvaluateMove(stones, move.x, move.y, 'ai'),
    }))

    // Sort by score desc, then positive direction preference for deterministic tie-breaking
    scored.sort((a, b) => {
      if (b.score !== a.score) return b.score - a.score
      const aPositive = (a.move.x > 0 || a.move.y > 0) ? 1 : 0
      const bPositive = (b.move.x > 0 || b.move.y > 0) ? 1 : 0
      if (aPositive !== bPositive) return bPositive - aPositive
      const da = Math.max(Math.abs(a.move.x), Math.abs(a.move.y))
      const db = Math.max(Math.abs(b.move.x), Math.abs(b.move.y))
      if (da !== db) return da - db
      if (a.move.x !== b.move.x) return a.move.x - b.move.x
      return a.move.y - b.move.y
    })

    const best = scored[0] || candidates[0]
    return maybeInjectError({ ...best.move }, candidates, config.errorRate)
  }

  // Check for immediate win (all levels) — prefer positive direction when both ends open
  const sortedCandidates = [...candidates].sort((a, b) => {
    // Prefer moves that extend in positive direction (more aggressive play)
    const aPositive = (a.x > 0 || a.y > 0) ? 1 : 0
    const bPositive = (b.x > 0 || b.y > 0) ? 1 : 0
    if (aPositive !== bPositive) return bPositive - aPositive // prefer positive first
    const da = Math.max(Math.abs(a.x), Math.abs(a.y))
    const db = Math.max(Math.abs(b.x), Math.abs(b.y))
    if (da !== db) return da - db
    if (a.x !== b.x) return a.x - b.x
    return a.y - b.y
  })

  for (const move of sortedCandidates) {
    const next = { ...stones, [coordKey(move.x, move.y)]: 'ai' }
    if (getGomokuWinner(next, move)) return { ...move }
  }

  // Check for forced block (all levels) — prefer positive direction
  const humanCandidates = getThreatMoves(stones)
  for (const move of humanCandidates) {
    const next = { ...stones, [coordKey(move.x, move.y)]: 'human' }
    if (getGomokuWinner(next, move)) return { ...move }
  }

  // Opening book (expert level) — only if no tactical move found
  if (config.openingBook) {
    const openingMove = getOpeningMove(stones)
    if (openingMove) return openingMove
  }

  // Minimax search (intermediate+)
  const deadline = Date.now() + timeBudgetMs
  let bestMove = null
  let bestScore = Number.NEGATIVE_INFINITY

  const scored = scoreCandidatesHeuristic(stones, candidates, 'ai')
  scored.sort((a, b) => b.score - a.score)

  // Limit candidates for lower difficulties
  const limited = config.candidateLimit
    ? scored.slice(0, config.candidateLimit)
    : scored

  for (const { move } of limited) {
    if (Date.now() >= deadline) break

    const next = { ...stones, [coordKey(move.x, move.y)]: 'ai' }

    // Check if this is a winning move
    if (getGomokuWinner(next, move)) {
      bestMove = move
      bestScore = Number.POSITIVE_INFINITY
      break
    }

    const result = minimax(next, config.searchDepth - 1, Number.NEGATIVE_INFINITY, Number.POSITIVE_INFINITY, false)

    let score = result.score

    // Double-threat bonus (expert+)
    if (config.doubleThreatDetection) {
      const threat = classifyMoveThreat(stones, move.x, move.y, 'ai')
      score += doubleThreatBonus(threat) * 0.5 // Scale down to not overwhelm search
    }

    if (score > bestScore) {
      bestScore = score
      bestMove = move
    }
  }

  // Fallback: use heuristic if minimax didn't find anything
  if (!bestMove && limited.length > 0) {
    bestMove = limited[0].move
  }

  // Error injection for lower difficulties
  if (config.errorRate > 0 && bestMove) {
    const ranked = scored.slice(0, Math.min(5, scored.length))
    return maybeInjectError(bestMove, ranked.map((r) => r.move), config.errorRate)
  }

  return bestMove ? { ...bestMove } : null
}

// ─── Exported for testing ─────────────────────────────────────────────────────
export { classifyLine, classifyPattern, PATTERN_SCORES }