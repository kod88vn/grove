import { afterAll, afterEach, describe, expect, it, jest } from '@jest/globals'

class MockResponse {
  constructor(body, init = {}) {
    this.body = body
    this.status = init.status ?? 200
    this.headers = init.headers ?? {}
  }

  static json(payload, init = {}) {
    return new MockResponse(JSON.stringify(payload), {
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
  global.Response = MockResponse
}

jest.mock('../../../lib/progress.js', () => ({
  getSubmissionsForDay: jest.fn(),
  getReadingsForDay: jest.fn(),
  getAll: jest.fn(),
  getAllReadingsUnbounded: jest.fn(),
}))

const { GET } = require('./route')

describe('GET /api/review', () => {
  afterEach(() => {
    jest.clearAllMocks()
  })

  afterAll(() => {
    global.Response = originalResponse
  })

  it('returns { days: [...] } grouped by date, sorted newest-first when no day param', async () => {
    const { getAll, getAllReadingsUnbounded } = jest.requireMock('../../../lib/progress.js')
    getAll.mockReturnValue([
      { id: 's1', student_id: 'public', subject: 'math', type: 'problem-set', score: 5, max_score: 5, percentage: 100, feedback: 'Great', exercise: {}, answers: [], details: {}, date: '2026-05-24T12:00:00.000Z' },
    ])
    getAllReadingsUnbounded.mockReturnValue([
      { id: 'r1', student_id: 'public', passage: 'Test', questions: [], lesson_key_point: 'LP1', domain: 'science', score: 3, max_score: 5, percentage: 60, answers: {}, date: '2026-05-24T14:00:00.000Z' },
    ])

    const request = { url: 'http://localhost:3000/homeworks/api/review' }
    const response = await GET(request)
    const body = await response.json()

    expect(response.status).toBe(200)
    expect(body.days).toHaveLength(1)
    expect(body.days[0].date).toBe('2026-05-24')
    expect(body.days[0].submissions).toHaveLength(1)
    expect(body.days[0].readings).toHaveLength(1)
  })

  it('returns { submissions, readings } for a specific day when day param is provided', async () => {
    const { getSubmissionsForDay, getReadingsForDay } = jest.requireMock('../../../lib/progress.js')
    getSubmissionsForDay.mockReturnValue([
      { id: 's2', student_id: 'public', subject: 'english', type: 'writing', score: 4, max_score: 5, percentage: 80, feedback: 'Good', exercise: {}, answers: '', details: {}, date: '2026-05-24T10:00:00.000Z' },
    ])
    getReadingsForDay.mockReturnValue([])

    const request = { url: 'http://localhost:3000/homeworks/api/review?day=2026-05-24' }
    const response = await GET(request)
    const body = await response.json()

    expect(response.status).toBe(200)
    expect(body.submissions).toHaveLength(1)
    expect(body.readings).toHaveLength(0)
  })

  it('returns { error: "..." } with status 502 when getAll throws', async () => {
    const { getAll } = jest.requireMock('../../../lib/progress.js')
    getAll.mockImplementation(() => { throw new Error('DB connection failed') })

    const request = { url: 'http://localhost:3000/homeworks/api/review' }
    const response = await GET(request)
    const body = await response.json()

    expect(response.status).toBe(502)
    expect(body.error).toBe('DB connection failed')
  })
})

