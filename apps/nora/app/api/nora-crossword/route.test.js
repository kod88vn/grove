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

function wordBankContent() {
  const answers = [
    'PLANET', 'RIVER', 'GARDEN', 'ROCKET', 'PUPPY', 'LADDER', 'ORANGE', 'TUNNEL',
    'CLOUDS', 'DRUMS', 'FROG', 'HAMMOCK', 'ISLAND', 'KEYBOARD', 'LAMPS', 'MANGO',
  ]
  const pairs = answers.map((a) => ({ answer: a, clue: 'Clue for ' + a.toLowerCase() }))
  return JSON.stringify({ pairs })
}

describe('POST /api/nora-crossword', () => {
  afterEach(() => {
    jest.clearAllMocks()
  })

  afterAll(() => {
    global.Response = originalResponse
  })

  // Regression: the route placed `think` at the top level of the callAI payload,
  // but buildLmstudioPayload only honors `options.think`/`options.response_format`.
  // The Qwen3.6 thinking model was left in thinking mode and burned its 1500-token
  // budget on reasoning (same root cause as the nora-word repeated-word bug).
  it('sends enable_thinking=false and json_object response_format to the backend', async () => {
    callAI.mockResolvedValue({
      ok: true,
      json: async () => ({ message: { content: wordBankContent() } }),
    })

    const request = { json: async () => ({ level: 'elementary' }) }
    const response = await POST(request)
    expect(response.status).toBe(200)
    expect(callAI).toHaveBeenCalledTimes(1)

    const wirePayload = buildLmstudioPayload(callAI.mock.calls[0][0])
    expect(wirePayload.enable_thinking).toBe(false)
    expect(wirePayload.response_format).toEqual({ type: 'json_object' })
    expect(wirePayload.temperature).toBeGreaterThan(0)
  })
})
