import test from 'node:test'
import assert from 'node:assert/strict'

import { createOllamaClassifier } from './ollamaClassifier.js'

test('createOllamaClassifier sends a classification request to Nora and returns parsed JSON intent', async () => {
  let captured
  const fakeFetch = async (url, init) => {
    captured = { url, init }
    return {
      ok: true,
      async json() {
        return {
          route: 'factual_tool',
          intent: 'factual',
          confidence: 'high',
          reason: 'lookup',
        }
      },
    }
  }

  const classify = createOllamaClassifier({
    noraUrl: 'http://test-nora:3001',
    model: 'test-model',
    fetch: fakeFetch,
  })

  const result = await classify({ message: 'who is the current president' })

  assert.equal(captured.url, 'http://test-nora:3001/api/nora-classify')
  const body = JSON.parse(captured.init.body)
  assert.equal(body.model, 'test-model')
  assert.equal(body.message, 'who is the current president')

  assert.equal(result.route, 'factual_tool')
  assert.equal(result.intent, 'factual')
})

test('createOllamaClassifier throws on non-2xx response from Nora', async () => {
  const fakeFetch = async () => ({ ok: false, status: 502, text: async () => 'Service Unavailable' })
  const classify = createOllamaClassifier({ fetch: fakeFetch })
  await assert.rejects(() => classify({ message: 'hello' }), /nora_classifier_status_502/)
})

test('createOllamaClassifier uses default Nora URL when no noraUrl is provided', async () => {
  let captured
  const fakeFetch = async (url, init) => {
    captured = { url }
    return { ok: true, async json() { return { route: 'fast_chat' } } }
  }

  const classify = createOllamaClassifier({ fetch: fakeFetch })

  await classify({ message: 'hello' })

  assert.equal(captured.url, 'http://localhost:3001/api/nora-classify')
})

test('createOllamaClassifier uses PLT_NORA_URL when set', async () => {
  const prevPlt = process.env.PLT_NORA_URL
  process.env.PLT_NORA_URL = 'http://mesh-nora:4001'

  let captured
  const fakeFetch = async (url, init) => {
    captured = { url }
    return { ok: true, async json() { return { route: 'fast_chat' } } }
  }

  const classify = createOllamaClassifier({ fetch: fakeFetch })
  await classify({ message: 'hello' })

  assert.equal(captured.url, 'http://mesh-nora:4001/api/nora-classify')

  if (prevPlt !== undefined) {
    process.env.PLT_NORA_URL = prevPlt
  } else {
    delete process.env.PLT_NORA_URL
  }
})