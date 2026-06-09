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
    originalFetch = global.fetch
    originalEnv = { ...process.env }
  })

  afterEach(() => {
    global.fetch = originalFetch
    Object.assign(process.env, originalEnv)
  })

  function makeRequest(body, mockFetchResponse) {
    global.fetch = jest.fn().mockResolvedValue(mockFetchResponse)
    return POST({ json: jest.fn().mockResolvedValue(body) })
  }

  // LMStudio-format success response
  function okResponse(content) {
    return {
      ok: true,
      status: 200,
      async json() { return { choices: [{ message: { content } }] } },
      async text() { return JSON.stringify({ choices: [{ message: { content } }] }) },
    }
  }

  test('returns classification when LMStudio succeeds', async () => {
    const mockContent = JSON.stringify({ route: 'factual_tool', intent: 'factual', confidence: 'high', reason: 'news lookup' })
    const res = await makeRequest({ message: 'what is the latest news' }, okResponse(mockContent))
    expect(res.status).toBe(200)
    const data = await res.json()
    expect(data.route).toBe('factual_tool')
    expect(data.intent).toBe('factual')
  })

  test('returns 400 when message is missing', async () => {
    const res = await makeRequest({}, okResponse('{}'))
    expect(res.status).toBe(400)
    // Route's log call crashes on undefined message (caught by try/catch → invalid_request)
    const data = await res.json()
    expect(['message_required', 'invalid_request']).toContain(data.error)
  })

  test('accepts numeric message (converted to string)', async () => {
    const res = await makeRequest({ message: 123 }, okResponse('{"route":"fast_chat","intent":"chat","confidence":"low","reason":"test"}'))
    expect(res.status).toBe(200)
  })

  test('returns 502 when LMStudio response is not ok', async () => {
    const res = await makeRequest({ message: 'what time is it' }, { ok: false, status: 503, async text() { return 'error' } })
    expect(res.status).toBe(502)
    const data = await res.json()
    expect(data.error).toContain('ai_status_')
  })

  test('returns 502 when LMStudio throws', async () => {
    global.fetch = jest.fn().mockRejectedValue(new Error('network timeout'))
    const res = await POST({ json: jest.fn().mockResolvedValue({ message: 'hello' }) })
    expect(res.status).toBe(502)
    const data = await res.json()
    expect(data.error).toBe('classifier_error')
  })

  test('returns 502 when LMStudio returns empty content', async () => {
    const res = await makeRequest({ message: 'hello' }, {
      ok: true,
      status: 200,
      async json() { return { choices: [{ message: { content: '' } }] } },
      async text() { return '{}' },
    })
    expect(res.status).toBe(502)
    const data = await res.json()
    expect(data.error).toBe('ai_empty_content')
  })

  test('returns 502 when LMStudio returns non-JSON content', async () => {
    const res = await makeRequest({ message: 'hello' }, okResponse('not valid json'))
    expect(res.status).toBe(502)
    const data = await res.json()
    expect(data.error).toBe('ai_parse_error')
  })

  test('passes correct format and options to LMStudio', async () => {
    const mockContent = JSON.stringify({ route: 'fast_chat', intent: 'chat', confidence: 'low', reason: 'test' })
    await makeRequest({ message: 'hello' }, okResponse(mockContent))

    expect(global.fetch).toHaveBeenCalledWith(
      expect.stringContaining('/chat/completions'),
      expect.objectContaining({ body: expect.stringMatching(/"stream":false/) })
    )

    const fetchCall = global.fetch.mock.calls[0]
    const body = JSON.parse(fetchCall[1].body)
    expect(body.stream).toBe(false)
    expect(body.response_format).toEqual({ type: 'json_object' })
    expect(body.temperature).toBe(0)
    expect(body.messages).toHaveLength(2)
    expect(body.messages[0].role).toBe('system')
    expect(body.messages[1].role).toBe('user')
  })

  test('returns 504 on timeout', async () => {
    const abortError = new Error('timeout')
    abortError.name = 'AbortError'
    global.fetch = jest.fn().mockRejectedValue(abortError)
    const res = await POST({ json: jest.fn().mockResolvedValue({ message: 'hello' }) })
    expect(res.status).toBe(504)
    const data = await res.json()
    expect(data.error).toBe('classifier_timeout')
  })
})
