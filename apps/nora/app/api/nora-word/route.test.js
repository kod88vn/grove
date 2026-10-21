import { afterAll, afterEach, describe, expect, it, jest } from '@jest/globals'

class TestResponse {
  constructor(body, init = {}) {
    this.body = body
    this.status = init.status ?? 200
    this.headers = init.headers ?? {}
  }

  static json(payload, init = {}) {
    return new TestResponse(JSON.stringify(payload), {
      ...init,
      headers: {
        'Content-Type': 'application/json',
        ...(init.headers ?? {}),
      },
    })
  }

  async json() {
    return JSON.parse(this.body)
  }
}

const originalResponse = global.Response
if (!global.Response) {
  global.Response = TestResponse
}

jest.mock('@/app/api/chat/lib/callAI', () => ({
  callAI: jest.fn(),
}))

const { callAI } = jest.requireMock('@/app/api/chat/lib/callAI')
const { buildLmstudioPayload } = require('@/app/api/chat/lib/lmstudioClient')
const { POST } = require('./route')

function wordCall(level = 'elementary') {
  return {
    json: jest.fn().mockResolvedValue({ level }),
  }
}

describe('POST /api/nora-word', () => {
  afterEach(() => {
    jest.clearAllMocks()
  })

  afterAll(() => {
    global.Response = originalResponse
  })

  it('retries and succeeds when first response is invalid JSON', async () => {
    callAI
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          message: { content: 'not-json' },
        }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          message: {
            content: '{"word":"ELEPHANT","hint":"Largest land animal","mascot":"🐘"}',
          },
        }),
      })

    const request = {
      json: jest.fn().mockResolvedValue({ level: 'elementary' }),
    }

    const response = await POST(request)
    const body = await response.json()

    expect(response.status).toBe(200)
    expect(body.word).toBe('ELEPHANT')
    expect(callAI).toHaveBeenCalledTimes(2)
  })

  it('returns 503 when ai is unavailable after retries', async () => {
    callAI.mockRejectedValue(new Error('unavailable'))

    const request = wordCall('highschool')

    const response = await POST(request)
    const body = await response.json()

    expect(response.status).toBe(503)
    expect(body.error).toBe('ai_unavailable')
    expect(callAI).toHaveBeenCalledTimes(2)
  })

  // Regression: the route placed `think`/`format` at the top level of the callAI payload,
  // but buildLmstudioPayload only honors `options.think`/`options.response_format`. The
  // Qwen3.6 thinking model was therefore left in thinking mode, burned its token budget on
  // reasoning, and the route kept returning the same word on every call.
  it('sends enable_thinking=false and json_object response_format to the backend', async () => {
    callAI.mockResolvedValue({
      ok: true,
      json: async () => ({
        message: { content: '{"word":"ORCHID","hint":"A fragrant flower","mascot":"🌸"}' },
      }),
    })

    const response = await POST(wordCall())
    expect((await response.json()).word).toBe('ORCHID')

    const wirePayload = buildLmstudioPayload(callAI.mock.calls[0][0])

    expect(wirePayload.enable_thinking).toBe(false)
    expect(wirePayload.response_format).toEqual({ type: 'json_object' })
    expect(wirePayload.temperature).toBeGreaterThan(0)
  })

  it('prompt steers the model toward a different word and never tells it to ignore the variation token', async () => {
    callAI.mockResolvedValue({
      ok: true,
      json: async () => ({
        message: { content: '{"word":"ORCHID","hint":"A fragrant flower","mascot":"🌸"}' },
      }),
    })

    await POST(wordCall())

    const userMessage = callAI.mock.calls[0][0].messages[1].content
    expect(userMessage).not.toContain('ignore content')
    expect(userMessage).toContain('starts with the letter')
    expect(userMessage).toContain('JSON')
  })
})
