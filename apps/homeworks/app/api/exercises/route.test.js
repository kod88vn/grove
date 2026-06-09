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

jest.mock('../../../lib/aiClient', () => ({
  generateExercise: jest.fn(),
}))

const { generateExercise } = jest.requireMock('../../../lib/aiClient')
const { GET } = require('./route')

describe('GET /api/exercises', () => {
  afterEach(() => {
    jest.clearAllMocks()
  })

  afterAll(() => {
    global.Response = originalResponse
  })

  it('returns generated exercise payload on success', async () => {
    generateExercise.mockResolvedValue({ passage: 'P', questions: [] })

    const request = {
      url: 'http://localhost:3000/api/exercises?subject=english&type=reading',
    }

    const response = await GET(request)
    const body = await response.json()

    expect(response.status).toBe(200)
    expect(body.subject).toBe('english')
    expect(body.type).toBe('reading')
    expect(body.exercise).toEqual({ passage: 'P', questions: [] })
  })

  it('forwards skillCategory for section practice generation', async () => {
    generateExercise.mockResolvedValue({ problems: [] })

    const request = {
      url: 'http://localhost:3000/api/exercises?subject=math&type=mixed&skillCategory=division',
    }

    const response = await GET(request)

    expect(response.status).toBe(200)
    expect(generateExercise).toHaveBeenCalledWith('mixed', 'math', {
      skillCategory: 'division',
      selectedDomain: null,
    })
  })

  it('preserves upstream Nora 502 status', async () => {
    generateExercise.mockRejectedValue(
      new Error('Nora API error 502: {"error":"Empty response from LMStudio"}')
    )

    const request = {
      url: 'http://localhost:3000/api/exercises?subject=english&type=reading',
    }

    const response = await GET(request)
    const body = await response.json()

    expect(response.status).toBe(502)
    expect(body.error).toContain('Nora API error 502')
  })
})