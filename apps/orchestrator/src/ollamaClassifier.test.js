import test from 'node:test'
import assert from 'node:assert/strict'

import { createOllamaClassifier } from './ollamaClassifier.js'

test('createOllamaClassifier sends a chat request and returns parsed JSON intent', async () => {
  let captured
  const fakeFetch = async (url, init) => {
    captured = { url, init }
    return {
      ok: true,
      async json() {
        return {
          message: {
            content: JSON.stringify({
              route: 'factual_tool',
              intent: 'factual',
              confidence: 'high',
              reason: 'lookup',
            }),
          },
        }
      },
    }
  }

  const classify = createOllamaClassifier({
    host: 'http://test:11434',
    model: 'test-model',
    fetch: fakeFetch,
  })

  const result = await classify({ message: 'who is the current president' })

  assert.equal(captured.url, 'http://test:11434/api/chat')
  const body = JSON.parse(captured.init.body)
  assert.equal(body.model, 'test-model')
  assert.equal(body.stream, false)
  assert.equal(body.format, 'json')
  assert.equal(body.messages[1].content, 'who is the current president')
  assert.ok(body.messages[0].content.includes('choose factual_tool'))
  assert.ok(body.messages[0].content.includes('who is the sitting president'))

  assert.equal(result.route, 'factual_tool')
  assert.equal(result.intent, 'factual')
})

test('createOllamaClassifier throws on non-2xx response', async () => {
  const fakeFetch = async () => ({ ok: false, status: 500, async json() { return {} } })
  const classify = createOllamaClassifier({ fetch: fakeFetch })
  await assert.rejects(() => classify({ message: 'hello' }), /ollama_status_500/)
})

test('createOllamaClassifier throws when model returns invalid JSON', async () => {
  const fakeFetch = async () => ({
    ok: true,
    async json() {
      return { message: { content: 'not json' } }
    },
  })
  const classify = createOllamaClassifier({ fetch: fakeFetch })
  await assert.rejects(() => classify({ message: 'hello' }))
})
