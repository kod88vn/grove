import test from 'node:test'
import assert from 'node:assert/strict'

import { executeToolPlan } from '../src/toolRegistry.js'

test('Given local tool plan, when executing tool plan, then deterministic local payload is returned', async () => {
  const result = await executeToolPlan([
    { type: 'local_tool', name: 'get_current_time' },
  ])

  assert.equal(result.ok, true)
  assert.equal(result.kind, 'local_tool')
  assert.equal(result.toolName, 'get_current_time')
  assert.equal(typeof result.payload.localTime, 'string')
})

test('Given unavailable MCP tool plan, when executing tool plan, then typed refusal is returned', async () => {
  const result = await executeToolPlan([
    { type: 'mcp_tool', name: 'web_search' },
  ])

  assert.equal(result.ok, false)
  assert.equal(result.kind, 'mcp_tool')
  assert.equal(result.error.code, 'MCP_TOOL_UNAVAILABLE')
})

test('Given MCP executor, when executing MCP tool plan, then adapter payload is returned', async () => {
  const result = await executeToolPlan(
    [{ type: 'mcp_tool', name: 'web_search', arguments: { query: 'latest chip news' } }],
    {
      mcpExecutor: async (call) => ({
        ok: true,
        kind: 'mcp_tool',
        toolName: call.name,
        payload: { results: [{ title: 'Chip update', url: 'https://example.com/chip' }] },
      }),
    }
  )

  assert.equal(result.ok, true)
  assert.equal(result.kind, 'mcp_tool')
  assert.equal(result.toolName, 'web_search')
  assert.equal(Array.isArray(result.payload.results), true)
})