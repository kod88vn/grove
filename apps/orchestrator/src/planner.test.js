import test from 'node:test'
import assert from 'node:assert/strict'

import { buildExecutionPlan, buildExecutionPlanWithClassifier } from './planner.js'

test('Given fast_chat model intent, when building execution plan, then chat skill metadata is attached', async () => {
  const plan = await buildExecutionPlanWithClassifier('tell me a short bedtime story', {}, {
    classifyWithModel: async () => ({ route: 'fast_chat', confidence: 'high' }),
  })

  assert.equal(plan.route, 'fast_chat')
  assert.equal(plan.responseMode, 'chat')
  assert.deepEqual(plan.skillSet, ['general_family_chat'])
  assert.equal(plan.allowProse, true)
})

test('Given reasoning model intent, when building execution plan, then reasoning skill metadata is attached', async () => {
  const plan = await buildExecutionPlanWithClassifier('compare two deployment architectures with tradeoffs', {}, {
    classifyWithModel: async () => ({ route: 'reasoning', confidence: 'medium' }),
  })

  assert.equal(plan.route, 'reasoning')
  assert.equal(plan.responseMode, 'chat')
  assert.deepEqual(plan.skillSet, ['planning_reasoning'])
  assert.equal(plan.requireVerification, true)
})

test('Given local_tool model intent, when building execution plan, then local_time skill metadata is attached', async () => {
  const plan = await buildExecutionPlanWithClassifier('what is the current time', {}, {
    classifyWithModel: async () => ({ route: 'local_tool', confidence: 'high' }),
  })

  assert.equal(plan.route, 'local_tool')
  assert.deepEqual(plan.skillSet, ['local_time'])
  assert.equal(plan.schemaName, 'local_time_v1')
  assert.equal(plan.allowProse, false)
})

test('Given safe-default sync plan, when building execution plan without classifier, then factual_tool is the safe fallback', () => {
  const plan = buildExecutionPlan("who's the current president")

  // Safe default is factual_tool — prefer search over hallucination when model is unavailable
  assert.equal(plan.route, 'factual_tool')
  assert.equal(plan.intent, 'factual')
  assert.equal(plan.confidence, 'low')
  assert.equal(plan.reason, 'no_classifier')
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

test('Given invalid model classifier result, when building execution plan, then safe default factual_tool is used', async () => {
  const plan = await buildExecutionPlanWithClassifier('rewrite this in a friendlier voice', {}, {
    classifyWithModel: async () => ({
      route: 'unknown_route',
      confidence: 'high',
      reason: 'bad_output',
    }),
  })

  // Invalid route fails normalization, so classifyIntentWithModel falls back to safe default (factual_tool)
  assert.equal(plan.route, 'factual_tool')
  assert.equal(plan.intent, 'factual')
})
