/** @jest-environment node */
import { beforeAll, beforeEach, describe, expect, it } from '@jest/globals'

import { getStudentById, initDb, insertAttempt, insertSession, insertStudent } from '../../../lib/db.js'
import { refreshSkillState } from '../../../lib/mastery.js'
import { GET } from './route'

const BASE = 'http://localhost:3005/homeworks/api/next'
const get = (studentId, date = '2026-10-25', grade) =>
  GET({ url: `${BASE}?studentId=${studentId}&date=${date}${grade ? `&grade=${grade}` : ''}` })

// A stored practice row for a calendar day.
function practice(studentId, skillId, problemId, localDate, { revealed = false, tries = 1 } = {}) {
  insertAttempt({
    id: `attempt-${studentId}-${problemId}-${localDate}-${Math.random().toString(36).slice(2)}`,
    session_id: null, student_id: studentId, subject: 'math', grade: 5,
    skill_id: skillId, problem_id: problemId, content_version: 1, seed: 1,
    difficulty: 1, shown: { prompt: 'sample' }, response: { value: 1 }, answer: { value: 1 },
    correct: true, tries, hints_used: 0, revealed: revealed ? 1 : 0, stars: tries === 1 && !revealed ? 3 : 1,
    rubric: null, duration_ms: 1, local_date: localDate,
  })
  refreshSkillState(studentId, skillId)
}

beforeEach(() => {
  initDb(':memory:')
  insertStudent({ id: 'kid-a', display_name: 'Mina', avatar: '🦊', grade: 5, settings: {} })
})

beforeAll(() => {
  global.Response ??= Response
})

describe('GET /homeworks/api/next', () => {
  it('validates the request before touching the database', async () => {
    expect((await GET({ url: `${BASE}?date=2026-10-25` })).status).toBe(400)
    expect((await get('kid-a', '2026-10-5')).status).toBe(400)
    expect((await get('missing', '2026-10-25')).status).toBe(404)
    expect((await get('kid-a', '2026-10-25', '13')).status).toBe(400)
  })

  it('offers the lowest-stage ready skill to a beginner', async () => {
    practice('kid-a', 'm5.oa.order-of-operations', 'm5.oa.order-of-operations/precedence', '2026-10-20')
    const payload = await (await get('kid-a')).json()
    expect(payload.next.kind).toBe('skill')
    expect(payload.next.reason).toBe('ready-skill')
    expect(payload.reviews).toEqual([])
    expect(payload.paths).toHaveLength(3)
    expect(payload.skillStates).toHaveLength(1)
    expect(payload.skillStates[0]).toEqual({
      skillId: 'm5.oa.order-of-operations',
      stage: 'sprout',
      level: 1,
      box: 0,
      dueDate: null,
      attempts: 1,
      correct: 1,
    })
  })

  it('serves the due review first and reports the full spaced queue', async () => {
    // Six clean days of correct answers take the ladder to level 3, and the
    // window (10 practice rows, 2 days, 100% at level 3) makes a tree.
    for (let index = 0; index < 5; index += 1) {
      practice('kid-a', 'm5.oa.order-of-operations', 'm5.oa.order-of-operations/precedence', '2026-10-19')
    }
    for (let index = 0; index < 5; index += 1) {
      practice('kid-a', 'm5.oa.order-of-operations', `m5.oa.order-of-operations/variant-${index}`, '2026-10-20')
    }
    insertSession({ id: 'review-1', student_id: 'kid-a', kind: 'review', skill_id: 'm5.oa.order-of-operations', local_date: '2026-10-21', tz: 'America/New_York' })
    insertAttempt({
      id: 'review-attempt', session_id: 'review-1', student_id: 'kid-a', subject: 'math', grade: 5,
      skill_id: 'm5.oa.order-of-operations', problem_id: 'm5.oa.order-of-operations/precedence',
      content_version: 1, seed: 1, difficulty: 1, shown: { prompt: 'sample' }, response: { value: 1 },
      answer: { value: 1 }, correct: true, tries: 1, hints_used: 0, revealed: 0, stars: 3,
      rubric: null, duration_ms: 1, local_date: '2026-10-21',
    })
    refreshSkillState('kid-a', 'm5.oa.order-of-operations')
    const payload = await (await get('kid-a')).json()
    expect(payload.next).toMatchObject({ kind: 'review', skillId: 'm5.oa.order-of-operations', reason: 'review-due', box: 2 })
    expect(payload.next.problemId).toBe(payload.reviews[0].problemId)
    expect(payload.reviews[0].dueDate).toBe('2026-10-24')
    expect(payload.skillStates[0].stage).toBe('fruiting')
    expect(payload.skillStates[0].box).toBe(2)
  })

  it('offers a ready starter skill to a fresh profile with nothing stored', async () => {
    const payload = await (await get('kid-a')).json()
    expect(payload.next).toMatchObject({ kind: 'skill', reason: 'ready-skill' })
    expect(payload.reviews).toEqual([])
    expect(payload.skillStates).toEqual([])
    // Paths are annotated for the client (mastery describePath, plan §6.7):
    // stage per chain skill, locked = prerequisite below sapling, boss ready
    // only when every chain skill is a tree.
    expect(payload.paths[0]).toMatchObject({
      id: 'fraction-forest',
      nextSkillId: 'm5.nf.equiv-fractions',
      bossReady: false,
    })
    expect(payload.paths[0].skills).toEqual([
      { skillId: 'm5.nf.equiv-fractions', stage: 'seed', locked: false, lockedBy: [] },
      { skillId: 'm5.nf.add-fractions-unlike', stage: 'seed', locked: true, lockedBy: ['m5.nf.equiv-fractions'] },
    ])
  })
})
