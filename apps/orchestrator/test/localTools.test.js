import test from 'node:test'
import assert from 'node:assert/strict'

import { executeLocalTool } from '../src/localTools.js'

test('Given get_current_time tool, when executing, then returns structured payload', () => {
  const result = executeLocalTool({ name: 'get_current_time' })
  assert.equal(result.ok, true)
  assert.equal(result.toolName, 'get_current_time')
  assert.equal(typeof result.payload.iso, 'string')
  assert.equal(typeof result.payload.localTime, 'string')
})

test('Given unknown local tool, when executing, then returns typed error response', () => {
  const result = executeLocalTool({ name: 'unknown_tool' })
  assert.equal(result.ok, false)
  assert.equal(result.error.code, 'UNKNOWN_LOCAL_TOOL')
})
