import test from 'node:test'
import assert from 'node:assert/strict'

import { buildExecutionPlan, buildExecutionPlanWithClassifier } from '../src/planner.js'

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

test('Given factual request, when building execution plan, then factual lookup uses executable MCP tool plan', () => {
  const plan = buildExecutionPlan("who's the current president")

  assert.equal(plan.route, 'factual_tool')
  assert.deepEqual(plan.skillSet, ['search_and_summarize'])
  assert.equal(plan.toolPlan[0].type, 'mcp_tool')
  assert.equal(plan.toolPlan[0].name, 'factual_lookup')
  assert.equal(plan.toolPlan[0].arguments.query, "who's the current president")
})

test('Given ambiguous prompt and model classifier result, when building execution plan, then model route is used', async () => {
  const plan = await buildExecutionPlanWithClassifier('give me an update on chip exports', {}, {
    classifyWithModel: async () => ({
      route: 'factual_tool',
      intent: 'factual',
      confidence: 'medium',
      reason: 'current_event_request',
    }),
  })

  assert.equal(plan.route, 'factual_tool')
  assert.deepEqual(plan.skillSet, ['search_and_summarize'])
  assert.equal(plan.skipToolPlanning, false)
})

test('Given invalid model classifier result, when building execution plan, then deterministic fallback is used', async () => {
  const plan = await buildExecutionPlanWithClassifier('rewrite this in a friendlier voice', {}, {
    classifyWithModel: async () => ({
      route: 'unknown_route',
      confidence: 'high',
      reason: 'bad_output',
    }),
  })

  assert.equal(plan.route, 'fast_chat')
  assert.deepEqual(plan.skillSet, ['general_family_chat'])
  assert.equal(plan.skipToolPlanning, true)
})