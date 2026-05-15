// Inline Gomoku AI worker using Blob URL to avoid all path/proxy issues.
// Next.js with basePath: '/games' serves public/ files at the root of its server,
// not under basePath. This makes worker loading unreliable behind the gateway proxy.
// By inlining the worker code and creating a Blob URL, we avoid all path resolution issues.

const WORKER_CODE = `
// Dedicated Gomoku AI worker.
// Runs time-bounded Monte Carlo style search off the main UI thread.

const DIRECTIONS = [
  [1, 0],
  [0, 1],
  [1, 1],
  [1, -1],
]

function coordKey(x, y) {
  return \`\${x},\${y}\`
}

function parseCoordKey(key) {
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

function getClosestChebyshevDistance(stones, x, y) {
  const entries = Object.keys(stones)
  if (!entries.length) {
    return 0
  }

  let best = Number.POSITIVE_INFINITY
  for (const key of entries) {
    const point = parseCoordKey(key)
    if (!Number.isInteger(point.x) || !Number.isInteger(point.y)) {
      continue
    }
    const distance = Math.max(Math.abs(point.x - x), Math.abs(point.y - y))
    if (distance < best) {
      best = distance
    }
  }

  return best
}

function isGomokuMoveLegal(stones, x, y) {
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

function getGomokuWinner(stones, lastMove) {
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

function getCandidateMoves(stones, radius) {
  if (radius === undefined) radius = 1
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

function weightedRandomMove(rankedMoves) {
  if (!rankedMoves.length) {
    return null
  }

  const weights = rankedMoves.map((move) => Math.max(1, move.score + 1) ** 1.35)
  const total = weights.reduce((sum, value) => sum + value, 0)
  const roll = Math.random() * total

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
    const chosen = weightedRandomMove(ranked)
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

function chooseGomokuAIMove(stones, config) {
  if (config === undefined) config = {}
  const options = {
    timeBudgetMs: 2200,
    maxPlayouts: 9000,
    maxRolloutDepth: 14,
    candidateLimit: 24,
    rolloutCandidateLimit: 10,
    explorationConstant: 1.25,
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

// Expert AI using reward/points algorithm based on connection potential
function lineThreatScore(stones, x, y, player, dx, dy) {
  let sameCount = 0
  let opponentCount = 0
  let openEnds = 0

  for (let i = 1; i <= 5; i += 1) {
    const nx = x + dx * i
    const ny = y + dy * i
    const occupant = stones[coordKey(nx, ny)]
    if (occupant === player) {
      sameCount += 1
    } else if (occupant) {
      opponentCount += 1
      break
    } else if (i === 1 && isGomokuMoveLegal(stones, nx, ny)) {
      openEnds += 1
    }
  }

  let backSameCount = 0
  let backOpponentCount = 0
  let backOpenEnd = 0
  for (let i = 1; i <= 5; i += 1) {
    const nx = x - dx * i
    const ny = y - dy * i
    const occupant = stones[coordKey(nx, ny)]
    if (occupant === player) {
      backSameCount += 1
    } else if (occupant) {
      backOpponentCount += 1
      break
    } else if (i === 1 && isGomokuMoveLegal(stones, nx, ny)) {
      backOpenEnd += 1
    }
  }

  const totalConnected = sameCount + backSameCount + 1
  const blocked = (opponentCount > 0 ? 1 : 0) + (backOpponentCount > 0 ? 1 : 0)
  const openSides = 2 - blocked
  const isOpenThreats = openSides === 2

  let score = 0
  if (totalConnected >= 5) {
    score = 10000
  } else if (totalConnected === 4) {
    score = isOpenThreats ? 5000 : 2500
  } else if (totalConnected === 3) {
    score = isOpenThreats ? 1000 : 200
  } else if (totalConnected === 2) {
    score = isOpenThreats ? 100 : 20
  } else if (totalConnected === 1) {
    score = isOpenThreats ? 10 : 2
  }

  if (!isOpenThreats) {
    score = Math.floor(score * 0.4)
  }

  return score
}

function chooseGomokuAIMoveExpert(stones, config) {
  if (config === undefined) config = {}
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

  const scoredMoves = candidates.map((move) => {
    let score = 0

    for (const [dx, dy] of DIRECTIONS) {
      const aiScore = lineThreatScore(stones, move.x, move.y, 'ai', dx, dy)
      const humanScore = lineThreatScore(stones, move.x, move.y, 'human', dx, dy)

      score += aiScore * 1.2
      score += humanScore * 0.3
    }

    score += adjacencyScore(stones, move.x, move.y, 'ai') * 5

    return { x: move.x, y: move.y, score }
  })

  scoredMoves.sort((a, b) => b.score - a.score)

  if (scoredMoves.length === 0) {
    return null
  }

  return { x: scoredMoves[0].x, y: scoredMoves[0].y }
}

self.onmessage = (event) => {
  const payload = event.data || {}
  try {
    const difficulty = payload.difficulty || 'intermediate'
    let move
    if (difficulty === 'expert') {
      move = chooseGomokuAIMoveExpert(payload.stones || {}, payload.config || {})
    } else {
      move = chooseGomokuAIMove(payload.stones || {}, payload.config || {})
    }
    self.postMessage({
      jobId: payload.jobId,
      move,
    })
  } catch (error) {
    self.postMessage({
      jobId: payload.jobId,
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
  return new Worker(workerUrl)
}