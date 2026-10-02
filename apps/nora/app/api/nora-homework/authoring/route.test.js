import { afterAll, afterEach, describe, expect, jest, test } from '@jest/globals'

class TestResponse {
  constructor(body, init = {}) {
    this.body = body
    this.status = init.status ?? 200
  }

  static json(payload, init = {}) { return new TestResponse(JSON.stringify(payload), init) }
  async json() { return JSON.parse(this.body) }
}

const originalResponse = global.Response
if (!global.Response) global.Response = TestResponse
jest.mock('@/app/api/chat/lib/callAI', () => ({ callAI: jest.fn() }))

const { callAI } = jest.requireMock('@/app/api/chat/lib/callAI')
const { POST } = require('./route')

afterEach(() => jest.clearAllMocks())
afterAll(() => { global.Response = originalResponse })

function request(body) { return { json: async () => body } }

describe('Nora offline English authoring route', () => {
  test('requires a grade-matching English skill id', async () => {
    const response = await POST(request({ skillId: 'e5.l.context-clues', grade: 4 }))
    expect(response.status).toBe(400)
    expect(callAI).not.toHaveBeenCalled()
  })

  test('returns a draft but does not mark it approved', async () => {
    callAI.mockResolvedValue({ ok: true, headers: { get: () => null }, json: async () => ({ message: { content: { id: 'river-clue', sentence: 'A clear clue.', answer: 'clear', source: 'original' } } }) })
    const response = await POST(request({ skillId: 'e5.l.context-clues', grade: 5 }))
    const body = await response.json()
    expect(response.status).toBe(200)
    expect(body.candidate.reviewedBy).toBeUndefined()
    expect(callAI.mock.calls[0][0].messages[0].content).toMatch(/e5\.l\.context-clues, grade 5/)
  })

  test('offline model fallback is an explicit service failure', async () => {
    callAI.mockResolvedValue({ ok: true, headers: { get: () => 'true' }, json: async () => ({ offline: true }) })
    const response = await POST(request({ skillId: 'e5.l.context-clues', grade: 5 }))
    expect(response.status).toBe(503)
    expect((await response.json()).error).toMatch(/offline/i)
  })
})