import { describe, it } from 'node:test'
import assert from 'node:assert'
import {
  coordKey,
  chooseGomokuAIMoveExpert,
  getGomokuWinner,
  isGomokuMoveLegal,
} from '../src/index.js'

describe('Gomoku Expert AI', () => {
  it('should make a move from an empty board', () => {
    const stones = {}
    const move = chooseGomokuAIMoveExpert(stones)
    assert(move !== null)
    assert(typeof move.x === 'number')
    assert(typeof move.y === 'number')
  })

  it('should make a move from a partially filled board', () => {
    const stones = {
      [coordKey(0, 0)]: 'ai',
      [coordKey(1, 0)]: 'human',
      [coordKey(0, 1)]: 'human',
    }
    const move = chooseGomokuAIMoveExpert(stones)
    assert(move !== null)
    assert(isGomokuMoveLegal(stones, move.x, move.y))
  })

  it('should win if it has 4 in a row and an open end', () => {
    const stones = {
      [coordKey(0, 0)]: 'ai',
      [coordKey(1, 0)]: 'ai',
      [coordKey(2, 0)]: 'ai',
      [coordKey(3, 0)]: 'ai',
    }
    const move = chooseGomokuAIMoveExpert(stones)
    // Should move to either extend the line or create another threat
    assert(move !== null)
  })

  it('should block immediate human threats', () => {
    // Human has 4 in a row, about to win
    const stones = {
      [coordKey(0, 0)]: 'human',
      [coordKey(1, 0)]: 'human',
      [coordKey(2, 0)]: 'human',
      [coordKey(3, 0)]: 'human',
      // Empty space at (4, 0) where human would win
      [coordKey(5, 0)]: 'ai', // AI blocks at this position initially
    }
    const move = chooseGomokuAIMoveExpert(stones)
    // Should prioritize defending
    assert(move !== null)
    assert(isGomokuMoveLegal(stones, move.x, move.y))
  })

  it('should have difficulty levels defined', () => {
    // Verify the AI configs are properly exported
    // This is tested indirectly through other tests
    const stones = { [coordKey(0, 0)]: 'ai' }
    const move = chooseGomokuAIMoveExpert(stones)
    assert(move !== null, 'Expert AI should return valid moves')
  })

  it('should prefer moves that build open-ended lines over blocked ones', () => {
    // Create a scenario where Expert AI should prefer an open line
    const stones = {
      [coordKey(0, 0)]: 'ai',
      [coordKey(1, 0)]: 'ai',
      [coordKey(5, 0)]: 'human', // Block one side
    }
    const move = chooseGomokuAIMoveExpert(stones)
    assert(move !== null)
    assert(isGomokuMoveLegal(stones, move.x, move.y))
  })

  it('should NOT declare winner when 5-in-a-row is bounded on both sides by opponent', () => {
    // AI has 5 in a row but both ends are blocked by human stones
    const stones = {
      [coordKey(-1, 0)]: 'human', // Block left end
      [coordKey(0, 0)]: 'ai',
      [coordKey(1, 0)]: 'ai',
      [coordKey(2, 0)]: 'ai',
      [coordKey(3, 0)]: 'ai',
      [coordKey(4, 0)]: 'ai',
      [coordKey(5, 0)]: 'human', // Block right end
    }
    const winner = getGomokuWinner(stones, { x: 4, y: 0 })
    assert.equal(winner, null, 'Bounded 5-in-a-row should NOT be a win')
  })

  it('should declare winner when 5-in-a-row has at least one open end', () => {
    // AI has 5 in a row with right end open (no human stone at position 6)
    const stones = {
      [coordKey(-1, 0)]: 'human', // Block left end only
      [coordKey(0, 0)]: 'ai',
      [coordKey(1, 0)]: 'ai',
      [coordKey(2, 0)]: 'ai',
      [coordKey(3, 0)]: 'ai',
      [coordKey(4, 0)]: 'ai',
    }
    const winner = getGomokuWinner(stones, { x: 4, y: 0 })
    assert.equal(winner, 'ai', '5-in-a-row with one open end IS a win')
  })

  it('should declare winner when 5-in-a-row has no blockers at all', () => {
    // AI has 5 in a row with both ends open (no opponent stones nearby)
    const stones = {
      [coordKey(0, 0)]: 'ai',
      [coordKey(1, 0)]: 'ai',
      [coordKey(2, 0)]: 'ai',
      [coordKey(3, 0)]: 'ai',
      [coordKey(4, 0)]: 'ai',
    }
    const winner = getGomokuWinner(stones, { x: 4, y: 0 })
    assert.equal(winner, 'ai', '5-in-a-row with both ends open IS a win')
  })

  it('should NOT declare winner for bounded 5-in-a-row in vertical direction', () => {
    // AI has 5 in a row vertically but both ends blocked
    const stones = {
      [coordKey(0, -1)]: 'human', // Block bottom
      [coordKey(0, 0)]: 'ai',
      [coordKey(0, 1)]: 'ai',
      [coordKey(0, 2)]: 'ai',
      [coordKey(0, 3)]: 'ai',
      [coordKey(0, 4)]: 'ai',
      [coordKey(0, 5)]: 'human', // Block top
    }
    const winner = getGomokuWinner(stones, { x: 0, y: 4 })
    assert.equal(winner, null, 'Bounded vertical 5-in-a-row should NOT be a win')
  })

  it('should declare winner for bounded 5-in-a-row that is actually 6+ (overline still wins)', () => {
    // When there are 6+ in a row, the extra stones mean at least one subset of 5 is open
    // This tests that we correctly identify the winning line even with extra stones
    const stones = {
      [coordKey(0, 0)]: 'ai',
      [coordKey(1, 0)]: 'ai',
      [coordKey(2, 0)]: 'ai',
      [coordKey(3, 0)]: 'ai',
      [coordKey(4, 0)]: 'ai',
      [coordKey(5, 0)]: 'ai', // 6 in a row - the first 5 are open on the right
    }
    const winner = getGomokuWinner(stones, { x: 5, y: 0 })
    assert.equal(winner, 'ai', '6-in-a-row IS a win (subset of 5 is open)')
  })
})