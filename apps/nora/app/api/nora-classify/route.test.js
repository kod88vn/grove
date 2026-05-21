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

import { POST } from './route'

// Mock callOllama before each test.
jest.mock('@/app/api/chat/lib/ollama', () => ({
  callOllama: jest.fn(),
}))

import { callOllama } from '@/app/api/chat/lib/ollama'

describe('POST /api/nora-classify', () => {
  beforeEach(() => {
    jest.resetModules()
    process.env.NORA_CLASSIFY_TIMEOUT_MS = undefined
    callOllama.mockReset()
  })

  function makeRequest(body) {
    return POST({
      json: jest.fn().mockResolvedValue(body),
    })
  }

  test('returns classification when Ollama succeeds', async () => {
    callOllama.mockResolvedValue({
      ok: true,
      async json() {
        return { message: { content: '{"route":"factual_tool","intent":"factual","confidence":"high","reason":"news lookup"}' } }
      },
    })

    const res = await makeRequest({ message: 'what is the latest news' })
    expect(res.status).toBe(200)

    const data = await res.json()
    expect(data.route).toBe('factual_tool')
    expect(data.intent).toBe('factual')
  })

  test('returns 400 when message is missing', async () => {
    const res = await makeRequest({})
    expect(res.status).toBe(400)

    const data = await res.json()
    expect(data.error).toBe('Missing or invalid message')
  })

  test('returns 400 when message is not a string', async () => {
    const res = await makeRequest({ message: 123 })
    expect(res.status).toBe(400)
  })

  test('uses custom model when provided', async () => {
    callOllama.mockResolvedValue({
      ok: true,
      async json() {
        return { message: { content: '{"route":"fast_chat","intent":"chat","confidence":"medium","reason":"casual"}' } }
      },
    })

    await makeRequest({ message: 'hello', model: 'custom-model' })

    expect(callOllama).toHaveBeenCalledWith(
      expect.objectContaining({ model: 'custom-model' })
    )
  })

  test('returns 502 when Ollama response is not ok', async () => {
    callOllama.mockResolvedValue({ ok: false, status: 503 })

    const res = await makeRequest({ message: 'what time is it' })
    expect(res.status).toBe(502)

    const data = await res.json()
    expect(data.error).toBe('Classification failed')
  })

  test('returns 502 when Ollama throws', async () => {
    callOllama.mockRejectedValue(new Error('network timeout'))

    const res = await makeRequest({ message: 'hello' })
    expect(res.status).toBe(502)

    const data = await res.json()
    expect(data.error).toBe('Classification failed')
    expect(data.detail).toContain('network timeout')
  })

  test('returns 502 when Ollama returns empty content', async () => {
    callOllama.mockResolvedValue({
      ok: true,
      async json() {
        return { message: {} }
      },
    })

    const res = await makeRequest({ message: 'hello' })
    expect(res.status).toBe(502)

    const data = await res.json()
    expect(data.detail).toContain('ollama_empty_content')
  })

  test('returns 502 when Ollama returns non-JSON content', async () => {
    callOllama.mockResolvedValue({
      ok: true,
      async json() {
        return { message: { content: 'not valid json' } }
      },
    })

    const res = await makeRequest({ message: 'hello' })
    expect(res.status).toBe(502)

    const data = await res.json()
    expect(data.error).toBe('Classification failed')
  })

  test('passes correct format and options to Ollama', async () => {
    callOllama.mockResolvedValue({
      ok: true,
      async json() {
        return { message: { content: '{"route":"fast_chat","intent":"chat","confidence":"low","reason":"test"}' } }
      },
    })

    await makeRequest({ message: 'hello' })

    expect(callOllama).toHaveBeenCalledWith(
      expect.objectContaining({
        stream: false,
        format: 'json',
        options: { temperature: 0, num_predict: 120 },
      })
    )

    const callArgs = callOllama.mock.calls[0][0]
    expect(callArgs.messages).toHaveLength(2)
    expect(callArgs.messages[0].role).toBe('system')
    expect(callArgs.messages[1].role).toBe('user')
  })
})