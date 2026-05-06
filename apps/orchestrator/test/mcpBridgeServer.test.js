import test from 'node:test'
import assert from 'node:assert/strict'

import { createMcpBridgeServer, startMcpBridgeServer } from '../src/mcpBridgeServer.js'

test('GET /health returns mcp bridge health status', async () => {
  const server = await startMcpBridgeServer(0)
  const address = server.address()
  const res = await fetch(`http://127.0.0.1:${address.port}/health`)
  const body = await res.json()

  await new Promise((resolve, reject) => server.close((err) => (err ? reject(err) : resolve())))

  assert.equal(res.status, 200)
  assert.equal(body.ok, true)
  assert.equal(body.service, 'mcp-bridge')
})

test('POST /execute for web_search returns normalized result payload', async (t) => {
  const originalFetch = global.fetch
  t.after(() => {
    global.fetch = originalFetch
  })

  global.fetch = async (url, options) => {
    if (String(url).includes('duckduckgo.com')) {
      return {
        ok: true,
        json: async () => ({
          RelatedTopics: [
            { Text: 'Example result snippet', FirstURL: 'https://example.com/article' },
          ],
        }),
      }
    }

    return originalFetch(url, options)
  }

  const server = createMcpBridgeServer()
  await new Promise((resolve) => server.listen(0, resolve))
  const address = server.address()
  const res = await fetch(`http://127.0.0.1:${address.port}/execute`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      toolName: 'web_search',
      arguments: { query: 'latest chip news' },
    }),
  })
  const body = await res.json()

  await new Promise((resolve, reject) => server.close((err) => (err ? reject(err) : resolve())))

  assert.equal(res.status, 200)
  assert.equal(body.ok, true)
  assert.equal(Array.isArray(body.payload.results), true)
  assert.equal(body.payload.results[0].url, 'https://example.com/article')
})

test('POST /execute returns typed error for unsupported tool', async () => {
  const server = await startMcpBridgeServer(0)
  const address = server.address()
  const res = await fetch(`http://127.0.0.1:${address.port}/execute`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ toolName: 'not_real_tool', arguments: {} }),
  })
  const body = await res.json()

  await new Promise((resolve, reject) => server.close((err) => (err ? reject(err) : resolve())))

  assert.equal(res.status, 400)
  assert.equal(body.ok, false)
  assert.equal(body.error.code, 'UNSUPPORTED_MCP_TOOL')
})