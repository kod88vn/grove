/** @jest-environment node */
import { afterAll, beforeEach, describe, expect, it } from '@jest/globals'
import { finishSession, initDb, insertAttempt, insertSession, insertSessionItem, insertStudent } from '../../../lib/db.js'

const originalResponse = global.Response
const { GET } = require('./route')
const get = (studentId, date = '2026-09-27') => GET({ url: `http://localhost:3005/homeworks/api/kid-experience?studentId=${studentId}&date=${date}` })

function attempt(studentId, stars, skillId = 'm5.oa.order-of-operations') {
  insertAttempt({
    id: `attempt-${studentId}-${stars}`, session_id: null, student_id: studentId, subject: 'math', grade: 5,
    skill_id: skillId, problem_id: 'm5.oa.order-of-operations/precedence', content_version: 1, seed: 13,
    difficulty: 1, shown: { prompt: 'sample' }, response: { value: 2 }, answer: { value: 2 }, correct: true,
    tries: 1, hints_used: 0, revealed: 0, stars, rubric: null, duration_ms: 1, local_date: '2026-09-27',
  })
}

beforeEach(() => {
  initDb(':memory:')
  insertStudent({ id: 'kid-a', display_name: 'Mina', avatar: '🦊', grade: 5, settings: {} })
  insertStudent({ id: 'kid-b', display_name: 'Theo', avatar: '🐻', grade: 5, settings: {} })
})
afterAll(() => { global.Response = originalResponse })

describe('GET /homeworks/api/kid-experience', () => {
  it("derives only the selected child's rewards, badge, and tried skill from stored attempts", async () => {
    attempt('kid-a', 3)
    attempt('kid-b', 2, 'm5.nf.add-fractions-unlike')
    const response = await get('kid-a')
    const payload = await response.json()
    expect(response.status).toBe(200)
    expect(payload.student.displayName).toBe('Mina')
    expect(payload.rewards).toEqual({ stars: 3, sunshine: 3 })
    expect(payload.badges.map(({ id }) => id)).toContain('first-solve')
    expect(payload.garden.find(({ skillId }) => skillId === 'm5.oa.order-of-operations').stage).toBe('sprout')
    expect(payload.garden.find(({ skillId }) => skillId === 'm5.nf.add-fractions-unlike').stage).toBe('seed')
  })

  it("rejects unknown profiles and malformed dates instead of returning another child's data", async () => {
    expect((await get('missing')).status).toBe(404)
    expect((await get('kid-a', '2026-9-7')).status).toBe(400)
  })

  it('offers Continue only for a real unfinished item owned by the selected child', async () => {
    insertSession({ id: 'open-session', student_id: 'kid-a', kind: 'skill', skill_id: 'm5.oa.order-of-operations', local_date: '2026-09-27', tz: 'America/New_York' })
    insertSessionItem({ session_id: 'open-session', problem_id: 'm5.oa.order-of-operations/precedence', seed: 81 })
    expect((await (await get('kid-a')).json()).continueSession).toEqual({
      sessionId: 'open-session', skillId: 'm5.oa.order-of-operations', problemId: 'm5.oa.order-of-operations/precedence',
    })
    expect((await (await get('kid-b')).json()).continueSession).toBeNull()
    finishSession('open-session')
    expect((await (await get('kid-a')).json()).continueSession).toBeNull()
  })
})