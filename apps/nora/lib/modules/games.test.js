import { describe, expect, it } from '@jest/globals'
import {
  GAME_SLUGS,
  HANGMAN_ROUNDS,
  MINI_SUDOKU_PUZZLE,
  chooseGomokuAIMove,
  cloneMiniSudokuBoard,
  coordKey,
  getClosestChebyshevDistance,
  getGomokuWinner,
  isGomokuMoveLegal,
  isMiniSudokuPlacementValid,
  isMiniSudokuSolved,
  normalizeAnswer,
  parseCoordKey,
  pickHangmanRound,
  scoreCrosswordAnswers,
} from './games'

describe('game constants and helpers', () => {
  it('exposes eight game slugs including newest additions', () => {
    expect(GAME_SLUGS).toEqual([
      'crossword',
      'hangman',
      'sudoku',
      'gomoku',
      'math-lightning',
      'word-scramble',
      'memory-match',
      'logic-code',
    ])
  })

  it('normalizes crossword answers', () => {
    expect(normalizeAnswer(' Ice cream!! ')).toBe('ICECREAM')
    expect(normalizeAnswer(null)).toBe('')
  })

  it('deterministically picks a hangman round from seed', () => {
    const first = pickHangmanRound(0)
    const wrapped = pickHangmanRound(-1.25)

    expect(HANGMAN_ROUNDS).toContain(first)
    expect(HANGMAN_ROUNDS).toContain(wrapped)
  })

  it('converts coordinate key round-trip', () => {
    const key = coordKey(-2, 9)
    expect(key).toBe('-2,9')
    expect(parseCoordKey(key)).toEqual({ x: -2, y: 9 })
  })

  it('computes closest Chebyshev distance', () => {
    expect(getClosestChebyshevDistance({}, 100, -100)).toBe(0)

    const stones = {
      [coordKey(1, 1)]: 'human',
      [coordKey(7, 2)]: 'ai',
    }
    expect(getClosestChebyshevDistance(stones, 5, 4)).toBe(2)
  })
})

describe('gomoku rules', () => {
  it('allows first move on an empty board', () => {
    expect(isGomokuMoveLegal({}, 30, -20)).toBe(true)
  })

  it('rejects invalid or occupied coordinates', () => {
    const stones = { [coordKey(0, 0)]: 'human' }

    expect(isGomokuMoveLegal(stones, 0.5, 0)).toBe(false)
    expect(isGomokuMoveLegal(stones, 0, 0)).toBe(false)
  })

  it('disallows moves farther than 3 cells from the nearest stone', () => {
    const stones = { [coordKey(0, 0)]: 'human' }

    expect(isGomokuMoveLegal(stones, 3, 0)).toBe(true)
    expect(isGomokuMoveLegal(stones, 4, 0)).toBe(false)
  })

  it('detects five in a row winner', () => {
    const stones = {
      [coordKey(0, 0)]: 'human',
      [coordKey(1, 0)]: 'human',
      [coordKey(2, 0)]: 'human',
      [coordKey(3, 0)]: 'human',
      [coordKey(4, 0)]: 'human',
    }

    expect(getGomokuWinner(stones, { x: 4, y: 0 })).toBe('human')
  })

  it('detects diagonal winner when scanning all stones without last move', () => {
    const stones = {
      [coordKey(0, 0)]: 'ai',
      [coordKey(1, 1)]: 'ai',
      [coordKey(2, 2)]: 'ai',
      [coordKey(3, 3)]: 'ai',
      [coordKey(4, 4)]: 'ai',
    }

    expect(getGomokuWinner(stones)).toBe('ai')
  })

  it('returns null for empty or non-winning boards', () => {
    expect(getGomokuWinner({})).toBeNull()

    const stones = {
      [coordKey(0, 0)]: 'human',
      [coordKey(0, 1)]: 'ai',
      [coordKey(1, 0)]: 'human',
    }
    expect(getGomokuWinner(stones, { x: 5, y: 5 })).toBeNull()
  })

  it('AI takes a winning move when available', () => {
    const stones = {
      [coordKey(0, 0)]: 'ai',
      [coordKey(1, 0)]: 'ai',
      [coordKey(2, 0)]: 'ai',
      [coordKey(3, 0)]: 'ai',
      [coordKey(0, 1)]: 'human',
    }

    const move = chooseGomokuAIMove(stones)
    expect(move).toEqual(expect.objectContaining({ y: 0 }))
    expect([-1, 4]).toContain(move.x)
  })

  it('AI blocks an immediate human win', () => {
    const stones = {
      [coordKey(0, 0)]: 'human',
      [coordKey(1, 0)]: 'human',
      [coordKey(2, 0)]: 'human',
      [coordKey(3, 0)]: 'human',
      [coordKey(0, 1)]: 'ai',
    }

    const move = chooseGomokuAIMove(stones)
    expect(move).toEqual(expect.objectContaining({ y: 0 }))
    expect([-1, 4]).toContain(move.x)
  })

  it('AI starts at center when board is empty', () => {
    expect(chooseGomokuAIMove({})).toEqual({ x: 0, y: 0 })
  })

  it('AI returns null when no legal candidates can be derived', () => {
    const impossible = {
      'not,a-number': 'ai',
    }
    expect(chooseGomokuAIMove(impossible)).toBeNull()
  })

  it('AI chooses a legal heuristic move when no immediate win or block', () => {
    const stones = {
      [coordKey(0, 0)]: 'ai',
      [coordKey(1, 0)]: 'human',
      [coordKey(0, 1)]: 'human',
    }

    const move = chooseGomokuAIMove(stones)
    expect(move).toBeTruthy()
    expect(isGomokuMoveLegal(stones, move.x, move.y)).toBe(true)
  })

  it('AI still returns quickly with tiny simulation budget', () => {
    const stones = {
      [coordKey(0, 0)]: 'ai',
      [coordKey(1, 0)]: 'human',
      [coordKey(0, 1)]: 'human',
      [coordKey(2, 0)]: 'ai',
    }

    const start = Date.now()
    const move = chooseGomokuAIMove(stones, {
      timeBudgetMs: 8,
      maxPlayouts: 20,
      maxRolloutDepth: 4,
      rng: () => 0.42,
    })
    const elapsed = Date.now() - start

    expect(move).toBeTruthy()
    expect(isGomokuMoveLegal(stones, move.x, move.y)).toBe(true)
    expect(elapsed).toBeLessThan(250)
  })

  it('AI keeps tactical priority over simulation when immediate win exists', () => {
    const stones = {
      [coordKey(0, 0)]: 'ai',
      [coordKey(1, 0)]: 'ai',
      [coordKey(2, 0)]: 'ai',
      [coordKey(3, 0)]: 'ai',
      [coordKey(5, 1)]: 'human',
    }

    const move = chooseGomokuAIMove(stones, {
      timeBudgetMs: 200,
      maxPlayouts: 500,
      rng: () => 0.99,
    })

    expect(move).toEqual(expect.objectContaining({ y: 0 }))
    expect([-1, 4]).toContain(move.x)
  })

  it('AI blocks an opponent three-line extension immediately', () => {
    const stones = {
      [coordKey(0, 0)]: 'human',
      [coordKey(1, 0)]: 'human',
      [coordKey(2, 0)]: 'human',
      [coordKey(0, 2)]: 'ai',
    }

    const move = chooseGomokuAIMove(stones, {
      timeBudgetMs: 2000,
      maxPlayouts: 2000,
      rng: () => 0.75,
    })

    expect(move).toEqual(expect.objectContaining({ y: 0 }))
    expect([-1, 3]).toContain(move.x)
  })

  it('AI blocks a human double-three fork point', () => {
    const stones = {
      [coordKey(-1, 0)]: 'human',
      [coordKey(1, 0)]: 'human',
      [coordKey(0, -1)]: 'human',
      [coordKey(0, 1)]: 'human',
      [coordKey(3, 3)]: 'ai',
    }

    const move = chooseGomokuAIMove(stones, {
      timeBudgetMs: 2000,
      maxPlayouts: 2000,
      rng: () => 0.15,
    })

    expect(move).toEqual({ x: 0, y: 0 })
  })

  it('AI takes its own double-three fork when safe', () => {
    const stones = {
      [coordKey(-1, 0)]: 'ai',
      [coordKey(1, 0)]: 'ai',
      [coordKey(0, -1)]: 'ai',
      [coordKey(0, 1)]: 'ai',
      [coordKey(3, 0)]: 'human',
      [coordKey(4, 0)]: 'human',
    }

    const move = chooseGomokuAIMove(stones, {
      timeBudgetMs: 2000,
      maxPlayouts: 2000,
      rng: () => 0.33,
    })

    expect(move).toEqual({ x: 0, y: 0 })
  })
})

describe('other game helpers', () => {
  it('scores crossword answer sets', () => {
    const result = scoreCrosswordAnswers({
      '1A': 'ice cream',
      '2A': 'kite',
      '1D': 'cow',
      '2D': 'blue',
    })

    expect(result.correct).toBe(3)
    expect(result.solved).toBe(false)
  })

  it('marks crossword solved when every answer is correct', () => {
    const result = scoreCrosswordAnswers({
      '1A': 'icecream',
      '2A': 'kite',
      '1D': 'cow',
      '2D': 'green',
    })

    expect(result.correct).toBe(4)
    expect(result.solved).toBe(true)
  })

  it('clones sudoku board without mutating the source', () => {
    const clone = cloneMiniSudokuBoard(MINI_SUDOKU_PUZZLE.board)
    clone[0][1] = 9

    expect(MINI_SUDOKU_PUZZLE.board[0][1]).toBe(0)
  })

  it('validates sudoku placement rules (value, row, col, and block)', () => {
    const board = [
      [1, 0, 3, 4],
      [0, 4, 1, 0],
      [2, 0, 4, 3],
      [4, 3, 0, 1],
    ]

    expect(isMiniSudokuPlacementValid(board, 0, 1, 0)).toBe(false)
    expect(isMiniSudokuPlacementValid(board, 0, 1, 1)).toBe(false)
    expect(isMiniSudokuPlacementValid(board, 1, 0, 2)).toBe(false)
    expect(isMiniSudokuPlacementValid(board, 1, 0, 4)).toBe(false)
    expect(isMiniSudokuPlacementValid(board, 0, 1, 2)).toBe(true)
  })

  it('identifies solved mini sudoku boards', () => {
    const board = [
      [1, 2, 3, 4],
      [3, 4, 1, 2],
      [2, 1, 4, 3],
      [4, 3, 2, 1],
    ]

    expect(isMiniSudokuSolved(board)).toBe(true)
  })

  it('returns false for unsolved mini sudoku boards', () => {
    const boardWithZero = [
      [1, 2, 3, 4],
      [3, 4, 1, 2],
      [2, 1, 0, 3],
      [4, 3, 2, 1],
    ]

    const boardWithConflict = [
      [1, 2, 3, 4],
      [3, 4, 1, 2],
      [2, 1, 4, 3],
      [4, 3, 4, 1],
    ]

    expect(isMiniSudokuSolved(boardWithZero)).toBe(false)
    expect(isMiniSudokuSolved(boardWithConflict)).toBe(false)
  })
})
