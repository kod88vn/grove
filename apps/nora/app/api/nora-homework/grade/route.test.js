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

jest.mock('@/app/api/chat/lib/ollama', () => ({
  callOllama: jest.fn(),
}))

const { callOllama } = jest.requireMock('@/app/api/chat/lib/ollama')
const { POST } = require('./route')

describe('POST /api/nora-homework/grade', () => {
  afterEach(() => {
    jest.clearAllMocks()
  })

  afterAll(() => {
    global.Response = originalResponse
  })

  it('grades math mixed with structured output format', async () => {
    callOllama.mockResolvedValue({
      ok: true,
      json: async () => ({
        message: {
          content: {
            problems: [
              { id: 1, answer: '42', correct: true, workShown: true, feedback: 'Great work.' },
              { id: 2, answer: '12', correct: false, workShown: true, feedback: 'Check multiplication.' },
              { id: 3, answer: '8', correct: true, workShown: false, feedback: 'Show more steps.' },
            ],
            totalCorrect: 2,
            totalProblems: 3,
            score: 2,
            comment: 'Nice effort. Show all steps next time.',
          },
        },
      }),
    })

    const request = {
      json: jest.fn().mockResolvedValue({
        subject: 'math',
        type: 'mixed',
        exercise: { problems: [{ id: 1 }, { id: 2 }, { id: 3 }] },
        answers: { '1': '42', '2': '12', '3': '8' },
      }),
    }

    const response = await POST(request)
    const body = await response.json()

    expect(response.status).toBe(200)
    expect(body.totalCorrect).toBe(2)
    expect(body.problems).toHaveLength(3)

    expect(callOllama.mock.calls[0][0]).toEqual(
      expect.objectContaining({
        stream: false,
        think: false,
        format: expect.objectContaining({
          type: 'object',
          required: ['problems', 'totalCorrect', 'totalProblems', 'score', 'comment'],
        }),
      })
    )
  })

  it('retries then returns 502 when Ollama stays empty', async () => {
    callOllama.mockResolvedValue({
      ok: true,
      json: async () => ({ message: { content: '   ' } }),
    })

    const request = {
      json: jest.fn().mockResolvedValue({
        subject: 'math',
        type: 'mixed',
        exercise: { problems: [{ id: 1 }] },
        answers: { '1': '5' },
      }),
    }

    const response = await POST(request)
    const body = await response.json()

    expect(response.status).toBe(502)
    expect(body.error).toBe('Empty response from Ollama')
    expect(callOllama).toHaveBeenCalledTimes(3)
  })
})
