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

jest.mock('../../../lib/ollama', () => ({
  gradeSubmission: jest.fn(),
}))

jest.mock('../../../lib/progress', () => ({
  recordSubmission: jest.fn().mockReturnValue({ id: 'progress-1' }),
}))

const { gradeSubmission } = jest.requireMock('../../../lib/ollama')
const { POST } = require('./route')

describe('POST /api/grade', () => {
  afterEach(() => {
    jest.clearAllMocks()
  })

  afterAll(() => {
    global.Response = originalResponse
  })

  it('returns grade payload on success', async () => {
    gradeSubmission.mockResolvedValue({
      totalCorrect: 2,
      totalProblems: 3,
      comment: 'Good work',
      problems: [],
    })

    const request = {
      json: jest.fn().mockResolvedValue({
        subject: 'math',
        type: 'mixed',
        exercise: { problems: [{ id: 1 }, { id: 2 }, { id: 3 }] },
        answers: { '1': '10', '2': '20', '3': '30' },
      }),
    }

    const response = await POST(request)
    const body = await response.json()

    expect(response.status).toBe(200)
    expect(body.score).toBe(2)
    expect(body.maxScore).toBe(3)
  })

  it('preserves upstream Nora 502 status', async () => {
    gradeSubmission.mockRejectedValue(new Error('Nora API error 502: {"error":"Empty response from Ollama"}'))

    const request = {
      json: jest.fn().mockResolvedValue({
        subject: 'math',
        type: 'mixed',
        exercise: { problems: [{ id: 1 }] },
        answers: { '1': '10' },
      }),
    }

    const response = await POST(request)
    const body = await response.json()

    expect(response.status).toBe(502)
    expect(body.error).toContain('Nora API error 502')
  })
})