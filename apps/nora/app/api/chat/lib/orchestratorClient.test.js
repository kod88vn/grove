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

  it('uses orchestrator payload outside test mode', async () => {
    process.env.NODE_ENV = 'development'
    const fetchMock = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        plan: { route: 'fast_chat', promptProfile: 'fast' },
        execution: null,
      }),
    })
    global.fetch = fetchMock

    const result = await getExecutionPlan('write a haiku')
    expect(result.plan.route).toBe('fast_chat')
    expect(fetchMock).toHaveBeenCalledTimes(1)
    const [url, options] = fetchMock.mock.calls[0]
    expect(url).toContain('/orchestrate')
    expect(options.method).toBe('POST')
  })

  it('falls back to factual_tool when orchestrator is unavailable (fail-safe toward web search)', async () => {
    process.env.NODE_ENV = 'development'
    global.fetch = jest.fn().mockRejectedValue(new Error('offline'))

    const result = await getExecutionPlan('what is weather')
    // classifyRoute throws (no LMStudio) → fallback to factual_tool (hasFactualQuerySignals matches "weather")
    expect(result.plan.route).toBe('factual_tool')
    // Reason is 'exception' because classifyRoute caught a callAI error, not 'orchestrator_unreachable'
    expect(result.plan.reason).toBe('exception')
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

  it('retains orchestrator plan from non-OK responses when payload includes plan', async () => {
    process.env.NODE_ENV = 'development'
    global.fetch = jest.fn().mockResolvedValue({
      ok: false,
      status: 503,
      json: async () => ({
        plan: { route: 'factual_tool', promptProfile: 'factual', skillSet: ['search_and_summarize'] },
        error: { code: 'MCP_TOOL_UNAVAILABLE' },
      }),
    })

    const result = await getExecutionPlan("who's the current president")
    expect(result.plan.route).toBe('factual_tool')
    expect(result.plan.skillSet).toEqual(['search_and_summarize'])
    expect(result.error.code).toBe('MCP_TOOL_UNAVAILABLE')
  })
})
