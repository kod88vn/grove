// Regression test for production outage: "LLM intent classifier returned empty response body".
// Verifies that buildFallbackPlan works without Ollama via keyword-based primary path.

import { getExecutionPlan } from './orchestratorClient.js'

describe('buildFallbackPlan without Ollama', () => {
  beforeEach(() => {
    delete process.env.TEST_FALLBACK_ROUTE
    delete process.env.ORCHESTRATOR_URL
  })

  afterEach(() => {
    delete process.env.TEST_FALLBACK_ROUTE
    delete process.env.ORCHESTRATOR_URL
  })

  describe('keyword-based fallback routing (orchestrator unreachable)', () => {
    test('returns factual_tool route for weather question when orchestrator is down', async () => {
      process.env.ORCHESTRATOR_URL = 'http://127.0.0.1:19999'
      const result = await getExecutionPlan('what is the weather in seattle')
      expect(result.plan.route).toBe('factual_tool')
      expect(result.plan.requireVerification).toBe(true)
    })

    test('returns fast_chat route for greeting when orchestrator is down', async () => {
      process.env.ORCHESTRATOR_URL = 'http://127.0.0.1:19999'
      const result = await getExecutionPlan('hello')
      expect(result.plan.route).toBe('fast_chat')
      expect(result.plan.requireVerification).toBe(false)
    })

    test('returns factual_tool route for factual questions when orchestrator is down', async () => {
      process.env.ORCHESTRATOR_URL = 'http://127.0.0.1:19999'
      const result = await getExecutionPlan('what happened to charlie kirk')
      expect(result.plan.route).toBe('factual_tool')
      expect(result.plan.requireVerification).toBe(true)
    })

    test('returns factual_tool for stock price queries when orchestrator is down', async () => {
      process.env.ORCHESTRATOR_URL = 'http://127.0.0.1:19999'
      const result = await getExecutionPlan('what is the current stock price of apple')
      expect(result.plan.route).toBe('factual_tool')
    })

    test('returns fast_chat for general knowledge when orchestrator is down', async () => {
      process.env.ORCHESTRATOR_URL = 'http://127.0.0.1:19999'
      const result = await getExecutionPlan('explain quantum computing')
      expect(result.plan.route).toBe('fast_chat')
    })

    test('failsafe: the fallback plan does not call Ollama and works in production without LLM', async () => {
      const start = Date.now()
      process.env.ORCHESTRATOR_URL = 'http://127.0.0.1:19999'

      const result = await getExecutionPlan('what is the current price of Bitcoin')

      const elapsed = Date.now() - start
      expect(elapsed).toBeLessThan(50) // keyword detection is synchronous, no Ollama call
      expect(result.plan.route).toBe('factual_tool')
    })

    test('TEST_FALLBACK_ROUTE overrides keyword detection in test mode', async () => {
      process.env.ORCHESTRATOR_URL = 'http://127.0.0.1:19999'
      process.env.TEST_FALLBACK_ROUTE = 'fast_chat'

      const result = await getExecutionPlan('what is the weather in seattle')
      expect(result.plan.route).toBe('fast_chat')
    })

    test('keyword-based routing provides correct plans for all common query types (orchestrator unreachable)', async () => {
      process.env.ORCHESTRATOR_URL = 'http://127.0.0.1:19999'

      const testCases = [
        { message: 'what is the weather in seattle', expectedRoute: 'factual_tool' },
        { message: 'hello', expectedRoute: 'fast_chat' },
        { message: 'what happened to charlie kirk', expectedRoute: 'factual_tool' },
        { message: 'how are you doing', expectedRoute: 'fast_chat' },
      ]

      for (const { message, expectedRoute } of testCases) {
        const result = await getExecutionPlan(message)
        expect(result.plan.route).toBe(expectedRoute, `message: ${message}`)
      }
    })

    test('keyword detection correctly classifies price queries', async () => {
      process.env.ORCHESTRATOR_URL = 'http://127.0.0.1:19999'
      const result = await getExecutionPlan('what is the price of bitcoin')
      // "price" keyword triggers requiresFactVerification → factual_tool
      expect(result.plan.route).toBe('factual_tool')
    })
  })
})