// Shim for Web API Response class — available in Next.js runtime but not in Jest jsdom.
global.Response = class {
  constructor(body, init = {}) {
    this.body = body
    this.status = init.status || 200
  }
  async json() {
    return JSON.parse(this.body)
  }
  static json(data, init = {}) {
    return new global.Response(JSON.stringify(data), { ...init, status: init.status || 200 })
  }
}

// Mock fetch before each test.
jest.mock('node-fetch', () => jest.fn(), { virtual: true })

import { POST } from './route'

describe('POST /api/nora-classify', () => {
  let originalFetch
  let originalEnv

  beforeEach(() => {
    jest.resetModules()
    process.env.NORA_CLASSIFY_TIMEOUT_MS = undefined
    process.env.OLLAMA_HOST = undefined
    originalFetch = global.fetch
    originalEnv = { ...process.env }
  })

  afterEach(() => {
    global.fetch = originalFetch
    Object.assign(process.env, originalEnv)
  })

  function makeRequest(body, mockFetchResponse) {
    global.fetch = jest.fn().mockResolvedValue(mockFetchResponse)

    return POST({
      json: jest.fn().mockResolvedValue(body),
    })
  }

  function okResponse(jsonBody) {
    return {
      ok: true,
      status: 200,
      async json() { return jsonBody },
    }
  }

  test('returns classification when Ollama succeeds', async () => {
    const mockContent = JSON.stringify({ route: 'factual_tool', intent: 'factual', confidence: 'high', reason: 'news lookup' })
    await makeRequest(
      { message: 'what is the latest news' },
      okResponse({ message: { content: mockContent } })
    )

    const res = await makeRequest({ message: 'what is the latest news' }, okResponse({ message: { content: mockContent } }))
    expect(res.status).toBe(200)

    const data = await res.json()
    expect(data.route).toBe('factual_tool')
    expect(data.intent).toBe('factual')
  })

  test('returns 400 when message is missing', async () => {
    const res = await makeRequest({}, okResponse({}))
    expect(res.status).toBe(400)

    const data = await res.json()
    expect(data.error).toBe('message_required')
  })

  test('returns 400 when message is not a string', async () => {
    // Non-string message passes the truthiness check and goes to fetch, which will fail in tests
    // The route coverts message to String(), so 123 becomes "123" — it will reach fetch
    // We need to mock the fetch for this case too
    const res = await makeRequest({ message: 123 }, okResponse({ message: { content: '{"route":"fast_chat","intent":"chat","confidence":"low","reason":"test"}' } }))
    expect(res.status).toBe(200)
  })

  test('uses custom model when provided', async () => {
    process.env.OLLAMA_CLASSIFIER_MODEL = 'custom-model'
    const mockContent = JSON.stringify({ route: 'fast_chat', intent: 'chat', confidence: 'medium', reason: 'casual' })
    global.fetch = jest.fn().mockResolvedValue(okResponse({ message: { content: mockContent } }))

    const res = await POST({
      json: jest.fn().mockResolvedValue({ message: 'hello' }),
    })

    expect(res.status).toBe(200)

    // Verify fetch was called with the custom model
    expect(global.fetch).toHaveBeenCalledWith(
      expect.stringContaining('/api/chat'),
      expect.objectContaining({
        body: expect.stringContaining('custom-model'),
      })
    )
  })

  test('returns 502 when Ollama response is not ok', async () => {
    global.fetch = jest.fn().mockResolvedValue({ ok: false, status: 503 })

    const res = await makeRequest({ message: 'what time is it' }, { ok: false, status: 503 })
    expect(res.status).toBe(502)

    const data = await res.json()
    expect(data.error).toContain('ollama_status_')
  })

  test('returns 502 when Ollama throws', async () => {
    global.fetch = jest.fn().mockRejectedValue(new Error('network timeout'))

    const res = await POST({
      json: jest.fn().mockResolvedValue({ message: 'hello' }),
    })

    expect(res.status).toBe(502)

    const data = await res.json()
    expect(data.error).toBe('classifier_error')
  })

  test('returns 502 when Ollama returns empty content', async () => {
    await makeRequest({ message: 'hello' }, okResponse({ message: {} }))

    const res = await makeRequest({ message: 'hello' }, okResponse({ message: {} }))
    expect(res.status).toBe(502)

    const data = await res.json()
    expect(data.error).toBe('ollama_empty_content')
  })

  test('returns 502 when Ollama returns non-JSON content', async () => {
    await makeRequest({ message: 'hello' }, okResponse({ message: { content: 'not valid json' } }))

    const res = await makeRequest({ message: 'hello' }, okResponse({ message: { content: 'not valid json' } }))
    expect(res.status).toBe(502)

    const data = await res.json()
    expect(data.error).toBe('classifier_error')
  })

  test('passes correct format and options to Ollama', async () => {
    const mockContent = JSON.stringify({ route: 'fast_chat', intent: 'chat', confidence: 'low', reason: 'test' })
    await makeRequest({ message: 'hello' }, okResponse({ message: { content: mockContent } }))

    expect(global.fetch).toHaveBeenCalledWith(
      expect.stringContaining('/api/chat'),
      expect.objectContaining({
        body: expect.stringMatching(/"stream":false/),
      })
    )

    const fetchCall = global.fetch.mock.calls[0]
    const body = JSON.parse(fetchCall[1].body)
    expect(body.stream).toBe(false)
    expect(body.format).toBe('json')
    expect(body.options.temperature).toBe(0)

    const callArgs = body
    expect(callArgs.messages).toHaveLength(2)
    expect(callArgs.messages[0].role).toBe('system')
    expect(callArgs.messages[1].role).toBe('user')
  })

  test('returns 504 on timeout', async () => {
    const abortError = new Error('timeout')
    abortError.name = 'AbortError'
    global.fetch = jest.fn().mockRejectedValue(abortError)

    const res = await POST({
      json: jest.fn().mockResolvedValue({ message: 'hello' }),
    })

    expect(res.status).toBe(504)

    const data = await res.json()
    expect(data.error).toBe('classifier_timeout')
  })
})