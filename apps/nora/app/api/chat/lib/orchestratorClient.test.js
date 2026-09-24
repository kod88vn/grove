import { afterEach, describe, expect, it, jest } from '@jest/globals'

import { getExecutionPlan } from './orchestratorClient'

describe('getExecutionPlan', () => {
  const originalFetch = global.fetch

  afterEach(() => {
    jest.restoreAllMocks()
    delete process.env.NODE_ENV
    global.fetch = originalFetch
  })

  it('returns fast_chat fallback in test mode', async () => {
    process.env.NODE_ENV = 'test'
    const result = await getExecutionPlan('hello')

    // In test mode, classifyRoute is called. Since callAI throws in test env (no LMStudio),
    // the fallback reason is 'exception' — not 'test_mode_default'. Route is still fast_chat.
    expect(result.plan.route).toBe('fast_chat')
    expect(result.plan.reason).toBe('exception')
  })

  it('uses the local classifier without contacting orchestrator outside test mode', async () => {
    process.env.NODE_ENV = 'development'
    const fetchMock = jest.fn()
    global.fetch = fetchMock

    const result = await getExecutionPlan('write a haiku')
    expect(result.plan.route).toBe('fast_chat')
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('uses the local classifier for factual-query messages', async () => {
    process.env.NODE_ENV = 'development'
    global.fetch = jest.fn()

    const result = await getExecutionPlan('what is weather')
    expect(result.plan.route).toBe('factual_tool')
    expect(result.plan.reason).toBe('exception')
    expect(global.fetch).not.toHaveBeenCalled()
  })

  it('TEST_FALLBACK_ROUTE is respected in test mode even for factual-query messages (test isolation)', async () => {
    // Regression: buildFallbackPlan calls isCurrentInfoQuery(message) before checking
    // TEST_FALLBACK_ROUTE. When the message matches a factual-query pattern (e.g.,
    // "current stock price"), isCurrentInfoQuery returns true and the route becomes
    // 'factual_tool' regardless of TEST_FALLBACK_ROUTE. This silently changes test
    // behaviour depending on the message string, breaking test isolation.
    // The orchestrator's decision (or explicit TEST_FALLBACK_ROUTE) must be the sole
    // override mechanism in test mode — NOT a heuristic that inspects the message.
    process.env.NODE_ENV = 'test'
    process.env.TEST_FALLBACK_ROUTE = 'fast_chat'

    // "current stock price" matches isCurrentInfoQuery (version/live-data patterns),
    // so the buggy code returns factual_tool instead of the expected 'fast_chat'.
    const result = await getExecutionPlan('current stock price')

    expect(result.plan.route).toBe('fast_chat')
    expect(result.plan.reason).toBe('test_mode_default')
  })

})
