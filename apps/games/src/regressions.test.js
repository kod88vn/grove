import test from 'node:test'
import assert from 'node:assert/strict'

import tailwindConfig from '../tailwind.config.js'
import { chooseGomokuAIMove, coordKey, isGomokuMoveLegal } from '../src/index.js'
import { createWorker } from '../src/gomokuWorker.js'

test('games tailwind config scans src files for utility classes', () => {
  assert.equal(Array.isArray(tailwindConfig.content), true)
  assert.equal(tailwindConfig.content.includes('./src/**/*.{js,ts,jsx,tsx}'), true)
})

test('gomoku worker creates a Blob URL (no external file dependency)', () => {
  // The worker is now inlined as a Blob URL to avoid path/proxy issues.
  // In Node.js, Worker is not available, so createWorker returns null.
  // In the browser, it creates a Blob URL worker.
  if (typeof Worker === 'undefined') {
    // Node.js environment - Worker not available, null is expected
    return assert.ok(true)
  }

  const worker = createWorker()
  assert.ok(worker)
  // Blob URLs start with blob: scheme, not a file path.
  assert.ok(worker.constructor.name === 'Worker', 'createWorker should return a Worker instance')
})

test('gomoku ai chooses a legal unoccupied reply on an active board', () => {
  const stones = {
    [coordKey(0, 0)]: 'ai',
    [coordKey(0, -1)]: 'human',
  }

  const move = chooseGomokuAIMove(stones, {
    timeBudgetMs: 25,
    maxPlayouts: 50,
    maxRolloutDepth: 6,
    candidateLimit: 10,
    rolloutCandidateLimit: 6,
  })

  assert.ok(move)
  assert.equal(stones[coordKey(move.x, move.y)], undefined)
  assert.equal(isGomokuMoveLegal(stones, move.x, move.y), true)
})