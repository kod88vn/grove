import { afterAll, afterEach, describe, expect, jest, test } from '@jest/globals'

class TestResponse {
  constructor(body, init = {}) {
    this.body = body
    this.status = init.status ?? 200
  }

  static json(payload, init = {}) {
    return new TestResponse(JSON.stringify(payload), init)
  }

  async json() { return JSON.parse(this.body) }
}

const originalResponse = global.Response
if (!global.Response) global.Response = TestResponse
jest.mock('@/lib/contentReview', () => ({ recordDraftDecision: jest.fn() }))

import { recordDraftDecision } from '@/lib/contentReview'
import { POST } from './route'

const before = process.env.NODE_ENV

afterEach(() => {
  process.env.NODE_ENV = before
  jest.clearAllMocks()
})

afterAll(() => { global.Response = originalResponse })

function request(json) {
  return { json: async () => json }
}

describe('development content approval endpoint', () => {
  test('production refuses decisions before touching draft storage', async () => {
    process.env.NODE_ENV = 'production'
    const response = await POST(request({}))
    expect(response.status).toBe(404)
    expect(recordDraftDecision).not.toHaveBeenCalled()
  })

  test('malformed requests and review failures are surfaced', async () => {
    process.env.NODE_ENV = 'development'
    const invalid = await POST({ json: async () => { throw new Error('bad json') } })
    expect(invalid.status).toBe(400)
    recordDraftDecision.mockRejectedValueOnce(new Error('A named human reviewer is required'))
    const rejected = await POST(request({ filename: 'draft.json', approved: true }))
    expect(rejected.status).toBe(400)
    expect((await rejected.json()).error).toMatch(/named human reviewer/i)
  })
})