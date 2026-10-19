/** @jest-environment node */
import { beforeEach, describe, expect, it } from '@jest/globals'
import { initDb, insertAttempt, insertStudent } from '../../../lib/db.js'

const { POST } = require('./route')
const request = (body) => ({ json: async () => body })

beforeEach(() => {
  initDb(':memory:')
  insertStudent({ id: 'kid-a', display_name: 'Mina', avatar: '🦊', grade: 5, settings: {} })
  insertAttempt({ id: 'stars', session_id: null, student_id: 'kid-a', subject: 'math', grade: 5,
    skill_id: 'm5.oa.order-of-operations', problem_id: 'sample', content_version: 1, seed: 1,
    difficulty: 1, shown: {}, response: {}, answer: {}, correct: true, tries: 1, hints_used: 0,
    revealed: 0, stars: 3, rubric: null, duration_ms: 1, local_date: '2026-09-30' })
})
describe('POST /homeworks/api/decorations', () => {
  it('charges the code-catalog price and prevents client-supplied prices', async () => {
    const bought = await POST(request({ studentId: 'kid-a', decorationId: 'lantern' }))
    expect(bought.status).toBe(201)
    expect(await bought.json()).toEqual({ purchased: { id: 'lantern', name: 'Lantern', price: 3 } })
    expect((await POST(request({ studentId: 'kid-a', decorationId: 'lantern' }))).status).toBe(409)
    expect((await POST(request({ studentId: 'kid-a', decorationId: 'lantern', stars: 1000 }))).status).toBe(400)
  })

  it('returns explicit errors for malformed, unknown, and unaffordable purchases', async () => {
    expect((await POST({ json: async () => { throw new SyntaxError('bad json') } })).status).toBe(400)
    expect((await POST(request({ studentId: 'kid-a', decorationId: 'unknown' }))).status).toBe(404)
    expect((await POST(request({ studentId: 'missing', decorationId: 'lantern' }))).status).toBe(404)
    expect((await POST(request({ studentId: 'kid-a', decorationId: 'pond' }))).status).toBe(409)
  })
})
