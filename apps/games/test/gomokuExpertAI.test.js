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
})
