import test from 'node:test'
import assert from 'node:assert/strict'

import { classifyIntent, buildExecutionPlan } from '../src/intentRouter.js'

test('Given local command, when classifying intent, then route is local_tool', () => {
  const result = classifyIntent('what time is it right now')
  assert.equal(result.route, 'local_tool')
  assert.equal(result.toolName, 'get_current_time')
})

test('Given casual chat, when classifying intent, then route is fast_chat', () => {
  const result = classifyIntent('tell me a short bedtime story about dragons')
  assert.equal(result.route, 'fast_chat')
})

test('Given factual weather query, when classifying intent, then route is factual_tool', () => {
  const result = classifyIntent('what is the weather forecast in duluth tomorrow')
  assert.equal(result.route, 'factual_tool')
})

test('Given complex analytical request, when classifying intent, then route is reasoning', () => {
  const result = classifyIntent('compare three home AI deployment architectures with tradeoffs')
  assert.equal(result.route, 'reasoning')
})

test('Given local tool intent, when building plan, then plan disables model reasoning', () => {
  const plan = buildExecutionPlan('what time is it')
  assert.equal(plan.route, 'local_tool')
  assert.equal(plan.useModel, false)
  assert.equal(plan.skipToolPlanning, true)
})

test('Given fast chat intent, when building plan, then plan uses fast profile', () => {
  const plan = buildExecutionPlan('rewrite this text in a friendly tone')
  assert.equal(plan.route, 'fast_chat')
  assert.equal(plan.promptProfile, 'fast')
  assert.equal(plan.requireVerification, false)
})

test('Given factual intent, when building plan, then plan requires verification', () => {
  const plan = buildExecutionPlan('who is the current us president')
  assert.equal(plan.route, 'factual_tool')
  assert.equal(plan.promptProfile, 'factual')
  assert.equal(plan.requireVerification, true)
})

test('Given weather widget intent, when building plan, then plan selects strict structured skill metadata', () => {
  const plan = buildExecutionPlan('what is the weather forecast in duluth tomorrow')

  assert.equal(plan.route, 'structured_data')
  assert.equal(plan.responseMode, 'structured_data')
  assert.equal(plan.schemaName, 'weather_v1')
  assert.deepEqual(plan.skillSet, ['weather_widget'])
  assert.equal(plan.allowProse, false)
  assert.equal(plan.requireVerification, true)
})
