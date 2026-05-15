import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import test from 'node:test'
import assert from 'node:assert/strict'

import { createClassificationCache } from './classificationCache.js'

function makeTempDbPath() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'classification-cache-'))
  return {
    dbPath: path.join(dir, 'cache.sqlite'),
    dir,
  }
}

test('rememberFromClassification stores high-confidence non-factual intents and returns cache hit', () => {
  const { dbPath, dir } = makeTempDbPath()
  const cache = createClassificationCache({ dbPath, maxEntries: 2 })

  const stored = cache.rememberFromClassification({
    message: 'what time is it',
    surface: 'chat',
    intent: {
      route: 'local_tool',
      intent: 'local_time',
      confidence: 'high',
      toolName: 'get_current_time',
    },
  })

  const hit = cache.get({ message: 'what time is it', surface: 'chat' })

  assert.equal(stored, true)
  assert.equal(hit.route, 'local_tool')
  assert.equal(hit.toolName, 'get_current_time')

  cache.close()
  fs.rmSync(dir, { recursive: true, force: true })
})

test('rememberFromClassification does not store factual intent without evidence', () => {
  const { dbPath, dir } = makeTempDbPath()
  const cache = createClassificationCache({ dbPath, maxEntries: 2 })

  const stored = cache.rememberFromClassification({
    message: 'latest chip news',
    surface: 'chat',
    intent: {
      route: 'factual_tool',
      intent: 'factual',
      confidence: 'high',
    },
  })

  const hit = cache.get({ message: 'latest chip news', surface: 'chat' })

  assert.equal(stored, false)
  assert.equal(hit, null)

  cache.close()
  fs.rmSync(dir, { recursive: true, force: true })
})

test('promoteWithEvidence stores factual intent when confidence and cited URLs are present', () => {
  const { dbPath, dir } = makeTempDbPath()
  const cache = createClassificationCache({ dbPath, maxEntries: 2 })

  const promoted = cache.promoteWithEvidence({
    message: 'latest chip news',
    surface: 'chat',
    intent: {
      route: 'factual_tool',
      intent: 'factual',
      confidence: 'medium',
    },
    payload: {
      results: [{ title: 'Brief', url: 'https://example.com/brief' }],
    },
  })

  const hit = cache.get({ message: 'latest chip news', surface: 'chat' })

  assert.equal(promoted, true)
  assert.equal(hit.route, 'factual_tool')
  assert.equal(hit.confidence, 'medium')

  cache.close()
  fs.rmSync(dir, { recursive: true, force: true })
})

test('LRU keeps hot entries in memory while persistent store can still serve evicted keys', () => {
  const { dbPath, dir } = makeTempDbPath()
  const cache = createClassificationCache({ dbPath, maxEntries: 1 })

  cache.rememberFromClassification({
    message: 'what time is it',
    surface: 'chat',
    intent: { route: 'local_tool', intent: 'local_time', confidence: 'high', toolName: 'get_current_time' },
  })

  cache.rememberFromClassification({
    message: 'rewrite this politely',
    surface: 'chat',
    intent: { route: 'fast_chat', intent: 'chat', confidence: 'high' },
  })

  const hit = cache.get({ message: 'what time is it', surface: 'chat' })
  assert.equal(hit.route, 'local_tool')

  cache.close()
  fs.rmSync(dir, { recursive: true, force: true })
})
