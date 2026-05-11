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

describe('POST /api/nora-homework/exercise', () => {
  afterEach(() => {
    jest.clearAllMocks()
  })

  afterAll(() => {
    global.Response = originalResponse
  })

  it('retries when Ollama returns an empty response for passage generation', async () => {
    callOllama
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
    expect(callOllama).toHaveBeenCalledTimes(3)

    expect(callOllama.mock.calls[0][0]).toEqual(
      expect.objectContaining({
        stream: false,
        think: false,
        format: expect.objectContaining({
          type: 'object',
          required: ['passage'],
        }),
      })
    )
    expect(callOllama.mock.calls[0][0].messages[1].content).toContain('Theme:')
    expect(callOllama.mock.calls[0][0].options.temperature).toBe(0.55)

    expect(callOllama.mock.calls[2][0]).toEqual(
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
    callOllama
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
    expect(body.error).toBe('Empty response from Ollama')
    expect(callOllama).toHaveBeenCalledTimes(3)
  })

  it('returns 502 when question generation remains empty after retries', async () => {
    callOllama
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
    expect(body.error).toBe('Empty response from Ollama')
    expect(callOllama).toHaveBeenCalledTimes(4)
  })

  it('accepts object content from Ollama structured output', async () => {
    callOllama
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
    expect(callOllama).toHaveBeenCalledTimes(2)
  })

  it('falls back to candidate profile when profile review returns empty', async () => {
    callOllama
      .mockResolvedValueOnce({ ok: true, json: async () => ({ message: { content: '   ' } }) })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ message: { content: '{"passage":"A fallback-profile passage."}' } }),
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
    expect(body.passage).toBe('A fallback-profile passage.')
    expect(body.questions).toHaveLength(3)
    expect(callOllama).toHaveBeenCalledTimes(3)
  })
})
