// Tests for the shared classifyRoute helper.
// BDD style: Arrange-Act-Assert with clear expectations.

jest.mock('./callAI', () => ({
  callAI: jest.fn(),
}))

import { classifyRoute, routeToRequiresSearch, routeToPlan } from './classifyRoute'
import * as callAIModule from './callAI'

describe('classifyRoute', () => {
  let originalEnv
  
  beforeEach(() => {
    originalEnv = { ...process.env }
    jest.clearAllMocks()
  })

  afterEach(() => {
    process.env = originalEnv
  })

  test('should return fast_chat route with correct schema for mock response', async () => {
    jest.spyOn(callAIModule, 'callAI').mockImplementation(async () => ({
      ok: true,
      async json() {
        return { message: { content: '{"route":"fast_chat","intent":"chat","confidence":"high","reason":"test_mock"}' } }
      },
    }))

    const result = await classifyRoute('hello')
    
    expect(result).toHaveProperty('route')
    expect(result.route).toBe('fast_chat')
    expect(result).toHaveProperty('intent', 'chat')
    expect(result).toHaveProperty('confidence')
    expect(['low', 'medium', 'high']).toContain(result.confidence)
    expect(result).toHaveProperty('reason')
  })

  test('should handle empty input', async () => {
    const result = await classifyRoute('')
    expect(result.route).toBe('fast_chat')
    expect(result.reason).toBe('empty_input')

    const result2 = await classifyRoute(null)
    expect(result2.route).toBe('fast_chat')

    const result3 = await classifyRoute('  ')
    expect(result3.route).toBe('fast_chat')
  })

  test('should handle LLM failure gracefully', async () => {
    jest.spyOn(callAIModule, 'callAI').mockImplementation(async () => ({
      ok: false,
      status: 503,
      async json() { return {} },
    }))

    // "what is the weather" has factual query signals (WH-question), so fail-safe → factual_tool
    const result = await classifyRoute('what is the weather')
    expect(result.route).toBe('factual_tool')
    expect(result.reason).toContain('llm_unavailable')

    // "hi there" has no factual query signals, so fail-safe → fast_chat
    const result2 = await classifyRoute('hi there')
    expect(result2.route).toBe('fast_chat')
    expect(result2.reason).toContain('llm_unavailable')
  })

  test('should handle empty response gracefully', async () => {
    jest.spyOn(callAIModule, 'callAI').mockImplementation(async () => ({
      ok: true,
      async json() { return { message: {} } },
    }))

    // "what is the weather" has factual query signals → factual_tool on empty response
    const result = await classifyRoute('what is the weather')
    expect(result.route).toBe('factual_tool')
    expect(result.reason).toBe('empty_response')

    // "hi" has no factual query signals → fast_chat on empty response
    const result2 = await classifyRoute('hi')
    expect(result2.route).toBe('fast_chat')
    expect(result2.reason).toBe('empty_response')
  })

  test('should handle invalid JSON gracefully', async () => {
    jest.spyOn(callAIModule, 'callAI').mockImplementation(async () => ({
      ok: true,
      async json() { return { message: { content: 'not valid json at all' } } },
    }))

    // "what is the weather" has factual query signals → factual_tool on parse failure
    const result = await classifyRoute('what is the weather')
    expect(result.route).toBe('factual_tool')
    expect(result.reason).toBe('parse_failure')

    // "great stuff" has no factual query signals → fast_chat on parse failure
    const result2 = await classifyRoute('great stuff')
    expect(result2.route).toBe('fast_chat')
    expect(result2.reason).toBe('parse_failure')
  })

  test('should handle exception gracefully', async () => {
    jest.spyOn(callAIModule, 'callAI').mockImplementation(async () => {
      throw new Error('network error')
    })

    // "what is the weather" has factual query signals → factual_tool on exception
    const result = await classifyRoute('what is the weather')
    expect(result.route).toBe('factual_tool')
    expect(result.reason).toBe('exception')

    // "hello" has no factual query signals → fast_chat on exception
    const result2 = await classifyRoute('hello')
    expect(result2.route).toBe('fast_chat')
    expect(result2.reason).toBe('exception')
  })

  test('should parse valid JSON response correctly', async () => {
    jest.spyOn(callAIModule, 'callAI').mockImplementation(async () => ({
      ok: true,
      async json() {
        // normalized envelope: message.content (callLMStudio's non-stream shape)
        return { message: { content: '{"route":"factual_tool","intent":"weather","confidence":"high","reason":"weather query"}' } }
      },
    }))

    const result = await classifyRoute('what is the weather')
    expect(result.route).toBe('factual_tool')
    expect(result.intent).toBe('weather')
    expect(result.confidence).toBe('high')
    expect(result.reason).toBe('weather query')
  })

  test('should handle JSON with unquoted keys', async () => {
    jest.spyOn(callAIModule, 'callAI').mockImplementation(async () => ({
      ok: true,
      async json() {
        return { message: { content: '{route:"fast_chat",intent:"chat",confidence:"medium",reason:"test"}' } }
      },
    }))

    const result = await classifyRoute('hello there')
    expect(result.route).toBe('fast_chat')
  })

  test('should handle JSON with trailing commas', async () => {
    jest.spyOn(callAIModule, 'callAI').mockImplementation(async () => ({
      ok: true,
      async json() {
        return { message: { content: '{route:"reasoning",intent:"reasoning","confidence":"high","reason":"analysis",}' } }
      },
    }))

    const result = await classifyRoute('compare electric vs hybrid cars')
    expect(result.route).toBe('reasoning')
  })

  test('should default to fast_chat if route field is missing', async () => {
    jest.spyOn(callAIModule, 'callAI').mockImplementation(async () => ({
      ok: true,
      async json() {
        return { message: { content: '{"intent":"chat","confidence":"high","reason":"no route field"}' } }
      },
    }))

    // "hello" has no factual query signals → fast_chat fallback on missing route
    const result = await classifyRoute('hello')
    expect(result.route).toBe('fast_chat')
  })

  test('should default to factual_tool if route field is missing and message has factual signals', async () => {
    jest.spyOn(callAIModule, 'callAI').mockImplementation(async () => ({
      ok: true,
      async json() {
        return { message: { content: '{"intent":"factual","confidence":"high","reason":"no route field"}' } }
      },
    }))

    // "what is the latest news" has factual query signals → factual_tool fallback on missing route
    const result = await classifyRoute('what is the latest news')
    expect(result.route).toBe('factual_tool')
  })

  test('should handle reasoning route', async () => {
    jest.spyOn(callAIModule, 'callAI').mockImplementation(async () => ({
      ok: true,
      async json() {
        return { message: { content: '{"route":"reasoning","intent":"reasoning","confidence":"high","reason":"comparison"}' } }
      },
    }))

    const result = await classifyRoute('what are the pros and cons of electric vs hybrid cars')
    expect(result.route).toBe('reasoning')
  })

  test('should handle factual_tool route', async () => {
    jest.spyOn(callAIModule, 'callAI').mockImplementation(async () => ({
      ok: true,
      async json() {
        return { message: { content: '{"route":"factual_tool","intent":"factual","confidence":"high","reason":"current info"}' } }
      },
    }))

    const result = await classifyRoute('who is the current CEO of Apple')
    expect(result.route).toBe('factual_tool')
  })

  test('should handle local_tool route', async () => {
    jest.spyOn(callAIModule, 'callAI').mockImplementation(async () => ({
      ok: true,
      async json() {
        return { message: { content: '{"route":"local_tool","intent":"local_time","confidence":"high","reason":"clock time"}' } }
      },
    }))

    const result = await classifyRoute('what time is it')
    expect(result.route).toBe('local_tool')
  })

})

describe('routeToRequiresSearch', () => {
  test('should map factual_tool to requiresSearch:true', () => {
    const result = routeToRequiresSearch({ route: 'factual_tool', intent: 'factual', confidence: 'high', reason: 'test' })
    expect(result.requiresSearch).toBe(true)
  })

  test('should map local_tool to requiresSearch:true', () => {
    const result = routeToRequiresSearch({ route: 'local_tool', intent: 'local_time', confidence: 'high', reason: 'test' })
    expect(result.requiresSearch).toBe(true)
  })

  test('should map fast_chat to requiresSearch:false', () => {
    const result = routeToRequiresSearch({ route: 'fast_chat', intent: 'chat', confidence: 'high', reason: 'test' })
    expect(result.requiresSearch).toBe(false)
  })

  test('should map reasoning to requiresSearch:false', () => {
    const result = routeToRequiresSearch({ route: 'reasoning', intent: 'reasoning', confidence: 'high', reason: 'test' })
    expect(result.requiresSearch).toBe(false)
  })

  test('should preserve confidence from route result', () => {
    const result = routeToRequiresSearch({ route: 'fast_chat', intent: 'chat', confidence: 'medium', reason: 'test' })
    expect(result.confidence).toBe('medium')
  })

  test('should include route name in reason', () => {
    const result = routeToRequiresSearch({ route: 'factual_tool', intent: 'weather', confidence: 'high', reason: 'weather' })
    expect(result.reason).toContain('factual_tool')
  })
})

describe('routeToPlan', () => {
  test('should build plan for factual_tool', () => {
    const result = routeToPlan({ route: 'factual_tool', intent: 'weather', confidence: 'high', reason: 'test' })
    expect(result.plan.route).toBe('factual_tool')
    expect(result.plan.promptProfile).toBe('factual')
    expect(result.plan.requireVerification).toBe(true)
    expect(result.plan.skipToolPlanning).toBe(false)
  })

  test('should build plan for fast_chat', () => {
    const result = routeToPlan({ route: 'fast_chat', intent: 'chat', confidence: 'high', reason: 'test' })
    expect(result.plan.route).toBe('fast_chat')
    expect(result.plan.promptProfile).toBe('fast')
    expect(result.plan.requireVerification).toBe(false)
    expect(result.plan.skipToolPlanning).toBe(true)
  })

  test('should build plan for local_tool', () => {
    const result = routeToPlan({ route: 'local_tool', intent: 'local_time', confidence: 'high', reason: 'test' })
    expect(result.plan.route).toBe('local_tool')
    expect(result.plan.promptProfile).toBe('fast') // local_tool is not factual_tool
    expect(result.plan.requireVerification).toBe(false)
  })

  test('should build plan for reasoning', () => {
    const result = routeToPlan({ route: 'reasoning', intent: 'reasoning', confidence: 'high', reason: 'test' })
    expect(result.plan.route).toBe('reasoning')
    expect(result.plan.promptProfile).toBe('fast')
  })

  test('should preserve route result confidence in plan', () => {
    const result = routeToPlan({ route: 'fast_chat', intent: 'chat', confidence: 'medium', reason: 'test' })
    expect(result.plan.confidence).toBe('medium')
  })

  test('should always set useModel to true', () => {
    const result = routeToPlan({ route: 'fast_chat', intent: 'chat', confidence: 'low', reason: 'test' })
    expect(result.plan.useModel).toBe(true)
  })
})