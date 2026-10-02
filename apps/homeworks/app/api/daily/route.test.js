/** @jest-environment node */
import { afterAll, describe, expect, it } from '@jest/globals'
import { listProblems, getProblem, render } from '@grove/curriculum'

const originalResponse = global.Response
const { GET } = require('./route')
const get = (query) => GET({ url: `http://localhost:3005/homeworks/api/daily?${query}` })

afterAll(() => { global.Response = originalResponse })

describe('GET /homeworks/api/daily', () => {
  it('returns a repeatable registered grade problem without its private answer', async () => {
    const first = await get('grade=5&date=2026-09-30')
    const second = await get('grade=5&date=2026-09-30')
    const payload = await first.json()
    expect(first.status).toBe(200)
    expect(payload).toEqual(await second.json())
    expect(listProblems({ grade: 5 }).some((problem) => problem.id === payload.problemId)).toBe(true)
    expect(payload.instance).toMatchObject({ problemId: payload.problemId, prompt: expect.any(String) })
    expect(payload.instance).not.toHaveProperty('answer')
    expect(payload.instance).not.toHaveProperty('explanation')
    expect(payload.seed).toBe(render(getProblem(payload.problemId), payload.seed).seed)
  })

  it('rejects client-selected seeds, malformed dates, and unsupported grades', async () => {
    for (const query of ['grade=5&date=2026-09-30&seed=1', 'grade=5&date=2026-02-30', 'grade=0&date=2026-09-30']) {
      const response = await get(query)
      expect(response.status).toBe(400)
      expect(typeof (await response.json()).error).toBe('string')
    }
  })
})