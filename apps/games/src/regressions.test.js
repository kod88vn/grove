import test from 'node:test'
import assert from 'node:assert/strict'

import tailwindConfig from '../tailwind.config.js'
import { chooseGomokuAIMove, coordKey, isGomokuMoveLegal } from '../src/index.js'
import { getGomokuWorkerUrl } from '../src/gomokuWorker.js'

test('games tailwind config scans src files for utility classes', () => {
  assert.equal(Array.isArray(tailwindConfig.content), true)
  assert.equal(tailwindConfig.content.includes('./src/**/*.{js,ts,jsx,tsx}'), true)
})

test('gomoku worker url respects the games base path', () => {
  assert.equal(getGomokuWorkerUrl('/games/gomoku'), '/games/gomoku-ai-worker.js')
  assert.equal(getGomokuWorkerUrl('/games'), '/games/gomoku-ai-worker.js')
  assert.equal(getGomokuWorkerUrl('/'), '/games/gomoku-ai-worker.js')
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