import test from 'node:test'
import assert from 'node:assert/strict'

import {
  classifyIntent,
  classifyIntentWithModel,
  buildExecutionPlan,
  buildExecutionPlanWithClassifier,
} from './intentRouter.js'

// Sync classifyIntent now only emits a safe default (fast_chat/low) — it
// never inspects content. Routing decisions come from classifyIntentWithModel.

test('Given empty message, when classifying intent, then route is fast_chat with low confidence', () => {
  const result = classifyIntent('')
  assert.equal(result.route, 'fast_chat')
  assert.equal(result.confidence, 'low')
})

test('Given any non-empty message, when classifying intent without a model, then safe default fast_chat/low is returned', () => {
  const result = classifyIntent('is iron a metal?')
  assert.equal(result.route, 'fast_chat')
  assert.equal(result.confidence, 'low')
  assert.equal(result.reason, 'no_classifier')
})

test('Given a current-info question without a model, then classifyIntent falls back to factual_tool', () => {
  const result = classifyIntent('who is the sitting president?')
  assert.equal(result.route, 'factual_tool')
  assert.equal(result.intent, 'factual')
  assert.equal(result.reason, 'fallback_factual_current_info')
})

test('Given a model classifier returning fast_chat for a current-info query, then classifyIntentWithModel promotes it to factual_tool', async () => {
  const result = await classifyIntentWithModel('what is the latest version of nextjs?', {
    classifyWithModel: async () => ({ route: 'fast_chat', confidence: 'medium' }),
  })
  assert.equal(result.route, 'factual_tool')
  assert.equal(result.intent, 'factual')
  assert.equal(result.reason, 'fallback_factual_current_info')
})

test('Given a model classifier returning local_tool, when classifying with model, then route normalizes to local_tool with toolName', async () => {
  const result = await classifyIntentWithModel('what time is it', {
    classifyWithModel: async () => ({ route: 'local_tool', confidence: 'high', reason: 'clock_question' }),
  })
  assert.equal(result.route, 'local_tool')
  assert.equal(result.toolName, 'get_current_time')
  assert.equal(result.intent, 'local_time')
})

test('Given a model classifier returning factual_tool, when classifying with model, then route normalizes to factual_tool', async () => {
  const result = await classifyIntentWithModel('what is the weather forecast in duluth tomorrow', {
    classifyWithModel: async () => ({ route: 'factual_tool', intent: 'weather', confidence: 'high' }),
  })
  assert.equal(result.route, 'factual_tool')
  assert.equal(result.intent, 'weather')
})

test('Given a model classifier returning reasoning, when classifying with model, then route normalizes to reasoning', async () => {
  const result = await classifyIntentWithModel('compare three architectures with tradeoffs', {
    classifyWithModel: async () => ({ route: 'reasoning', confidence: 'medium' }),
  })
  assert.equal(result.route, 'reasoning')
  assert.equal(result.intent, 'reasoning')
})

test('Given a model classifier returning an invalid route, when classifying with model, then safe default fast_chat is used', async () => {
  const result = await classifyIntentWithModel('compare two architectures', {
    classifyWithModel: async () => ({ route: 'unknown_route', confidence: 'high' }),
  })
  assert.equal(result.route, 'fast_chat')
  assert.equal(result.confidence, 'low')
})

test('Given a model classifier that throws, when classifying with model, then safe default fast_chat is used', async () => {
  const result = await classifyIntentWithModel('compare two architectures', {
    classifyWithModel: async () => {
      throw new Error('boom')
    },
  })
  assert.equal(result.route, 'fast_chat')
  assert.equal(result.confidence, 'low')
})

test('Given local tool model intent, when building plan via classifier, then plan disables model reasoning', async () => {
  const plan = await buildExecutionPlanWithClassifier('what time is it', {}, {
    classifyWithModel: async () => ({ route: 'local_tool', confidence: 'high' }),
  })
  assert.equal(plan.route, 'local_tool')
  assert.equal(plan.useModel, false)
  assert.equal(plan.skipToolPlanning, true)
})

test('Given fast chat model intent, when building plan via classifier, then plan uses fast profile', async () => {
  const plan = await buildExecutionPlanWithClassifier('rewrite this in a friendly tone', {}, {
    classifyWithModel: async () => ({ route: 'fast_chat', confidence: 'high' }),
  })
  assert.equal(plan.route, 'fast_chat')
  assert.equal(plan.promptProfile, 'fast')
  assert.equal(plan.requireVerification, false)
})

test('Given factual model intent, when building plan via classifier, then plan requires verification', async () => {
  const plan = await buildExecutionPlanWithClassifier('who is the current us president', {}, {
    classifyWithModel: async () => ({ route: 'factual_tool', intent: 'factual', confidence: 'high' }),
  })
  assert.equal(plan.route, 'factual_tool')
  assert.equal(plan.promptProfile, 'factual')
  assert.equal(plan.requireVerification, true)
  assert.equal(plan.skipToolPlanning, false)
})

test('Given a classifier failure, when building plan via classifier, then plan falls back to fast_chat', async () => {
  const plan = await buildExecutionPlanWithClassifier('tell me something interesting', {}, {
    classifyWithModel: async () => {
      throw new Error('classifier unavailable')
    },
  })

  assert.equal(plan.route, 'fast_chat')
  assert.equal(plan.promptProfile, 'fast')
  assert.equal(plan.requireVerification, false)
  assert.equal(plan.skipToolPlanning, true)
  assert.deepEqual(plan.toolPlan, [])
})

test('Given weather widget surface, when building sync plan, then weather skill metadata is attached', () => {
  const plan = buildExecutionPlan('what is the weather forecast in duluth tomorrow', { surface: 'weather_widget' })

  assert.equal(plan.route, 'structured_data')
  assert.equal(plan.responseMode, 'structured_data')
  assert.equal(plan.schemaName, 'weather_v1')
  assert.deepEqual(plan.skillSet, ['weather_widget'])
  assert.equal(plan.allowProse, false)
  assert.equal(plan.requireVerification, true)
})
