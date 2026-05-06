import test from 'node:test'
import assert from 'node:assert/strict'

import { buildExecutionPlan } from '../src/planner.js'

test('Given casual chat, when building execution plan, then chat skill metadata is attached', () => {
  const plan = buildExecutionPlan('tell me a short bedtime story')

  assert.equal(plan.route, 'fast_chat')
  assert.equal(plan.responseMode, 'chat')
  assert.deepEqual(plan.skillSet, ['general_family_chat'])
  assert.equal(plan.allowProse, true)
})

test('Given reasoning request, when building execution plan, then reasoning skill metadata is attached', () => {
  const plan = buildExecutionPlan('compare two deployment architectures with tradeoffs')

  assert.equal(plan.route, 'reasoning')
  assert.equal(plan.responseMode, 'chat')
  assert.deepEqual(plan.skillSet, ['planning_reasoning'])
  assert.equal(plan.requireVerification, true)
})

test('Given local time request, when building execution plan, then local_time skill metadata is attached', () => {
  const plan = buildExecutionPlan('what is the current time')

  assert.equal(plan.route, 'local_tool')
  assert.deepEqual(plan.skillSet, ['local_time'])
  assert.equal(plan.schemaName, 'local_time_v1')
  assert.equal(plan.allowProse, false)
})