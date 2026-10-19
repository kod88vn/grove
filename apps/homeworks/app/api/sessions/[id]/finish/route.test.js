/** @jest-environment node */
import { afterAll, beforeEach, describe, expect, it } from '@jest/globals'
import { getDatabase, getSessionById, initDb, insertAttempt, insertSession, insertSessionItem, markSessionItemDone } from '../../../../../lib/db.js'

const originalResponse = global.Response
const { POST } = require('./route')
const post = (id) => POST({}, { params: Promise.resolve({ id }) })

beforeEach(() => {
  initDb(':memory:')
  insertSession({ id: 'session-1', student_id: 'public', kind: 'daily', local_date: '2026-09-30', tz: 'UTC' })
})
afterAll(() => { global.Response = originalResponse })

describe('POST /sessions/:id/finish', () => {
  it('marks the issued session finished in SQLite', async () => {
    const response = await post('session-1')
    expect(response.status).toBe(200)
    expect(await response.json()).toEqual({ finished: true, stars: 0, grew: [], next: expect.any(Object) })
    expect(getSessionById('session-1').finished_at).toBeGreaterThan(0)
  })

  it('uses stored session attempts for stars and only reports a stage transition caused by this session', async () => {
    const skillId = 'm5.oa.order-of-operations'
    insertSessionItem({ session_id: 'session-1', problem_id: `${skillId}/sample`, seed: 17 })
    markSessionItemDone('session-1', `${skillId}/sample`, 17)
    const addAttempt = ({ id, sessionId = null, skill, stars }) => insertAttempt({
      id, session_id: sessionId, student_id: 'public', subject: 'math', grade: 5, skill_id: skill,
      problem_id: `${skill}/sample`, content_version: 1, seed: 17, difficulty: 1,
      shown: {}, response: {}, answer: {}, correct: true, tries: 1, hints_used: 0,
      revealed: 0, stars, rubric: null, duration_ms: 1, local_date: '2026-09-30',
    })
    addAttempt({ id: 'older-skill', skill: 'm5.nf.add-fractions-unlike', stars: 3 })
    addAttempt({ id: 'session-earned', sessionId: 'session-1', skill: skillId, stars: 2 })

    const first = await (await post('session-1')).json()
    expect(first.stars).toBe(2)
    expect(first.grew).toEqual([{ skillId, name: 'Order of Operations (PEMDAS)', from: 'seed', to: 'sprout' }])
    expect(first.next).toEqual(expect.objectContaining({ id: expect.any(String), problemId: expect.any(String) }))
    expect(await (await post('session-1')).json()).toEqual(first)
  })

  it('replays the first saved result after later same-skill attempts change growth and next', async () => {
    const skillId = 'm5.oa.order-of-operations'
    const addAttempt = (id, sessionId) => insertAttempt({
      id, session_id: sessionId, student_id: 'public', subject: 'math', grade: 5, skill_id: skillId,
      problem_id: `${skillId}/sample`, content_version: 1, seed: 17, difficulty: 1,
      shown: {}, response: {}, answer: {}, correct: true, tries: 1, hints_used: 0,
      revealed: 0, stars: 3, rubric: null, duration_ms: 1, local_date: '2026-09-30',
    })
    addAttempt('first-result', 'session-1')

    const first = await (await post('session-1')).json()
    insertSession({ id: 'later-session', student_id: 'public', kind: 'skill', skill_id: skillId, local_date: '2026-09-30', tz: 'UTC' })
    for (let i = 0; i < 9; i++) addAttempt(`later-result-${i}`, 'later-session')

    expect(await (await post('session-1')).json()).toEqual(first)
    expect(getSessionById('session-1').finish_result_json).toBe(JSON.stringify(first))
  })

  it('reports an unavailable saved result instead of recalculating a legacy finished session', async () => {
    getDatabase().prepare(`UPDATE practice_sessions SET finished_at = 123 WHERE id = ?`).run('session-1')

    const response = await post('session-1')
    expect(response.status).toBe(500)
    expect(await response.json()).toEqual({ error: 'Saved session result is unavailable' })
  })

  it('gives an empty session no stars or growth', async () => {
    const result = await (await post('session-1')).json()
    expect(result.stars).toBe(0)
    expect(result.grew).toEqual([])
  })

  it('rejects an unknown session without writing a row', async () => {
    const response = await post('missing')
    expect(response.status).toBe(404)
    expect(typeof (await response.json()).error).toBe('string')
  })
})