// Gomoku AI — Threat Detection Test Suite
// Verifies AI responds immediately to human threats (4-in-a-row, live 3) at all difficulty levels.

import { describe, it } from 'node:test'
import assert from 'node:assert'

import {
  chooseGomokuAIMove,
  getGomokuWinner,
} from './gomokuAI.js'

function K(x, y) {
  return `${x},${y}`
}

describe('Gomoku AI — Human Live 4 Detection (all levels)', () => {
  // Live 4 = 4 in a row with BOTH ends open → becomes 5 on next move
  // AI must block immediately at ALL difficulty levels

  const stones = {
    [K(0, 0)]: 'human',
    [K(1, 0)]: 'human',
    [K(2, 0)]: 'human',
    [K(3, 0)]: 'human',
  }

  for (const level of ['easy', 'medium', 'hard', 'expert']) {
    it(`[${level}] should block human live 4 (horizontal)`, () => {
      const move = chooseGomokuAIMove(stones, { difficulty: level, timeBudgetMs: 100 })
      assert.ok(move !== null, `${level} should find a move`)
      // Should block at (4,0) or (-1,0) — both extend to 5
      const isBlockingMove = (move.x === 4 && move.y === 0) || (move.x === -1 && move.y === 0)
      assert.ok(isBlockingMove, `[${level}] should block at (4,0) or (-1,0), got (${move.x}, ${move.y})`)
    })

    it(`[${level}] should block human live 4 (vertical)`, () => {
      const vertStones = {
        [K(0, 0)]: 'human',
        [K(0, 1)]: 'human',
        [K(0, 2)]: 'human',
        [K(0, 3)]: 'human',
      }
      const move = chooseGomokuAIMove(vertStones, { difficulty: level, timeBudgetMs: 100 })
      assert.ok(move !== null, `${level} should find a move`)
      const isBlockingMove = (move.x === 0 && move.y === 4) || (move.x === 0 && move.y === -1)
      assert.ok(isBlockingMove, `[${level}] should block vertical live 4`)
    })

    it(`[${level}] should block human live 4 (diagonal)`, () => {
      const diagStones = {
        [K(0, 0)]: 'human',
        [K(1, 1)]: 'human',
        [K(2, 2)]: 'human',
        [K(3, 3)]: 'human',
      }
      const move = chooseGomokuAIMove(diagStones, { difficulty: level, timeBudgetMs: 100 })
      assert.ok(move !== null, `${level} should find a move`)
      const isBlockingMove = (move.x === 4 && move.y === 4) || (move.x === -1 && move.y === -1)
      assert.ok(isBlockingMove, `[${level}] should block diagonal live 4`)
    })
  }
})

describe('Gomoku AI — Human Sleeping 4 Detection (all levels)', () => {
  // Sleeping 4 = 4 in a row with ONE end open → AI must block the open end
  // The blocked end is blocked by an opponent (AI) stone

  // Left end blocked by AI stone at (-1,0), right end open at (4,0)
  const stonesLeftBlocked = {
    [K(-1, 0)]: 'ai', // left end blocked by AI stone
    [K(0, 0)]: 'human',
    [K(1, 0)]: 'human',
    [K(2, 0)]: 'human',
    [K(3, 0)]: 'human',
  }

  for (const level of ['easy', 'medium', 'hard', 'expert']) {
    it(`[${level}] should block human sleeping 4 (left end blocked by AI)`, () => {
      // Only (4,0) is the winning extension — (-1,0) is already blocked by AI
      const move = chooseGomokuAIMove(stonesLeftBlocked, { difficulty: level, timeBudgetMs: 100 })
      assert.ok(move !== null, `${level} should find a move`)
      // AI must block at (4,0) — the only open end that creates 5
      assert.ok(move.x === 4 && move.y === 0, `[${level}] should block at (4,0), got (${move.x}, ${move.y})`)
    })

    it(`[${level}] should block human sleeping 4 (right end blocked by AI)`, () => {
      const rightBlocked = {
        [K(0, 0)]: 'human',
        [K(1, 0)]: 'human',
        [K(2, 0)]: 'human',
        [K(3, 0)]: 'human',
        [K(4, 0)]: 'ai', // right end blocked by AI stone
      }
      const move = chooseGomokuAIMove(rightBlocked, { difficulty: level, timeBudgetMs: 100 })
      assert.ok(move !== null, `${level} should find a move`)
      // AI must block at (-1,0) — the only open end that creates 5
      assert.ok(move.x === -1 && move.y === 0, `[${level}] should block at (-1,0), got (${move.x}, ${move.y})`)
    })

    it(`[${level}] should block human sleeping 4 (vertical)`, () => {
      const vertStones = {
        [K(0, -1)]: 'ai', // top end blocked by AI stone
        [K(0, 0)]: 'human',
        [K(0, 1)]: 'human',
        [K(0, 2)]: 'human',
        [K(0, 3)]: 'human',
      }
      const move = chooseGomokuAIMove(vertStones, { difficulty: level, timeBudgetMs: 100 })
      assert.ok(move !== null, `${level} should find a move`)
      // AI must block at (0,4) — the only open end that creates 5
      assert.ok(move.x === 0 && move.y === 4, `[${level}] should block vertical sleeping 4 at (0,4), got (${move.x}, ${move.y})`)
    })

    it(`[${level}] should block human sleeping 4 (diagonal)`, () => {
      const diagStones = {
        [K(-1, -1)]: 'ai', // bottom-left end blocked by AI stone
        [K(0, 0)]: 'human',
        [K(1, 1)]: 'human',
        [K(2, 2)]: 'human',
        [K(3, 3)]: 'human',
      }
      const move = chooseGomokuAIMove(diagStones, { difficulty: level, timeBudgetMs: 100 })
      assert.ok(move !== null, `${level} should find a move`)
      // AI must block at (4,4) — the only open end that creates 5
      assert.ok(move.x === 4 && move.y === 4, `[${level}] should block diagonal sleeping 4 at (4,4), got (${move.x}, ${move.y})`)
    })
  }
})

describe('Gomoku AI — Human Live 3 Detection (all levels)', () => {
  // Live 3 = 3 in a row with BOTH ends open → becomes live 4 on next move
  // AI must block before it becomes a live 4 (which is essentially unblockable)

  const stones = {
    [K(0, 0)]: 'human',
    [K(1, 0)]: 'human',
    [K(2, 0)]: 'human',
  }

  for (const level of ['easy', 'medium', 'hard', 'expert']) {
    it(`[${level}] should block human live 3 (horizontal)`, () => {
      const move = chooseGomokuAIMove(stones, { difficulty: level, timeBudgetMs: 100 })
      assert.ok(move !== null, `${level} should find a move`)
      // Should block at (3,0) or (-1,0) — both extend to live 4
      const isBlockingMove = (move.x === 3 && move.y === 0) || (move.x === -1 && move.y === 0)
      assert.ok(isBlockingMove, `[${level}] should block live 3 at (3,0) or (-1,0), got (${move.x}, ${move.y})`)
    })

    it(`[${level}] should block human live 3 (vertical)`, () => {
      const vertStones = {
        [K(0, 0)]: 'human',
        [K(0, 1)]: 'human',
        [K(0, 2)]: 'human',
      }
      const move = chooseGomokuAIMove(vertStones, { difficulty: level, timeBudgetMs: 100 })
      assert.ok(move !== null, `${level} should find a move`)
      const isBlockingMove = (move.x === 0 && move.y === 3) || (move.x === 0 && move.y === -1)
      assert.ok(isBlockingMove, `[${level}] should block vertical live 3`)
    })

    it(`[${level}] should block human live 3 (diagonal)`, () => {
      const diagStones = {
        [K(0, 0)]: 'human',
        [K(1, 1)]: 'human',
        [K(2, 2)]: 'human',
      }
      const move = chooseGomokuAIMove(diagStones, { difficulty: level, timeBudgetMs: 100 })
      assert.ok(move !== null, `${level} should find a move`)
      const isBlockingMove = (move.x === 3 && move.y === 3) || (move.x === -1 && move.y === -1)
      assert.ok(isBlockingMove, `[${level}] should block diagonal live 3 at (3,3) or (-1,-1), got (${move.x}, ${move.y})`)
    })
  }
})

describe('Gomoku AI — Threat Priority (all levels)', () => {
  // When human has both a live 4 AND a live 3, AI should block the live 4 first
  // (live 4 is more urgent — it becomes 5 on the next move)

  const stones = {
    // Live 4 threat at (0,0)-(3,0)
    [K(0, 0)]: 'human',
    [K(1, 0)]: 'human',
    [K(2, 0)]: 'human',
    [K(3, 0)]: 'human',
    // Live 3 threat at (5,0)-(7,0)
    [K(5, 0)]: 'human',
    [K(6, 0)]: 'human',
    [K(7, 0)]: 'human',
  }

  for (const level of ['easy', 'medium', 'hard', 'expert']) {
    it(`[${level}] should prioritize blocking live 4 over live 3`, () => {
      const move = chooseGomokuAIMove(stones, { difficulty: level, timeBudgetMs: 100 })
      assert.ok(move !== null, `${level} should find a move`)
      // Should block the live 4 at (4,0) or (-1,0), NOT the live 3
      const blocksLive4 = (move.x === 4 && move.y === 0) || (move.x === -1 && move.y === 0)
      assert.ok(blocksLive4, `[${level}] should block live 4 first, got (${move.x}, ${move.y})`)
    })
  }
})

describe('Gomoku AI — Multiple Live 3 Threats (hard/expert)', () => {
  // When human has TWO live 3s, AI can only block one.
  // At hard/expert level, AI should recognize this as a double-threat situation.

  const stones = {
    [K(0, 0)]: 'human',
    [K(1, 0)]: 'human',
    [K(2, 0)]: 'human', // live 3 at row 0
    [K(5, 2)]: 'human',
    [K(6, 2)]: 'human',
    [K(7, 2)]: 'human', // live 3 at row 2
  }

  for (const level of ['hard', 'expert']) {
    it(`[${level}] should block one of the live 3s`, () => {
      const move = chooseGomokuAIMove(stones, { difficulty: level, timeBudgetMs: 200 })
      assert.ok(move !== null, `${level} should find a move`)
      // Should block at least one of the live 3s
      const blocksFirstLive3 = (move.x === 3 && move.y === 0) || (move.x === -1 && move.y === 0)
      const blocksSecondLive3 = (move.x === 8 && move.y === 2) || (move.x === 4 && move.y === 2)
      assert.ok(blocksFirstLive3 || blocksSecondLive3, `[${level}] should block one of the live 3s`)
    })
  }
})

describe('Gomoku AI — AI Own Threats (all levels)', () => {
  // When AI has a live 4 or live 3, it should extend to win or create double threats

  const stones = {
    [K(0, 0)]: 'ai',
    [K(1, 0)]: 'ai',
    [K(2, 0)]: 'ai',
    [K(3, 0)]: 'ai',
  }

  for (const level of ['easy', 'medium', 'hard', 'expert']) {
    it(`[${level}] should extend own live 4 to win`, () => {
      const move = chooseGomokuAIMove(stones, { difficulty: level, timeBudgetMs: 100 })
      assert.ok(move !== null, `${level} should find a move`)
      const isWinningMove = (move.x === 4 && move.y === 0) || (move.x === -1 && move.y === 0)
      assert.ok(isWinningMove, `[${level}] should extend live 4 to win`)
    })
  }

  const aiLive3Stones = {
    [K(0, 0)]: 'ai',
    [K(1, 0)]: 'ai',
    [K(2, 0)]: 'ai',
  }

  for (const level of ['easy', 'medium', 'hard', 'expert']) {
    it(`[${level}] should extend own live 3`, () => {
      const move = chooseGomokuAIMove(aiLive3Stones, { difficulty: level, timeBudgetMs: 100 })
      assert.ok(move !== null, `${level} should find a move`)
      // Should extend at (3,0) or (-1,0) to create live 4
      const isExtending = (move.x === 3 && move.y === 0) || (move.x === -1 && move.y === 0)
      assert.ok(isExtending, `[${level}] should extend live 3 at (3,0) or (-1,0), got (${move.x}, ${move.y})`)
    })
  }
})