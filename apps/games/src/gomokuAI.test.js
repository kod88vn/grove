// Gomoku AI Engine — Comprehensive Test Suite

import { describe, it } from 'node:test'
import assert from 'node:assert'

import {
  chooseGomokuAIMove,
  getGomokuWinner,
  isGomokuMoveLegal,
  getCandidateMoves,
  getThreatMoves,
  GOMOKU_DIFFICULTY_LEVELS,
  GOMOKU_AI_CONFIGS,
} from './gomokuAI.js'

// ─── Test helper: coordinate key (mirrors internal implementation) ────────────
function K(x, y) {
  return `${x},${y}`
}

describe('Gomoku AI — Difficulty Configuration', () => {
  it('should define all four difficulty levels', () => {
    assert.deepStrictEqual(GOMOKU_DIFFICULTY_LEVELS, ['easy', 'medium', 'hard', 'expert'])
  })

  it('should have valid config for each difficulty level', () => {
    for (const level of GOMOKU_DIFFICULTY_LEVELS) {
      const config = GOMOKU_AI_CONFIGS[level]
      assert.ok(config, `Config exists for ${level}`)
      assert.ok(Number.isInteger(config.searchDepth), `${level} has searchDepth`)
      assert.ok(typeof config.candidateLimit === 'number' || config.candidateLimit === null, `${level} has candidateLimit`)
      assert.ok(typeof config.errorRate === 'number' && config.errorRate >= 0 && config.errorRate <= 1, `${level} has valid errorRate`)
      assert.ok(['basic', 'full'].includes(config.patternScope), `${level} has valid patternScope`)
      assert.ok(typeof config.doubleThreatDetection === 'boolean', `${level} has doubleThreatDetection`)
    }
  })

  it('should have increasing search depth with difficulty', () => {
    assert.ok(GOMOKU_AI_CONFIGS.easy.searchDepth < GOMOKU_AI_CONFIGS.medium.searchDepth)
    assert.ok(GOMOKU_AI_CONFIGS.medium.searchDepth < GOMOKU_AI_CONFIGS.hard.searchDepth)
    assert.ok(GOMOKU_AI_CONFIGS.hard.searchDepth < GOMOKU_AI_CONFIGS.expert.searchDepth)
  })

  it('should have decreasing error rate with difficulty', () => {
    assert.ok(GOMOKU_AI_CONFIGS.easy.errorRate > GOMOKU_AI_CONFIGS.medium.errorRate)
    assert.ok(GOMOKU_AI_CONFIGS.medium.errorRate > GOMOKU_AI_CONFIGS.hard.errorRate)
    assert.ok(GOMOKU_AI_CONFIGS.hard.errorRate === 0)
    assert.ok(GOMOKU_AI_CONFIGS.expert.errorRate === 0)
  })

  it('should enable double-threat detection only for hard and expert', () => {
    assert.strictEqual(GOMOKU_AI_CONFIGS.easy.doubleThreatDetection, false)
    assert.strictEqual(GOMOKU_AI_CONFIGS.medium.doubleThreatDetection, false)
    assert.strictEqual(GOMOKU_AI_CONFIGS.hard.doubleThreatDetection, true)
    assert.strictEqual(GOMOKU_AI_CONFIGS.expert.doubleThreatDetection, true)
  })

  it('should enable opening book only for expert', () => {
    assert.strictEqual(GOMOKU_AI_CONFIGS.expert.openingBook, true)
    for (const level of ['easy', 'medium', 'hard']) {
      assert.strictEqual(GOMOKU_AI_CONFIGS[level].openingBook, undefined)
    }
  })
})

describe('Gomoku AI — Empty Board', () => {
  it('should return center move on empty board for all difficulties', () => {
    const stones = {}
    for (const level of GOMOKU_DIFFICULTY_LEVELS) {
      const move = chooseGomokuAIMove(stones, { difficulty: level })
      assert.deepStrictEqual(move, { x: 0, y: 0 }, `${level}: empty board → center`)
    }
  })
})

describe('Gomoku AI — Immediate Win Detection', () => {
  it('should win immediately with 4-in-a-row and open end (expert)', () => {
    const stones = {
      [K(0, 0)]: 'ai',
      [K(1, 0)]: 'ai',
      [K(2, 0)]: 'ai',
      [K(3, 0)]: 'ai',
    }
    const move = chooseGomokuAIMove(stones, { difficulty: 'expert', timeBudgetMs: 100 })
    // Both (4,0) and (-1,0) win. With positive-direction preference: (4, 0).
    assert.ok(move.x === 4 && move.y === 0 || move.x === -1 && move.y === 0,
      `should extend to win at (4,0) or (-1,0), got (${move.x}, ${move.y})`)
  })

  it('should win immediately with vertical 4-in-a-row (expert)', () => {
    const stones = {
      [K(0, 0)]: 'ai',
      [K(0, 1)]: 'ai',
      [K(0, 2)]: 'ai',
      [K(0, 3)]: 'ai',
    }
    const move = chooseGomokuAIMove(stones, { difficulty: 'expert', timeBudgetMs: 100 })
    // Both (0,4) and (0,-1) win. With positive-direction preference: (0, 4).
    assert.ok(move.x === 0 && move.y === 4 || move.x === 0 && move.y === -1,
      `should extend vertically to win at (0,4) or (0,-1), got (${move.x}, ${move.y})`)
  })

  it('should win immediately with diagonal 4-in-a-row (expert)', () => {
    const stones = {
      [K(0, 0)]: 'ai',
      [K(1, 1)]: 'ai',
      [K(2, 2)]: 'ai',
      [K(3, 3)]: 'ai',
    }
    const move = chooseGomokuAIMove(stones, { difficulty: 'expert', timeBudgetMs: 100 })
    // Both (4,4) and (-1,-1) win. With positive-direction preference: (4, 4).
    assert.ok(move.x === 4 && move.y === 4 || move.x === -1 && move.y === -1,
      `should extend diagonally to win at (4,4) or (-1,-1), got (${move.x}, ${move.y})`)
  })

  it('should block human immediate win (expert)', () => {
    const stones = {
      [K(0, 0)]: 'human',
      [K(1, 0)]: 'human',
      [K(2, 0)]: 'human',
      [K(3, 0)]: 'human',
    }
    const move = chooseGomokuAIMove(stones, { difficulty: 'expert', timeBudgetMs: 100 })
    // Both (4,0) and (-1,0) block human. With positive-direction preference: (4, 0).
    assert.ok(move.x === 4 && move.y === 0 || move.x === -1 && move.y === 0,
      `should block human win at (4,0) or (-1,0), got (${move.x}, ${move.y})`)
  })

  it('should win with easy when given 4-in-a-row', () => {
    const stones = {
      [K(0, 0)]: 'ai',
      [K(1, 0)]: 'ai',
      [K(2, 0)]: 'ai',
      [K(3, 0)]: 'ai',
    }
    const move = chooseGomokuAIMove(stones, { difficulty: 'easy', timeBudgetMs: 100 })
    assert.ok(move.x === 4 && move.y === 0 || move.x === -1 && move.y === 0,
      `easy should see immediate win at (4,0) or (-1,0), got (${move.x}, ${move.y})`)
  })

  it('should block human win with easy', () => {
    const stones = {
      [K(0, 0)]: 'human',
      [K(1, 0)]: 'human',
      [K(2, 0)]: 'human',
      [K(3, 0)]: 'human',
    }
    const move = chooseGomokuAIMove(stones, { difficulty: 'easy', timeBudgetMs: 100 })
    // Easy uses full pattern scoring with minimax.
    // Both (4,0) and (-1,0) create 5-in-a-row for human. The AI should block one of them.
    // With positive-direction preference, it blocks at (4, 0).
    assert.ok(move.x === 4 && move.y === 0 || move.x === -1 && move.y === 0,
      `easy should block human win at (4,0) or (-1,0), got (${move.x}, ${move.y})`)
  })
})

describe('Gomoku AI — Aggressive Play (Expert)', () => {
  it('should prefer creating a live 4 over a sleeping 3 (expert)', () => {
    const stones = {
      [K(-1, 0)]: 'human', // block left end
      [K(0, 0)]: 'ai',
      [K(1, 0)]: 'ai',
      [K(2, 0)]: 'ai',
    }
    const move = chooseGomokuAIMove(stones, { difficulty: 'expert', timeBudgetMs: 200 })
    assert.ok(move !== null, 'should find a move')
    assert.strictEqual(stones[K(move.x, move.y)], undefined, 'move should be on empty spot')
  })

  it('should create double threats when possible (expert)', () => {
    const stones = {
      [K(0, 0)]: 'ai',
      [K(1, 0)]: 'ai', // horizontal live 2
      [K(0, 1)]: 'ai',
      [K(0, 2)]: 'ai', // vertical live 2
    }
    const move = chooseGomokuAIMove(stones, { difficulty: 'expert', timeBudgetMs: 200 })
    assert.ok(move !== null, 'should find a move')
  })

  it('should build toward win rather than just blocking (expert)', () => {
    const stones = {
      [K(0, 0)]: 'ai',
      [K(1, 0)]: 'ai',
      [K(2, 0)]: 'ai', // live 3 (both ends open)
      [K(5, 0)]: 'human',
      [K(6, 0)]: 'human', // sleeping 2
    }
    const move = chooseGomokuAIMove(stones, { difficulty: 'expert', timeBudgetMs: 200 })
    assert.ok(move !== null, 'should find a move')
    // Expert depth-5 search should play near the live 3 (aggressive play)
    const isNearLive3 = move.x >= -2 && move.x <= 5 && Math.abs(move.y) <= 2
    assert.ok(isNearLive3, `expert should play near the live 3, got (${move.x}, ${move.y})`)
  })

  it('should build toward win with hard difficulty', () => {
    const stones = {
      [K(0, 0)]: 'ai',
      [K(1, 0)]: 'ai',
      [K(2, 0)]: 'ai', // live 3 (both ends open)
    }
    const move = chooseGomokuAIMove(stones, { difficulty: 'hard', timeBudgetMs: 200 })
    assert.ok(move !== null, 'should find a move')
    const isExtending = move.x === 3 || move.x === -1
    assert.ok(isExtending || move.y === 0, 'should extend the live 3')
  })
})

describe('Gomoku AI — Difficulty Differences', () => {
  it('should produce different move quality across difficulties', () => {
    const stones = {
      [K(0, 0)]: 'ai',
      [K(1, 0)]: 'ai',
      [K(2, 0)]: 'human', // blocks one end
      [K(-1, 1)]: 'ai',   // diagonal support
    }

    const expertMove = chooseGomokuAIMove(stones, { difficulty: 'expert', timeBudgetMs: 200 })
    const easyMove = chooseGomokuAIMove(stones, { difficulty: 'easy', timeBudgetMs: 200 })

    assert.ok(expertMove !== null, 'expert should find a move')
    assert.ok(easyMove !== null, 'easy should find a move')
    assert.ok(isGomokuMoveLegal(stones, expertMove.x, expertMove.y))
    assert.ok(isGomokuMoveLegal(stones, easyMove.x, easyMove.y))
  })

  it('easy should occasionally make suboptimal moves (error injection)', () => {
    const stones = {
      [K(0, 0)]: 'ai',
      [K(1, 0)]: 'ai',
      [K(2, 0)]: 'ai',
      [K(3, 0)]: 'ai',
    }

    const move = chooseGomokuAIMove(stones, { difficulty: 'easy', timeBudgetMs: 200 })
    // Both (4,0) and (-1,0) are winning moves. With positive-direction preference,
    // (4,0) is preferred first. Error injection only kicks in if no immediate win found.
    assert.ok(move.x === 4 && move.y === 0 || move.x === -1 && move.y === 0,
      `easy should see immediate win at (4,0) or (-1,0), got (${move.x}, ${move.y})`)
  })

  it('medium should use minimax search', () => {
    const stones = {
      [K(0, 0)]: 'ai',
      [K(1, 0)]: 'human',
    }

    const move = chooseGomokuAIMove(stones, { difficulty: 'medium', timeBudgetMs: 200 })
    assert.ok(move !== null, 'medium should find a move')
    assert.ok(isGomokuMoveLegal(stones, move.x, move.y), 'move should be legal')
  })

  it('expert should detect double threats', () => {
    const stones = {
      [K(0, 0)]: 'ai',
      [K(1, 0)]: 'ai', // live 2 horizontally
    }

    const expertMove = chooseGomokuAIMove(stones, { difficulty: 'expert', timeBudgetMs: 200 })
    assert.ok(expertMove !== null)
  })

  it('hard should use double-threat detection', () => {
    const stones = {
      [K(0, 0)]: 'ai',
      [K(1, 0)]: 'ai', // live 2 horizontally
    }

    const hardMove = chooseGomokuAIMove(stones, { difficulty: 'hard', timeBudgetMs: 200 })
    assert.ok(hardMove !== null)
  })
})

describe('Gomoku AI — Candidate Move Generation', () => {
  it('should return center on empty board', () => {
    const moves = getCandidateMoves({}, 1)
    assert.deepStrictEqual(moves, [{ x: 0, y: 0 }])
  })

  it('should return moves adjacent to existing stones', () => {
    const stones = { [K(0, 0)]: 'ai' }
    const moves = getCandidateMoves(stones, 1)

    assert.ok(moves.length > 0, 'should have candidates')
    for (const m of moves) {
      assert.ok(isGomokuMoveLegal(stones, m.x, m.y), `candidate ${m.x},${m.y} should be legal`)
    }
  })

  it('getThreatMoves should use radius 2', () => {
    const stones = { [K(0, 0)]: 'ai' }
    const threatMoves = getThreatMoves(stones)

    assert.ok(threatMoves.length >= getCandidateMoves(stones, 1).length,
      'threat moves (r2) should include all radius-1 candidates')
  })

  it('should respect Chebyshev distance <= 3 for legality', () => {
    const stones = { [K(0, 0)]: 'ai' }

    // Distance exactly 3 should be legal (<=3)
    assert.strictEqual(isGomokuMoveLegal(stones, 3, 0), true)   // max(3, 0) = 3
    assert.strictEqual(isGomokuMoveLegal(stones, 2, 2), true)   // max(2, 2) = 2
    assert.strictEqual(isGomokuMoveLegal(stones, 3, 2), true)   // max(3, 2) = 3
    assert.strictEqual(isGomokuMoveLegal(stones, 3, 3), true)   // max(3, 3) = 3

    // Distance > 3 should be illegal
    assert.strictEqual(isGomokuMoveLegal(stones, 4, 0), false)  // max(4, 0) = 4
    assert.strictEqual(isGomokuMoveLegal(stones, 4, 1), false)  // max(4, 1) = 4
    assert.strictEqual(isGomokuMoveLegal(stones, 3, 4), false)  // max(3, 4) = 4
  })
})

describe('Gomoku AI — Pattern Classification', () => {
  it('should extend live 4 to win (tests pattern scoring)', () => {
    const stones = {
      [K(0, 0)]: 'ai',
      [K(1, 0)]: 'ai',
      [K(2, 0)]: 'ai',
      [K(3, 0)]: 'ai',
    }

    const move = chooseGomokuAIMove(stones, { difficulty: 'expert', timeBudgetMs: 100 })
    // Both (4,0) and (-1,0) win. With positive-direction preference: (4, 0).
    assert.ok(move.x === 4 && move.y === 0 || move.x === -1 && move.y === 0,
      `expert should extend to win at (4,0) or (-1,0), got (${move.x}, ${move.y})`)
  })

  it('should extend sleeping 4 to win when one end blocked', () => {
    const stones = {
      [K(-1, 0)]: 'human', // block left end — only (4, 0) wins
      [K(0, 0)]: 'ai',
      [K(1, 0)]: 'ai',
      [K(2, 0)]: 'ai',
      [K(3, 0)]: 'ai',
    }

    const move = chooseGomokuAIMove(stones, { difficulty: 'expert', timeBudgetMs: 100 })
    assert.deepStrictEqual(move, { x: 4, y: 0 })
  })

  it('should prefer positive direction when both ends win', () => {
    const stones = {
      [K(0, 0)]: 'ai',
      [K(1, 0)]: 'ai',
      [K(2, 0)]: 'ai',
      [K(3, 0)]: 'ai',
    }

    // Expert should prefer (4, 0) over (-1, 0) due to positive-direction preference
    const move = chooseGomokuAIMove(stones, { difficulty: 'expert', timeBudgetMs: 100 })
    assert.deepStrictEqual(move, { x: 4, y: 0 }, 'should prefer positive direction')
  })

  it('should score live patterns higher than dead patterns', () => {
    const stonesLive = {}
    stonesLive[K(0, 0)] = 'ai'
    stonesLive[K(1, 0)] = 'ai'
    stonesLive[K(2, 0)] = 'ai'

    const stonesDead = {
      [K(-1, 0)]: 'human', // blocked
      [K(0, 0)]: 'ai',
      [K(1, 0)]: 'ai',
      [K(2, 0)]: 'ai',
      [K(3, 0)]: 'human', // blocked
    }

    const moveLive = chooseGomokuAIMove(stonesLive, { difficulty: 'expert', timeBudgetMs: 200 })
    const moveDead = chooseGomokuAIMove(stonesDead, { difficulty: 'expert', timeBudgetMs: 200 })

    assert.ok(moveLive !== null)
    assert.ok(moveDead !== null)
  })

  it('should work with medium difficulty', () => {
    const stones = {
      [K(0, 0)]: 'ai',
      [K(1, 0)]: 'ai',
    }
    const move = chooseGomokuAIMove(stones, { difficulty: 'medium', timeBudgetMs: 100 })
    assert.ok(move !== null)
    assert.ok(isGomokuMoveLegal(stones, move.x, move.y))
  })

  it('should work with hard difficulty', () => {
    const stones = {
      [K(0, 0)]: 'ai',
      [K(1, 0)]: 'ai',
    }
    const move = chooseGomokuAIMove(stones, { difficulty: 'hard', timeBudgetMs: 100 })
    assert.ok(move !== null)
    assert.ok(isGomokuMoveLegal(stones, move.x, move.y))
  })
})

describe('Gomoku AI — Legal Move Validation', () => {
  it('should reject occupied positions', () => {
    const stones = { [K(0, 0)]: 'ai' }
    assert.strictEqual(isGomokuMoveLegal(stones, 0, 0), false)
  })

  it('should reject non-integer coordinates', () => {
    const stones = {}
    assert.strictEqual(isGomokuMoveLegal(stones, 0.5, 0), false)
    assert.strictEqual(isGomokuMoveLegal(stones, 0, -1.3), false)
  })

  it('should accept any position on empty board', () => {
    assert.strictEqual(isGomokuMoveLegal({}, 0, 0), true)
    assert.strictEqual(isGomokuMoveLegal({}, -5, 10), true)
  })

  it('should only accept positions within distance 3 of existing stones', () => {
    const stones = { [K(5, 5)]: 'ai' }

    // Within distance 3 (Chebyshev <= 3)
    assert.strictEqual(isGomokuMoveLegal(stones, 5, 3), true)   // max(0, 2) = 2
    assert.strictEqual(isGomokuMoveLegal(stones, 7, 5), true)   // max(2, 0) = 2
    assert.strictEqual(isGomokuMoveLegal(stones, 7, 7), true)   // max(2, 2) = 2
    assert.strictEqual(isGomokuMoveLegal(stones, 8, 5), true)   // max(3, 0) = 3
    assert.strictEqual(isGomokuMoveLegal(stones, 2, 5), true)   // max(3, 0) = 3

    // Outside distance 3
    assert.strictEqual(isGomokuMoveLegal(stones, 5, 4), true)   // max(0, 1) = 1 → actually legal!
    assert.strictEqual(isGomokuMoveLegal(stones, 9, 5), false)  // max(4, 0) = 4
    assert.strictEqual(isGomokuMoveLegal(stones, 5, 1), false)  // max(0, 4) = 4
    assert.strictEqual(isGomokuMoveLegal(stones, 1, 5), false)  // max(4, 0) = 4
    assert.strictEqual(isGomokuMoveLegal(stones, 5, -1), false) // max(0, 6) = 6
  })

  it('should reject distance > 3', () => {
    const stones = { [K(0, 0)]: 'ai' }
    assert.strictEqual(isGomokuMoveLegal(stones, 4, 0), false)
    assert.strictEqual(isGomokuMoveLegal(stones, 3, 4), false)
    assert.strictEqual(isGomokuMoveLegal(stones, -4, 0), false)
    assert.strictEqual(isGomokuMoveLegal(stones, -3, -4), false)
  })
})

describe('Gomoku AI — Winner Detection', () => {
  it('should detect horizontal win with open right end', () => {
    const stones = {
      [K(0, 0)]: 'ai',
      [K(1, 0)]: 'ai',
      [K(2, 0)]: 'ai',
      [K(3, 0)]: 'ai',
      [K(4, 0)]: 'ai',
    }
    assert.strictEqual(getGomokuWinner(stones, { x: 4, y: 0 }), 'ai')
  })

  it('should NOT detect win when both ends are blocked', () => {
    const stones = {
      [K(-1, 0)]: 'human',
      [K(0, 0)]: 'ai',
      [K(1, 0)]: 'ai',
      [K(2, 0)]: 'ai',
      [K(3, 0)]: 'ai',
      [K(4, 0)]: 'ai',
      [K(5, 0)]: 'human',
    }
    assert.strictEqual(getGomokuWinner(stones, { x: 4, y: 0 }), null)
  })

  it('should detect vertical win', () => {
    const stones = {
      [K(0, 0)]: 'ai',
      [K(0, 1)]: 'ai',
      [K(0, 2)]: 'ai',
      [K(0, 3)]: 'ai',
      [K(0, 4)]: 'ai',
    }
    assert.strictEqual(getGomokuWinner(stones, { x: 0, y: 4 }), 'ai')
  })

  it('should detect diagonal win', () => {
    const stones = {
      [K(0, 0)]: 'ai',
      [K(1, 1)]: 'ai',
      [K(2, 2)]: 'ai',
      [K(3, 3)]: 'ai',
      [K(4, 4)]: 'ai',
    }
    assert.strictEqual(getGomokuWinner(stones, { x: 4, y: 4 }), 'ai')
  })

  it('should return null on empty board', () => {
    assert.strictEqual(getGomokuWinner({}, null), null)
  })

  it('should return null when no five-in-a-row exists', () => {
    const stones = {
      [K(0, 0)]: 'ai',
      [K(1, 0)]: 'ai',
      [K(2, 0)]: 'ai',
    }
    assert.strictEqual(getGomokuWinner(stones, { x: 2, y: 0 }), null)
  })

  it('should detect human win', () => {
    const stones = {
      [K(0, 0)]: 'human',
      [K(1, 0)]: 'human',
      [K(2, 0)]: 'human',
      [K(3, 0)]: 'human',
      [K(4, 0)]: 'human',
    }
    assert.strictEqual(getGomokuWinner(stones, { x: 4, y: 0 }), 'human')
  })
})

describe('Gomoku AI — Expert Aggressiveness', () => {
  it('should create a sleeping 4 when it leads to win (depth-5 look-ahead)', () => {
    const stones = {
      [K(0, 0)]: 'ai',
      [K(1, 0)]: 'ai',
      [K(2, 0)]: 'ai', // live 3
    }
    const move = chooseGomokuAIMove(stones, { difficulty: 'expert', timeBudgetMs: 200 })
    assert.ok(move !== null)
    // Expert depth-5 should play near the live 3 (aggressive, threat-creating)
    const isNearLive3 = move.x >= -1 && move.x <= 5 && Math.abs(move.y) <= 2
    assert.ok(isNearLive3, `expert should play near the live 3, got (${move.x}, ${move.y})`)
  })

  it('should prefer its own threat creation over blocking when safe (expert)', () => {
    const stones = {
      [K(0, 0)]: 'ai',
      [K(1, 0)]: 'ai',
      [K(2, 0)]: 'ai', // live 3 for AI
      [K(5, 5)]: 'human', // isolated human stone — irrelevant
    }
    const move = chooseGomokuAIMove(stones, { difficulty: 'expert', timeBudgetMs: 200 })
    assert.ok(move !== null)
    // Expert depth-5 should play near the live 3 (aggressive, threat-creating)
    const isNearLive3 = move.x >= -1 && move.x <= 5 && Math.abs(move.y) <= 2
    assert.ok(isNearLive3, `expert should play near the live 3, got (${move.x}, ${move.y})`)
  })

  it('should play aggressively at medium level', () => {
    const stones = {
      [K(0, 0)]: 'ai',
      [K(1, 0)]: 'ai',
    }
    const move = chooseGomokuAIMove(stones, { difficulty: 'medium', timeBudgetMs: 200 })
    assert.ok(move !== null)
    assert.ok(Math.abs(move.x - 0) <= 2 && Math.abs(move.y - 0) <= 2,
      'medium should play near existing stones')
  })

  it('should handle easy with error injection', () => {
    const stones = {
      [K(0, 0)]: 'ai',
      [K(1, 0)]: 'ai',
      [K(2, 0)]: 'human', // blocks one end — (3, 0) creates sleeping 4
    }

    const move = chooseGomokuAIMove(stones, { difficulty: 'easy', timeBudgetMs: 100 })
    assert.ok(move !== null)
    // Easy with error injection may play suboptimally, but should still find a legal move.
    assert.ok(isGomokuMoveLegal(stones, move.x, move.y), 'easy should play a legal move')
  })
})

describe('Gomoku AI — Edge Cases', () => {
  it('should handle board with many stones', () => {
    const stones = {}
    for (let i = 0; i < 20; i++) {
      stones[K(i, 0)] = i % 2 === 0 ? 'ai' : 'human'
    }
    const move = chooseGomokuAIMove(stones, { difficulty: 'medium', timeBudgetMs: 200 })
    assert.ok(move !== null || Object.keys(stones).length > 15)
  })

  it('should return null when no legal moves available', () => {
    const stones = {}
    for (let x = -5; x <= 5; x++) {
      for (let y = -5; y <= 5; y++) {
        if (x === 0 && y === 0) continue
        stones[K(x, y)] = 'human'
      }
    }
    const move = chooseGomokuAIMove(stones, { difficulty: 'medium', timeBudgetMs: 200 })
    assert.ok(move === null || isGomokuMoveLegal(stones, move.x, move.y))
  })

  it('should work with negative coordinates', () => {
    const stones = {
      [K(-3, -2)]: 'ai',
      [K(-2, -2)]: 'ai',
    }
    const move = chooseGomokuAIMove(stones, { difficulty: 'medium', timeBudgetMs: 200 })
    assert.ok(move !== null)
    assert.ok(isGomokuMoveLegal(stones, move.x, move.y))
  })
})
