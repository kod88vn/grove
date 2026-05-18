// Dedicated Gomoku AI worker — inlined AI engine to avoid Blob URL import issues.
// Runs time-bounded minimax search off the main UI thread via Blob URL.

const WORKER_CODE = `
// ─── Direction vectors ────────────────────────────────────────────────────────

const DIRECTIONS = [
  [1, 0],   // horizontal
  [0, 1],   // vertical
  [1, 1],   // diagonal down-right
  [1, -1],  // diagonal up-right
]

// ─── Coordinate helpers ───────────────────────────────────────────────────────

function coordKey(x, y) {
  return x + ',' + y
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

function getClosestChebyshevDistance(stones, x, y) {
  const entries = Object.keys(stones)
  if (!entries.length) return 0
  let best = Number.POSITIVE_INFINITY
  for (const key of entries) {
    const parts = key.split(',')
    const p = { x: Number(parts[0]), y: Number(parts[1]) }
    if (!Number.isInteger(p.x) || !Number.isInteger(p.y)) continue
    const d = Math.max(Math.abs(p.x - x), Math.abs(p.y - y))
    if (d < best) best = d
  }
  return best
}

function isGomokuMoveLegal(stones, x, y) {
  if (!Number.isInteger(x) || !Number.isInteger(y)) return false
  if (stones[coordKey(x, y)]) return false
  if (!Object.keys(stones).length) return true
  return getClosestChebyshevDistance(stones, x, y) <= 3
}

function getGomokuWinner(stones, lastMove) {
  if (!Object.keys(stones).length) return null

  const pointsToCheck = lastMove ? [lastMove] : Object.keys(stones).map(k => {
    const parts = k.split(',')
    return { x: Number(parts[0]), y: Number(parts[1]) }
  })

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

function getCandidateMoves(stones, radius) {
  if (radius === undefined) radius = 1
  if (!Object.keys(stones).length) return [{ x: 0, y: 0 }]

  const candidates = new Set()
  for (const key of Object.keys(stones)) {
    const parts = key.split(',')
    const x = Number(parts[0])
    const y = Number(parts[1])
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
  return Array.from(candidates).map(k => {
    const parts = k.split(',')
    return { x: Number(parts[0]), y: Number(parts[1]) }
  })
}

function getThreatMoves(stones) {
  return getCandidateMoves(stones, 2)
}

// ─── Pattern Library ──────────────────────────────────────────────────────────

function classifyLine(stones, x, y, player, dx, dy) {
  let fwdCount = 0
  let fx = x + dx, fy = y + dy
  while (stones[coordKey(fx, fy)] === player) {
    fwdCount += 1
    fx += dx
    fy += dy
  }

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

function getPatternsAt(stones, x, y, player) {
  return DIRECTIONS.map(([dx, dy]) => {
    const line = classifyLine(stones, x, y, player, dx, dy)
    return classifyPattern(line.connected, line.openStart, line.openEnd)
  })
}

function countPatterns(patterns, type) {
  return patterns.filter((p) => p === type).length
}

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

function detectDoubleThreat(moveThreat) {
  const { live4, sleep4, live3, sleep3 } = moveThreat

  const hasFour = live4 + sleep4 > 0
  const hasThree = live3 + sleep3 > 0

  const totalFours = live4 + sleep4
  const totalThrees = live3 + sleep3

  return {
    fourThree: hasFour && hasThree,
    doubleFour: totalFours >= 2,
    tripleThree: totalThrees >= 3,
    threatCount: totalFours + totalThrees,
  }
}

// ─── Board Evaluation ─────────────────────────────────────────────────────────

function evaluateBoard(stones, playerToEval) {
  const opponent = playerToEval === 'ai' ? 'human' : 'ai'

  let aiScore = 0
  let humanScore = 0

  for (const key of Object.keys(stones)) {
    const parts = key.split(',')
    const x = Number(parts[0])
    const y = Number(parts[1])
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

  if (playerToEval === 'ai') {
    return aiScore - humanScore
  }
  return humanScore - aiScore
}

// ─── Candidate Scoring Heuristic ──────────────────────────────────────────────

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
    const offThreat = classifyMoveThreat(stones, move.x, move.y, player)
    let offScore = 0
    for (const p of offThreat.patterns) {
      offScore += PATTERN_SCORES[p] || 0
    }

    const defThreat = classifyMoveThreat(stones, move.x, move.y, opponent)
    let defScore = 0
    for (const p of defThreat.patterns) {
      defScore += PATTERN_SCORES[p] || 0
    }

    const adjacency = adjacencyScore(stones, move.x, move.y, player)
    const total = offScore * 1.2 + defScore * 0.5 + adjacency * 3

    return { move, score: total }
  })
}

// ─── Threat Scanner: find all positions where a player has 4+ in a row or live 3 ──
//
// These are "game-ending" threats that must be responded to immediately.

function scanBoardThreats(stones, player) {
  const live4Positions = []
  const sleep4Positions = []
  const live3Positions = []

  for (const key of Object.keys(stones)) {
    const parts = key.split(',')
    const x = Number(parts[0])
    const y = Number(parts[1])
    if (!Number.isInteger(x) || !Number.isInteger(y)) continue
    if (stones[key] !== player) continue

    for (const [dx, dy] of DIRECTIONS) {
      const line = classifyLine(stones, x, y, player, dx, dy)
      const pattern = classifyPattern(line.connected, line.openStart, line.openEnd)

      if (pattern === 'live4' || pattern === 'sleep4') {
        // Compute the actual endpoints of the line segment by re-counting.
        let fwdCount = 0, fx = x + dx, fy = y + dy
        while (stones[coordKey(fx, fy)] === player) { fwdCount += 1; fx += dx; fy += dy }
        let bwdCount = 0, bx = x - dx, by = y - dy
        while (stones[coordKey(bx, by)] === player) { bwdCount += 1; bx -= dx; by -= dy }

        // True endpoints: (bx,by) is the first empty before, (fx,fy) is the first empty after
        if (line.openStart) {
          const ep = { x: bx, y: by }
          const exists = [...live4Positions, ...sleep4Positions].some(
            (p) => p.x === ep.x && p.y === ep.y
          )
          if (!exists) {
            if (pattern === 'live4') live4Positions.push(ep)
            else sleep4Positions.push(ep)
          }
        }
        if (line.openEnd) {
          const ep = { x: fx, y: fy }
          const exists = [...live4Positions, ...sleep4Positions].some(
            (p) => p.x === ep.x && p.y === ep.y
          )
          if (!exists) {
            if (pattern === 'live4') live4Positions.push(ep)
            else sleep4Positions.push(ep)
          }
        }
      }

      if (pattern === 'live3') {
        // Compute the actual endpoints of the line segment.
        let fwdCount = 0, fx = x + dx, fy = y + dy
        while (stones[coordKey(fx, fy)] === player) { fwdCount += 1; fx += dx; fy += dy }
        let bwdCount = 0, bx = x - dx, by = y - dy
        while (stones[coordKey(bx, by)] === player) { bwdCount += 1; bx -= dx; by -= dy }

        // True endpoints: (bx,by) is the first empty before, (fx,fy) is the first empty after
        if (line.openStart) {
          const ep = { x: bx, y: by }
          const exists = live3Positions.some((p) => p.x === ep.x && p.y === ep.y)
          if (!exists) live3Positions.push(ep)
        }
        if (line.openEnd) {
          const ep = { x: fx, y: fy }
          const exists = live3Positions.some((p) => p.x === ep.x && p.y === ep.y)
          if (!exists) live3Positions.push(ep)
        }
      }
    }
  }

  return { live4Positions, sleep4Positions, live3Positions }
}

function positionCreatesThreat(stones, x, y, player) {
  const next = { ...stones, [coordKey(x, y)]: player }
  for (const [dx, dy] of DIRECTIONS) {
    const line = classifyLine(next, x, y, player, dx, dy)
    const pattern = classifyPattern(line.connected, line.openStart, line.openEnd)
    if (pattern === 'live4' || pattern === 'sleep4' || pattern === 'live3') {
      return pattern
    }
  }
  return null
}

// ─── Double-Threat Bonus ──────────────────────────────────────────────────────

function doubleThreatBonus(moveThreat) {
  const dt = detectDoubleThreat(moveThreat)
  let bonus = 0

  if (dt.fourThree) bonus += 25000
  if (dt.doubleFour) bonus += 50000
  if (dt.tripleThree) bonus += 30000

  return bonus
}

// ─── Minimax with Alpha-Beta Pruning ──────────────────────────────────────────

function minimax(stones, depth, alpha, beta, isMaximizing) {
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
      if (beta <= alpha) break
    }

    return { score: bestScore, bestMove }
  } else {
    let bestScore = Number.POSITIVE_INFINITY
    let bestMove = null

    const scored = scoreCandidatesHeuristic(stones, candidates, 'human')
    scored.sort((a, b) => a.score - b.score)

    for (const move of scored.map((s) => s.move)) {
      const next = { ...stones, [coordKey(move.x, move.y)]: 'human' }
      const result = minimax(next, depth - 1, alpha, beta, true)

      if (result.score < bestScore) {
        bestScore = result.score
        bestMove = move
      }
      beta = Math.min(beta, bestScore)
      if (beta <= alpha) break
    }

    return { score: bestScore, bestMove }
  }
}

// ─── Difficulty Configuration ─────────────────────────────────────────────────

const GOMOKU_AI_CONFIGS = {
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
    openingBook: true,
    endgameSolver: true,
  },
}

// ─── Opening Book ─────────────────────────────────────────────────────────────

const OPENING_BOOK = [
  { x: 0, y: 0 },
  { x: 1, y: 1 },
  { x: 2, y: 1 },
  { x: 1, y: 2 },
]

function getOpeningMove(stones) {
  const count = Object.keys(stones).length
  if (count >= OPENING_BOOK.length * 2) return null

  const idx = Math.floor(count / 2)
  if (idx < OPENING_BOOK.length) {
    return { ...OPENING_BOOK[idx] }
  }
  return null
}

// ─── Error Injection ──────────────────────────────────────────────────────────

function maybeInjectError(bestMove, candidates, errorRate) {
  if (errorRate <= 0 || !bestMove) return bestMove

  if (Math.random() < errorRate && candidates.length > 1) {
    const poolSize = Math.min(5, candidates.length)
    const topCandidates = candidates.slice(0, poolSize)
    return topCandidates[Math.floor(Math.random() * poolSize)]
  }

  return bestMove
}

// ─── Basic Pattern Scope (Beginner) ──────────────────────────────────────────

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

function chooseGomokuAIMove(stones, options) {
  const difficulty = (options && options.difficulty) || 'expert'
  const config = GOMOKU_AI_CONFIGS[difficulty] || GOMOKU_AI_CONFIGS.expert
  // Map legacy difficulty names to new ones for backward compatibility
  const _LEGACY_MAP = { beginner: 'easy', intermediate: 'medium', master: 'expert' }
  const resolved = _LEGACY_MAP[difficulty] || difficulty
  const resolvedConfig = GOMOKU_AI_CONFIGS[resolved] || GOMOKU_AI_CONFIGS[difficulty] || GOMOKU_AI_CONFIGS.expert
  const timeBudgetMs = (options && options.timeBudgetMs) || 2000

  // Empty board: play center
  if (!Object.keys(stones).length) {
    return { x: 0, y: 0 }
  }

  const candidates = getThreatMoves(stones)
  if (!candidates.length) return null

  // Basic pattern scope is no longer used; all levels use full minimax search now.
  if (false) {
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
    const aPositive = (a.x > 0 || a.y > 0) ? 1 : 0
    const bPositive = (b.x > 0 || b.y > 0) ? 1 : 0
    if (aPositive !== bPositive) return bPositive - aPositive
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

  // ── Check for human threats that must be blocked (all levels) ──
  // Priority: live4 > sleep4 > live3 (these are game-ending threats)

  const humanThreats = scanBoardThreats(stones, 'human')

  // Block live 4 first (unblockable if not blocked)
  for (const threatPos of humanThreats.live4Positions) {
    const next = { ...stones, [coordKey(threatPos.x, threatPos.y)]: 'human' }
    const threat = positionCreatesThreat(stones, threatPos.x, threatPos.y, 'human')
    if (threat === 'live4' || threat === 'sleep4' || getGomokuWinner(next, threatPos)) {
      return { ...threatPos }
    }
  }

  // Block sleeping 4 (one end open → AI must block that end)
  for (const threatPos of humanThreats.sleep4Positions) {
    const next = { ...stones, [coordKey(threatPos.x, threatPos.y)]: 'human' }
    const threat = positionCreatesThreat(stones, threatPos.x, threatPos.y, 'human')
    if (threat === 'live4' || threat === 'sleep4' || getGomokuWinner(next, threatPos)) {
      return { ...threatPos }
    }
  }

  // Block live 3 (becomes unblockable live 4 if not blocked)
  for (const threatPos of humanThreats.live3Positions) {
    const next = { ...stones, [coordKey(threatPos.x, threatPos.y)]: 'human' }
    const threat = positionCreatesThreat(stones, threatPos.x, threatPos.y, 'human')
    if (threat === 'live3' || getGomokuWinner(next, threatPos)) {
      return { ...threatPos }
    }
  }

  // Check for forced block (all levels) — prefer positive direction
  const humanCandidates = getThreatMoves(stones)
  for (const move of humanCandidates) {
    const next = { ...stones, [coordKey(move.x, move.y)]: 'human' }
    if (getGomokuWinner(next, move)) return { ...move }
  }

  // Minimax search (intermediate+)
  const deadline = Date.now() + timeBudgetMs
  let bestMove = null
  let bestScore = Number.NEGATIVE_INFINITY

  const scored = scoreCandidatesHeuristic(stones, candidates, 'ai')
  scored.sort((a, b) => b.score - a.score)

  const limited = scored

  for (const { move } of limited) {
    if (Date.now() >= deadline) break

    const next = { ...stones, [coordKey(move.x, move.y)]: 'ai' }

    if (getGomokuWinner(next, move)) {
      bestMove = move
      bestScore = Number.POSITIVE_INFINITY
      break
    }

    const result = minimax(next, config.searchDepth - 1, Number.NEGATIVE_INFINITY, Number.POSITIVE_INFINITY, false)

    let score = result.score

    if (config.doubleThreatDetection) {
      const threat = classifyMoveThreat(stones, move.x, move.y, 'ai')
      score += doubleThreatBonus(threat) * 0.5
    }

    if (score > bestScore) {
      bestScore = score
      bestMove = move
    }
  }

  if (!bestMove && limited.length > 0) {
    bestMove = limited[0].move
  }

  if (config.errorRate > 0 && bestMove) {
    const ranked = scored.slice(0, Math.min(5, scored.length))
    return maybeInjectError(bestMove, ranked.map((r) => r.move), config.errorRate)
  }

  return bestMove ? { ...bestMove } : null
}

// ─── Worker entry point ──────────────────────────────────────────────────────

self.onmessage = (event) => {
  const payload = event.data || {}
  try {
    // Accept both { difficulty: 'easy' } and { config: { searchDepth, ... }, difficulty: 'easy' }
    let difficulty = payload.difficulty || 'expert'

    // Map legacy difficulty names to new ones for backward compatibility
    const _LEGACY_MAP = { beginner: 'easy', intermediate: 'medium', master: 'expert' }
    if (_LEGACY_MAP[difficulty]) difficulty = _LEGACY_MAP[difficulty]
    const configOverride = payload.config

    if (configOverride && typeof configOverride === 'object') {
      // Merge config into GOMOKU_AI_CONFIGS for this difficulty
      if (!GOMOKU_AI_CONFIGS[difficulty]) {
        GOMOKU_AI_CONFIGS[difficulty] = {}
      }
      Object.assign(GOMOKU_AI_CONFIGS[difficulty], configOverride)
    }

    const move = chooseGomokuAIMove(payload.stones || {}, {
      difficulty,
      timeBudgetMs: payload.timeBudgetMs || 2000,
    })

    self.postMessage({
      jobId: payload.jobId,
      roundId: payload.roundId,
      move,
    })
  } catch (error) {
    self.postMessage({
      jobId: payload.jobId,
      roundId: payload.roundId,
      error: error instanceof Error ? error.message : String(error),
      move: null,
    })
  }
}
`

/**
 * Build a Worker instance using an inline Blob URL.
 * This avoids all path/proxy issues since the worker code is embedded in the bundle.
 */
export function createWorker(pathname) {
  if (typeof Worker === 'undefined') {
    return null
  }

  const blob = new Blob([WORKER_CODE], { type: 'application/javascript' })
  const workerUrl = URL.createObjectURL(blob)
  return new Worker(workerUrl, { type: 'classic' })
}