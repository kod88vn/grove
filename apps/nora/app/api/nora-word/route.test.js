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
const { POST } = require('./route')

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

    const request = {
      json: jest.fn().mockResolvedValue({ level: 'highschool' }),
    }

    const response = await POST(request)
    const body = await response.json()

    expect(response.status).toBe(503)
    expect(body.error).toBe('ai_unavailable')
    expect(callAI).toHaveBeenCalledTimes(2)
  })
})
