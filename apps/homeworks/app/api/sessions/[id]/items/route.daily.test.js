/** @jest-environment node */
import { afterAll, beforeEach, describe, expect, it } from '@jest/globals'
import { getDatabase, getSessionItem, initDb, insertSession, insertStudent } from '../../../../../lib/db.js'
import { dailySeed } from '../../../../../lib/kidExperience.js'
import { listProblems } from '@grove/curriculum'
import { GET as getDaily } from '../../../daily/route.js'

const originalResponse = global.Response
const { POST } = require('./route')
const problemId = 'm5.oa.order-of-operations/precedence'
const localDate = '2026-09-30'

function createDaily(studentId, sessionId, skillId = 'm5.oa.order-of-operations') {
  insertStudent({ id: studentId, display_name: studentId, avatar: '🌱', grade: 5, settings: {} })
  insertSession({ id: sessionId, student_id: studentId, kind: 'daily', skill_id: skillId, local_date: localDate, tz: 'America/New_York' })
}

async function addItem(sessionId, id = problemId) {
  return POST({ json: async () => ({ problemId: id }) }, { params: Promise.resolve({ id: sessionId }) })
}

async function canonicalDaily() {
  const response = await getDaily({ url: `http://localhost:3005/homeworks/api/daily?grade=5&date=${localDate}` })
  return response.json()
}

beforeEach(() => initDb(':memory:'))
afterAll(() => { global.Response = originalResponse })

describe('POST /sessions/:id/items for the Daily Seed', () => {
  it('binds the exact grade/date seed across sibling sessions and is idempotent for that daily item', async () => {
    const canonical = await canonicalDaily()
    createDaily('kid-a', 'session-a', canonical.instance.skill)
    createDaily('kid-b', 'session-b', canonical.instance.skill)
    const first = await (await addItem('session-a', canonical.problemId)).json()
    const repeated = await (await addItem('session-a', canonical.problemId)).json()
    const sibling = await (await addItem('session-b', canonical.problemId)).json()
    const shared = dailySeed({ grade: 5, localDate })
    expect(first.seed).toBe(shared)
    expect(repeated).toEqual(first)
    expect(sibling.seed).toBe(shared)
    expect(first.instance).not.toHaveProperty('answer')
  })

  it('rejects a quest outside the server-bound Daily Seed skill', async () => {
    createDaily('kid-a', 'session-a')
    const response = await addItem('session-a', 'm5.nbt.long-multiplication/three-by-two')
    expect(response.status).toBe(400)
    expect(typeof (await response.json()).error).toBe('string')
  })

  it('rejects a different registered template on the canonical Daily Seed skill without inserting it', async () => {
    const canonical = await canonicalDaily()
    const alternative = listProblems({ grade: 5 }).find((problem) => problem.skill === canonical.instance.skill && problem.id !== canonical.problemId)
    expect(alternative).toBeDefined()
    createDaily('kid-a', 'session-a', canonical.instance.skill)
    const response = await addItem('session-a', alternative.id)
    expect(response.status).toBe(400)
    expect(await response.json()).toMatchObject({ error: expect.any(String) })
    expect(getSessionItem('session-a', alternative.id, dailySeed({ grade: 5, localDate }))).toBeNull()
  })

  it('rejects an unbound daily session instead of issuing a non-daily seed', async () => {
    const canonical = await canonicalDaily()
    insertStudent({ id: 'kid-a', display_name: 'kid-a', avatar: '🌱', grade: 5, settings: {} })
    insertSession({ id: 'unbound-daily', student_id: 'kid-a', kind: 'daily', skill_id: null, local_date: localDate, tz: 'America/New_York' })
    const response = await addItem('unbound-daily', canonical.problemId)
    expect(response.status).toBe(400)
  })

  it('reuses the same unfinished registered session item when continuing instead of inserting another seed', async () => {
    insertStudent({ id: 'kid-a', display_name: 'kid-a', avatar: '🌱', grade: 5, settings: {} })
    insertSession({ id: 'continue-session', student_id: 'kid-a', kind: 'skill', skill_id: 'm5.oa.order-of-operations', local_date: localDate, tz: 'America/New_York' })
    const first = await (await addItem('continue-session', problemId)).json()
    const continued = await (await addItem('continue-session', problemId)).json()
    expect(continued.seed).toBe(first.seed)
    expect(getSessionItem('continue-session', problemId, first.seed)).not.toBeNull()
    expect(getDatabase().prepare('SELECT COUNT(*) AS count FROM session_items WHERE session_id = ?').get('continue-session').count).toBe(1)
  })
})