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

describe('POST /api/nora-homework/exercise', () => {
  afterEach(() => {
    jest.clearAllMocks()
  })

  afterAll(() => {
    global.Response = originalResponse
  })

  it('retries when AI returns an empty response for passage generation', async () => {
    callAI
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ message: { content: '   ' } }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ message: { content: '{"passage":"A short reading passage."}' } }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          message: {
            content:
              '{"questions":[{"id":1,"type":"multiple-choice","question":"Q1?","options":["A","B","C"],"correctAnswer":"A"},{"id":2,"type":"short-answer","question":"Q2?","correctAnswer":"Ans2"},{"id":3,"type":"short-answer","question":"Q3?","correctAnswer":"Ans3"}]}'
          },
        }),
      })

    const request = {
      json: jest.fn().mockResolvedValue({ subject: 'english', type: 'reading' }),
    }

    const response = await POST(request)
    const body = await response.json()

    expect(response.status).toBe(200)
    expect(body.passage).toBe('A short reading passage.')
    expect(Array.isArray(body.questions)).toBe(true)
    expect(body.questions).toHaveLength(3)
    expect(callAI).toHaveBeenCalledTimes(3)

    expect(callAI.mock.calls[0][0]).toEqual(
      expect.objectContaining({
        stream: false,
        think: false,
        format: expect.objectContaining({
          type: 'object',
          required: ['passage', 'lessonKeyPoint'],
        }),
      })
    )
    expect(callAI.mock.calls[0][0].messages[1].content).toContain('Theme:')
    expect(callAI.mock.calls[0][0].options.temperature).toBe(0.55)

    expect(callAI.mock.calls[2][0]).toEqual(
      expect.objectContaining({
        stream: false,
        think: false,
        format: expect.objectContaining({
          type: 'object',
          required: ['questions'],
        }),
      })
    )
  })

  it('returns 502 when passage generation remains empty after retries', async () => {
    callAI
      .mockResolvedValue({
        ok: true,
        json: async () => ({ message: { content: '   ' } }),
      })

    const request = {
      json: jest.fn().mockResolvedValue({ subject: 'english', type: 'reading' }),
    }

    const response = await POST(request)
    const body = await response.json()

    expect(response.status).toBe(502)
    expect(body.error).toBe('Empty response from AI')
    expect(callAI).toHaveBeenCalledTimes(3)
  })

  it('returns 502 when question generation remains empty after retries', async () => {
    callAI
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ message: { content: '{"passage":"Plants need water and sunlight to grow well."}' } }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ message: { content: ' ' } }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ message: { content: ' ' } }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ message: { content: ' ' } }),
      })

    const request = {
      json: jest.fn().mockResolvedValue({ subject: 'english', type: 'reading' }),
    }

    const response = await POST(request)
    const body = await response.json()

    expect(response.status).toBe(502)
    expect(body.error).toBe('Empty response from AI')
    expect(callAI).toHaveBeenCalledTimes(4)
  })

  it('accepts object content from AI structured output', async () => {
    callAI
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ message: { content: { passage: 'A valid structured passage.' } } }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          message: {
            content: {
              questions: [
                {
                  id: 1,
                  type: 'multiple-choice',
                  question: 'Q1?',
                  options: ['A', 'B', 'C'],
                  correctAnswer: 'A',
                },
                {
                  id: 2,
                  type: 'short-answer',
                  question: 'Q2?',
                  correctAnswer: 'Ans2',
                },
                {
                  id: 3,
                  type: 'short-answer',
                  question: 'Q3?',
                  correctAnswer: 'Ans3',
                },
              ],
            },
          },
        }),
      })

    const request = {
      json: jest.fn().mockResolvedValue({ subject: 'english', type: 'reading' }),
    }

    const response = await POST(request)
    const body = await response.json()

    expect(response.status).toBe(200)
    expect(body.passage).toBe('A valid structured passage.')
    expect(body.questions).toHaveLength(3)
    expect(callAI).toHaveBeenCalledTimes(2)
  })

  it('generates math mixed quiz with column-method multiplication and division coverage', async () => {
    const problems = Array.from({ length: 10 }, (_, i) => ({
      id: i + 1,
      problem: `Problem ${i + 1}`,
      problemType: i < 6 ? 'column-method' : 'standard',
      operands:
        i === 0
          ? ['24', '38']
          : i === 1
            ? ['84', '7']
            : i < 6
              ? ['324', '251']
              : [],
      operator: i === 0 ? '*' : i === 1 ? '/' : i < 6 ? '+' : '',
      operations: i === 0 ? ['multiplication'] : i === 1 ? ['division'] : ['addition'],
      expectedAnswer: i === 0 ? '912' : i === 1 ? '12' : String(575 + i),
      difficulty: i % 3 === 0 ? 'easy' : i % 3 === 1 ? 'medium' : 'hard',
    }))

    callAI.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ message: { content: { problems } } }),
    })

    const request = {
      json: jest.fn().mockResolvedValue({ subject: 'math', type: 'mixed' }),
    }

    const response = await POST(request)
    const body = await response.json()

    expect(response.status).toBe(200)
    expect(body.problems).toHaveLength(10)
    expect(
      body.problems.filter((p) => p.problemType === 'column-method').length
    ).toBeGreaterThanOrEqual(5)
    expect(body.problems.some((p) => p.problemType === 'column-method' && p.operator === '*')).toBe(true)
    expect(body.problems.some((p) => p.problemType === 'column-method' && p.operator === '/')).toBe(true)
    expect(callAI.mock.calls[0][0].messages[1].content).toContain('exactly 10 problems')
    expect(callAI.mock.calls[0][0].messages[1].content).toContain('multiplication, or division')
    expect(callAI.mock.calls[0][0].format.properties.problems.minItems).toBe(10)
  })
})
