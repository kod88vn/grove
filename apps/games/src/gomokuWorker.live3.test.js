// The browser game runs the AI inside the Blob worker built by createWorker(),
// which carries its own inlined copy of the engine. These tests execute that
// exact Blob code in a VM, so the worker path must behave like gomokuAI.js.

import { describe, it, before, after } from 'node:test'
import assert from 'node:assert'
import vm from 'node:vm'

import { createWorker } from './gomokuWorker.js'
import { GOMOKU_AI_CONFIGS } from './gomokuAI.js'

function K(x, y) {
  return `${x},${y}`
}

let workerSource = ''

before(async () => {
  const originalWorker = globalThis.Worker
  const originalCreateObjectURL = URL.createObjectURL
  let capturedBlob = null
  globalThis.Worker = class {
    constructor(url) {
      this.url = url
    }
  }
  URL.createObjectURL = (blob) => {
    capturedBlob = blob
    return 'blob:gomoku-worker-test'
  }
  try {
    const worker = createWorker('/gomoku')
    assert.ok(worker, 'createWorker should build a Worker')
    assert.ok(capturedBlob, 'createWorker should build the Worker from a Blob')
    workerSource = await capturedBlob.text()
  } finally {
    globalThis.Worker = originalWorker
    URL.createObjectURL = originalCreateObjectURL
  }
})

after(() => {
  workerSource = ''
})

// Runs one AI request through the worker's onmessage, exactly as GomokuGame
// posts it, with Math.random inside the worker replaced by `sequence`.
function askWorker(stones, difficulty, sequence) {
  const posted = []
  let index = 0
  const context = vm.createContext({
    self: { postMessage: (message) => posted.push(message) },
    __rand: () => {
      const value = sequence[index % sequence.length]
      index += 1
      return value
    },
  })
  vm.runInContext(workerSource, context)
  vm.runInContext('Math.random = () => __rand()', context)
  context.self.onmessage({
    data: {
      jobId: 1,
      roundId: 1,
      stones,
      config: { ...GOMOKU_AI_CONFIGS[difficulty] },
      difficulty,
      timeBudgetMs: 100,
    },
  })
  assert.strictEqual(posted.length, 1, 'worker should post exactly one reply')
  assert.strictEqual(posted[0].error, undefined, `worker errored: ${posted[0].error}`)
  return posted[0].move
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

const FORCED_ERROR_PICKS = [0, 0.2, 0.4, 0.6, 0.8, 0.99]

function isBlock(move, blocks) {
  return blocks.some(([x, y]) => move.x === x && move.y === y)
}

describe('Gomoku worker — open three is blocked even when a mistake is rolled', () => {
  for (const level of ['easy', 'medium']) {
    for (const [direction, { stones, blocks }] of Object.entries(OPEN_THREES)) {
      for (const pick of FORCED_ERROR_PICKS) {
        it(`[${level}] blocks the ${direction} open three (mistake pick ${pick})`, () => {
          const move = askWorker(stones, level, [0, pick])
          assert.ok(move, `${level} should find a move`)
          assert.ok(
            isBlock(move, blocks),
            `[${level}] worker must block the ${direction} open three at ${JSON.stringify(blocks)}, got (${move.x}, ${move.y})`
          )
        })
      }
    }
  }

  for (const level of ['hard', 'expert']) {
    for (const [direction, { stones, blocks }] of Object.entries(OPEN_THREES)) {
      it(`[${level}] blocks the ${direction} open three`, () => {
        const move = askWorker(stones, level, [0.999])
        assert.ok(move, `${level} should find a move`)
        assert.ok(
          isBlock(move, blocks),
          `[${level}] worker must block the ${direction} open three at ${JSON.stringify(blocks)}, got (${move.x}, ${move.y})`
        )
      })
    }
  }
})

describe('Gomoku worker — its own open four beats blocking an open three', () => {
  const stones = {
    [K(0, 0)]: 'human', [K(1, 0)]: 'human', [K(2, 0)]: 'human',
    [K(0, 3)]: 'ai', [K(1, 3)]: 'ai', [K(2, 3)]: 'ai',
  }

  for (const level of ['easy', 'medium', 'hard', 'expert']) {
    for (const pick of [0.999, 0, 0.6]) {
      it(`[${level}] extends its own open three instead of blocking (random ${pick})`, () => {
        const move = askWorker(stones, level, [pick])
        assert.ok(
          isBlock(move, [[3, 3], [-1, 3]]),
          `[${level}] worker should make an open four at (3,3) or (-1,3), got (${move.x}, ${move.y})`
        )
      })
    }
  }
})

describe('Gomoku worker — lower levels still make mistakes on quiet boards', () => {
  const quiet = { [K(0, 0)]: 'human', [K(1, 1)]: 'ai' }

  for (const level of ['easy', 'medium']) {
    it(`[${level}] a rolled mistake changes the move when nothing is threatened`, () => {
      const best = askWorker(quiet, level, [0.999])
      const alternatives = new Set()
      for (const pick of FORCED_ERROR_PICKS) {
        const move = askWorker(quiet, level, [0, pick])
        alternatives.add(`${move.x},${move.y}`)
      }
      alternatives.delete(`${best.x},${best.y}`)
      assert.ok(
        alternatives.size > 0,
        `[${level}] worker error injection must still pick a move other than (${best.x}, ${best.y})`
      )
    })
  }
})
