'use client'

import { describe, it } from 'node:test'
import assert from 'node:assert'

// Import the actual AI functions used by GomokuGame
import {
  isGomokuMoveLegal,
  getGomokuWinner,
} from '../gomokuAI.js'

function coordKey(x, y) {
  return `${x},${y}`
}

/**
 * Simulates the cell disabled logic from GomokuGame JSX.
 * Matches: disabled={occupied || aiThinking || winner}
 */
function isCellDisabled(stones, aiThinking, winner, x, y) {
  const occupied = Boolean(stones[coordKey(x, y)])
  return occupied || aiThinking || winner
}

/**
 * Simulates playHumanMove's guard logic.
 * Matches: if (winner || aiThinking) { return } + legality check
 */
function canPlayHumanMove(stones, aiThinking, winner, x, y) {
  if (winner || aiThinking) return false
  return isGomokuMoveLegal(stones, x, y)
}

describe('Gomoku Turn Engine — Human Cannot Move Bug', () => {
  it('should allow human to move on empty board after losing previous round (human-first reset)', () => {
    // Scenario: human lost last round, so human goes first with empty board.
    // This is the bug: "It's my turn and I cannot move."
    
    // After reset() with lastLoser === 'human': empty board, winner = null, aiThinking = false
    const stones = {}
    let aiThinking = false
    let winner = null

    // Cell (3, 0) should be clickable on empty board
    assert.strictEqual(isCellDisabled(stones, aiThinking, winner, 3, 0), false, 'cell should be enabled on empty board')
    assert.strictEqual(canPlayHumanMove(stones, aiThinking, winner, 3, 0), true, 'human should be able to play on empty board')
    assert.strictEqual(isGomokuMoveLegal(stones, 3, 0), true, 'any position is legal on empty board')
  })

  it('should allow human to move after AI starts at center (AI-first reset)', () => {
    // Scenario: human won last round or first round, AI starts at center.
    
    const stones = { [coordKey(0, 0)]: 'ai' }
    let aiThinking = false
    let winner = null

    // Cell (1, 0) should be clickable — within distance 3 of center
    assert.strictEqual(isCellDisabled(stones, aiThinking, winner, 1, 0), false, 'cell (1,0) should be enabled')
    assert.strictEqual(canPlayHumanMove(stones, aiThinking, winner, 1, 0), true, 'human should be able to play at (1,0)')
    assert.strictEqual(isGomokuMoveLegal(stones, 1, 0), true, '(1,0) is within distance 3 of (0,0)')

    // Cell (5, 0) should NOT be clickable — outside distance 3
    assert.strictEqual(canPlayHumanMove(stones, aiThinking, winner, 5, 0), false, 'human cannot play outside distance 3')
    assert.strictEqual(isGomokuMoveLegal(stones, 5, 0), false, '(5,0) is distance 4 from (0,0)')
  })

  it('should block human moves while AI is thinking', () => {
    // Scenario: human just played, AI is computing its response.
    
    const stones = { [coordKey(0, 0)]: 'ai', [coordKey(1, 0)]: 'human' }
    let aiThinking = true
    let winner = null

    // All cells should be disabled while AI thinks
    assert.strictEqual(isCellDisabled(stones, aiThinking, winner, 2, 0), true, 'cell should be disabled while AI thinks')
    assert.strictEqual(canPlayHumanMove(stones, aiThinking, winner, 2, 0), false, 'human cannot move while AI thinks')
  })

  it('should allow human to move after AI responds (turn passes back)', () => {
    // Scenario: AI just responded, aiThinking = false. Human's turn again.
    
    const stones = { [coordKey(0, 0)]: 'ai', [coordKey(1, 0)]: 'human', [coordKey(0, 1)]: 'ai' }
    let aiThinking = false
    let winner = null

    // Cell (2, 0) should be clickable
    assert.strictEqual(isCellDisabled(stones, aiThinking, winner, 2, 0), false, 'cell should be enabled after AI responds')
    assert.strictEqual(canPlayHumanMove(stones, aiThinking, winner, 2, 0), true, 'human should be able to play after AI responds')
  })

  it('should block all moves when human won (winner is set)', () => {
    // Scenario: human just connected five, winner = 'human'. Game over until reset.
    
    const stones = {
      [coordKey(0, 0)]: 'human',
      [coordKey(1, 0)]: 'human',
      [coordKey(2, 0)]: 'human',
      [coordKey(3, 0)]: 'human',
      [coordKey(4, 0)]: 'human',
    }
    let aiThinking = false
    let winner = 'human'

    // All cells should be disabled — game is over
    assert.strictEqual(isCellDisabled(stones, aiThinking, winner, 5, 0), true, 'cell should be disabled when human won')
    assert.strictEqual(canPlayHumanMove(stones, aiThinking, winner, 5, 0), false, 'human cannot move after winning')
    assert.strictEqual(canPlayHumanMove(stones, aiThinking, winner, -1, 0), false, 'human cannot move even on empty cell when won')
  })

  it('should block all moves when AI won (winner is set)', () => {
    // Scenario: AI just connected five, winner = 'ai'. Game over until reset.
    
    const stones = {
      [coordKey(0, 0)]: 'ai',
      [coordKey(1, 0)]: 'ai',
      [coordKey(2, 0)]: 'ai',
      [coordKey(3, 0)]: 'ai',
      [coordKey(4, 0)]: 'ai',
    }
    let aiThinking = false
    let winner = 'ai'

    assert.strictEqual(isCellDisabled(stones, aiThinking, winner, 5, 0), true, 'cell should be disabled when AI won')
    assert.strictEqual(canPlayHumanMove(stones, aiThinking, winner, 5, 0), false, 'human cannot move after AI won')
  })

  it('should handle full game cycle: human loses → reset → human goes first', () => {
    // Full scenario: human lost previous round, resets, and should be able to play on empty board.
    
    // Phase 1: End of previous round — human lost
    let stones = { [coordKey(2, 0)]: 'ai', [coordKey(3, 0)]: 'human', [coordKey(4, 0)]: 'ai' }
    let aiThinking = false
    let winner = 'ai'

    assert.strictEqual(canPlayHumanMove(stones, aiThinking, winner, 5, 0), false, 'cannot move while AI won')

    // Phase 2: User clicks "Next Round" (reset)
    // reset() sets: stones = {}, aiThinking = false, winner = null, lastLoser stays 'human'
    stones = {}
    aiThinking = false
    winner = null

    // Phase 3: Human should be able to place first stone on empty board
    assert.strictEqual(isCellDisabled(stones, aiThinking, winner, 0, 0), false, 'cell (0,0) should be enabled on reset')
    assert.strictEqual(canPlayHumanMove(stones, aiThinking, winner, 0, 0), true, 'human can play on empty board after losing')
    assert.strictEqual(canPlayHumanMove(stones, aiThinking, winner, 3, -2), true, 'human can play any position on empty board')
    assert.strictEqual(canPlayHumanMove(stones, aiThinking, winner, -5, 5), true, 'human can play negative coordinates on empty board')
  })

  it('should handle full game cycle: human wins → reset → AI goes first', () => {
    // Full scenario: human won, resets, AI starts at center.
    
    // Phase 1: End of previous round — human won
    let stones = { [coordKey(0, 0)]: 'human', [coordKey(1, 0)]: 'ai', [coordKey(2, 0)]: 'human' }
    let aiThinking = false
    let winner = 'human'

    assert.strictEqual(canPlayHumanMove(stones, aiThinking, winner, 3, 0), false, 'cannot move while human won')

    // Phase 2: User clicks "Next Round" (reset)
    // reset() with lastLoser === 'ai' → setStones({ '0,0': 'ai' }), winner = null
    stones = { [coordKey(0, 0)]: 'ai' }
    aiThinking = false
    winner = null

    // Phase 3: Human should be able to play (AI started at center)
    assert.strictEqual(isCellDisabled(stones, aiThinking, winner, 1, 0), false, 'cell (1,0) should be enabled')
    assert.strictEqual(canPlayHumanMove(stones, aiThinking, winner, 1, 0), true, 'human can play after AI starts')
    assert.strictEqual(canPlayHumanMove(stones, aiThinking, winner, -2, 0), true, 'human can play negative coords')
    assert.strictEqual(canPlayHumanMove(stones, aiThinking, winner, 4, 0), true, 'human can play at distance 3')
    assert.strictEqual(canPlayHumanMove(stones, aiThinking, winner, 5, 0), false, 'human CANNOT play beyond distance 3')
  })

  it('should handle consecutive rounds with loser always going first', () => {
    // Multi-round scenario: both players win alternately.
    
    let stones = {}
    let aiThinking = false
    let winner = null

    // === Round 1: First round (AI starts at center) ===
    stones = { [coordKey(0, 0)]: 'ai' }
    assert.strictEqual(canPlayHumanMove(stones, aiThinking, winner, 1, 0), true)

    // Human plays (1, 0)
    stones = { [coordKey(0, 0)]: 'ai', [coordKey(1, 0)]: 'human' }
    aiThinking = true // AI starts thinking
    
    assert.strictEqual(canPlayHumanMove(stones, aiThinking, winner, 2, 0), false) // blocked

    // AI responds at (0, 1)
    aiThinking = false
    stones = { [coordKey(0, 0)]: 'ai', [coordKey(1, 0)]: 'human', [coordKey(0, 1)]: 'ai' }
    
    // Human's turn again
    assert.strictEqual(canPlayHumanMove(stones, aiThinking, winner, 2, 0), true) // can move

    // === Round 2: Human wins this round, so human starts next ===
    winner = 'human' // game over
    
    // Reset: human goes first (empty board)
    stones = {}
    aiThinking = false
    winner = null

    assert.strictEqual(canPlayHumanMove(stones, aiThinking, winner, 0, 0), true) // human can play

    // Human plays at (0, 0)
    stones = { [coordKey(0, 0)]: 'human' }

    // AI responds
    aiThinking = true
    stones = { [coordKey(0, 0)]: 'human', [coordKey(1, 0)]: 'ai' }
    
    assert.strictEqual(canPlayHumanMove(stones, aiThinking, winner, 2, 0), false) // blocked

    aiThinking = false
    stones = { [coordKey(0, 0)]: 'human', [coordKey(1, 0)]: 'ai' }

    // Human's turn
    assert.strictEqual(canPlayHumanMove(stones, aiThinking, winner, 2, 0), true)

    // === Round 3: AI wins this round, so human starts next ===
    winner = 'ai'

    // Reset: human goes first (empty board) because lastLoser === 'human'
    stones = {}
    aiThinking = false
    winner = null

    assert.strictEqual(canPlayHumanMove(stones, aiThinking, winner, 5, -3), true) // human can play anywhere
    assert.strictEqual(canPlayHumanMove(stones, aiThinking, winner, 0, 0), true)
    assert.strictEqual(canPlayHumanMove(stones, aiThinking, winner, -10, 10), true)
  })

  it('should block occupied cells regardless of turn state', () => {
    // Occupied cells should always be disabled.
    
    const stones = { [coordKey(0, 0)]: 'ai', [coordKey(1, 0)]: 'human' }
    let aiThinking = false
    let winner = null

    assert.strictEqual(isCellDisabled(stones, aiThinking, winner, 0, 0), true, 'occupied by AI')
    assert.strictEqual(isCellDisabled(stones, aiThinking, winner, 1, 0), true, 'occupied by human')
    assert.strictEqual(canPlayHumanMove(stones, aiThinking, winner, 0, 0), false, 'cannot play on occupied cell')
    assert.strictEqual(canPlayHumanMove(stones, aiThinking, winner, 1, 0), false, 'cannot play on occupied cell')
    
    // But adjacent empty cells should be clickable
    assert.strictEqual(isCellDisabled(stones, aiThinking, winner, 2, 0), false, 'empty adjacent cell')
    assert.strictEqual(canPlayHumanMove(stones, aiThinking, winner, 2, 0), true, 'can play on empty cell')
  })

  it('should handle illegal move rejection with proper error message', () => {
    // When human tries to play outside distance 3, move is rejected.
    
    const stones = { [coordKey(0, 0)]: 'ai', [coordKey(1, 0)]: 'human' }
    let aiThinking = false
    let winner = null

    // Move to (5, 0) — distance 4 from nearest stone
    assert.strictEqual(isGomokuMoveLegal(stones, 5, 0), false, '(5,0) is outside distance 3')
    assert.strictEqual(canPlayHumanMove(stones, aiThinking, winner, 5, 0), false, 'illegal move rejected')
    
    // Move to (3, 0) — distance 2 from (1,0), legal
    assert.strictEqual(isGomokuMoveLegal(stones, 3, 0), true, '(3,0) is within distance 2 of (1,0)')
    assert.strictEqual(canPlayHumanMove(stones, aiThinking, winner, 3, 0), true, 'legal move accepted')
    
    // Move to (4, 0) — distance 3 from (1,0), legal
    assert.strictEqual(isGomokuMoveLegal(stones, 4, 0), true, '(4,0) is within distance 3 of (1,0)')
    assert.strictEqual(canPlayHumanMove(stones, aiThinking, winner, 4, 0), true, 'legal move accepted')
    
    // Move to (5, 0) — distance 4 from (1,0), illegal
    assert.strictEqual(isGomokuMoveLegal(stones, 5, 0), false, '(5,0) is outside distance 3')
    assert.strictEqual(canPlayHumanMove(stones, aiThinking, winner, 5, 0), false, 'illegal move rejected')
  })
})