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

    expect(result.plan.route).toBe('fast_chat')
    expect(result.plan.reason).toBe('test_mode_default')
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

  it('falls back to fast_chat when orchestrator is unavailable', async () => {
    process.env.NODE_ENV = 'development'
    global.fetch = jest.fn().mockRejectedValue(new Error('offline'))

    const result = await getExecutionPlan('what is weather')
    expect(result.plan.route).toBe('fast_chat')
    expect(result.plan.reason).toBe('orchestrator_unreachable')
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
