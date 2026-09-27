// Gomoku AI — an open three must be blocked at every level, even when the
// lower levels' random "mistake" injection fires. Math.random is mocked so
// every run is deterministic.

import { describe, it, afterEach, mock } from 'node:test'
import assert from 'node:assert'

import { chooseGomokuAIMove } from './gomokuAI.js'

function K(x, y) {
  return `${x},${y}`
}

const OPEN_THREES = {
  horizontal: {
    stones: { [K(0, 0)]: 'human', [K(1, 0)]: 'human', [K(2, 0)]: 'human' },
    blocks: [[3, 0], [-1, 0]],
  },
  vertical: {
    stones: { [K(0, 0)]: 'human', [K(0, 1)]: 'human', [K(0, 2)]: 'human' },
    blocks: [[0, 3], [0, -1]],
  },
  diagonal: {
    stones: { [K(0, 0)]: 'human', [K(1, 1)]: 'human', [K(2, 2)]: 'human' },
    blocks: [[3, 3], [-1, -1]],
  },
  antiDiagonal: {
    stones: { [K(0, 0)]: 'human', [K(1, -1)]: 'human', [K(2, -2)]: 'human' },
    blocks: [[3, -3], [-1, 1]],
  },
}

// Each sequence makes the error roll succeed (0 < errorRate) and then picks a
// different slot of the top-5 pool, so every alternative move is exercised.
const FORCED_ERROR_PICKS = [0, 0.2, 0.4, 0.6, 0.8, 0.99]

function forceRandom(sequence) {
  let index = 0
  mock.method(Math, 'random', () => {
    const value = sequence[index % sequence.length]
    index += 1
    return value
  })
}

function isBlock(move, blocks) {
  return blocks.some(([x, y]) => move.x === x && move.y === y)
}

afterEach(() => {
  mock.restoreAll()
})

describe('Gomoku AI — open three is blocked even when a mistake is rolled', () => {
  for (const level of ['easy', 'medium']) {
    for (const [direction, { stones, blocks }] of Object.entries(OPEN_THREES)) {
      for (const pick of FORCED_ERROR_PICKS) {
        it(`[${level}] blocks the ${direction} open three (mistake pick ${pick})`, () => {
          forceRandom([0, pick])
          const move = chooseGomokuAIMove(stones, { difficulty: level, timeBudgetMs: 100 })
          assert.ok(move !== null, `${level} should find a move`)
          assert.ok(
            isBlock(move, blocks),
            `[${level}] must block the ${direction} open three at ${JSON.stringify(blocks)}, got (${move.x}, ${move.y})`
          )
        })
      }
    }
  }

  for (const level of ['hard', 'expert']) {
    for (const [direction, { stones, blocks }] of Object.entries(OPEN_THREES)) {
      it(`[${level}] blocks the ${direction} open three`, () => {
        const move = chooseGomokuAIMove(stones, { difficulty: level, timeBudgetMs: 100 })
        assert.ok(move !== null, `${level} should find a move`)
        assert.ok(
          isBlock(move, blocks),
          `[${level}] must block the ${direction} open three at ${JSON.stringify(blocks)}, got (${move.x}, ${move.y})`
        )
      })
    }
  }
})

describe('Gomoku AI — its own open four beats blocking an open three', () => {
  // Both sides have an open three and the AI moves. Making an open four wins
  // outright, so blocking the human three here would throw the game away.
  const stones = {
    [K(0, 0)]: 'human', [K(1, 0)]: 'human', [K(2, 0)]: 'human',
    [K(0, 3)]: 'ai', [K(1, 3)]: 'ai', [K(2, 3)]: 'ai',
  }

  for (const level of ['easy', 'medium', 'hard', 'expert']) {
    it(`[${level}] extends its own open three instead of blocking`, () => {
      forceRandom([0.999])
      const move = chooseGomokuAIMove(stones, { difficulty: level, timeBudgetMs: 100 })
      assert.ok(
        isBlock(move, [[3, 3], [-1, 3]]),
        `[${level}] should make an open four at (3,3) or (-1,3), got (${move.x}, ${move.y})`
      )
    })
  }
})

describe('Gomoku AI — lower levels still make mistakes on quiet boards', () => {
  const quiet = { [K(0, 0)]: 'human', [K(1, 1)]: 'ai' }

  for (const level of ['easy', 'medium']) {
    it(`[${level}] a rolled mistake changes the move when nothing is threatened`, () => {
      forceRandom([0.999])
      const best = chooseGomokuAIMove(quiet, { difficulty: level, timeBudgetMs: 100 })
      mock.restoreAll()

      const alternatives = new Set()
      for (const pick of FORCED_ERROR_PICKS) {
        forceRandom([0, pick])
        const move = chooseGomokuAIMove(quiet, { difficulty: level, timeBudgetMs: 100 })
        mock.restoreAll()
        alternatives.add(`${move.x},${move.y}`)
      }

      alternatives.delete(`${best.x},${best.y}`)
      assert.ok(
        alternatives.size > 0,
        `[${level}] error injection must still be able to pick a move other than (${best.x}, ${best.y})`
      )
    })
  }
})
