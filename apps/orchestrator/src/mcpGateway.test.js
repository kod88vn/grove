import test from 'node:test'
import assert from 'node:assert/strict'

import { executeMcpTool } from './mcpGateway.js'

test('Given no executor or endpoint, when executing MCP tool, then typed unavailable error is returned', async () => {
  const result = await executeMcpTool({ name: 'web_search', arguments: { query: 'latest chip news' } }, { endpoint: '' })

  assert.equal(result.ok, false)
  assert.equal(result.kind, 'mcp_tool')
  assert.equal(result.error.code, 'MCP_TOOL_UNAVAILABLE')
})

test('Given injected executor, when executing MCP tool, then executor payload is returned', async () => {
  const result = await executeMcpTool(
    { name: 'web_search', arguments: { query: 'latest chip news' } },
    {
      executor: async (call) => ({
        ok: true,
        payload: { echo: call.arguments.query },
      }),
    }
  )

  assert.equal(result.ok, true)
  assert.equal(result.kind, 'mcp_tool')
  assert.equal(result.toolName, 'web_search')
  assert.equal(result.payload.echo, 'latest chip news')
})

test('Given HTTP endpoint mode, when endpoint returns ok payload, then payload is mapped correctly', async (t) => {
  const originalFetch = global.fetch
  t.after(() => {
    global.fetch = originalFetch
  })

  global.fetch = async () => ({
    ok: true,
    json: async () => ({ ok: true, payload: { results: [{ title: 'A' }] } }),
  })

  const result = await executeMcpTool(
    { name: 'web_search', arguments: { query: 'latest chip news' } },
    { endpoint: 'http://127.0.0.1:4020/execute' }
  )

  assert.equal(result.ok, true)
  assert.equal(Array.isArray(result.payload.results), true)
})

test('Given HTTP endpoint mode, when endpoint returns non-200, then typed http error is returned', async (t) => {
  const originalFetch = global.fetch
  t.after(() => {
    global.fetch = originalFetch
  })

  global.fetch = async () => ({ ok: false, status: 503 })

  const result = await executeMcpTool(
    { name: 'web_search', arguments: { query: 'latest chip news' } },
    { endpoint: 'http://127.0.0.1:4020/execute' }
  )

  assert.equal(result.ok, false)
  assert.equal(result.error.code, 'MCP_TOOL_HTTP_ERROR')
})