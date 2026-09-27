/**
 * @jest-environment node
 */
/**
 * P1.6 follow-up — a rubric that is explicitly `null` must be stored as SQL NULL.
 *
 * HOMEWORK_PLAN.md §6.4 marks `rubric_json` "free-response only", so it is the column that
 * separates a rubric-graded attempt from a deterministically checked one. insertAttempt
 * stringifies it, and `JSON.stringify(null)` is the four-byte *string* 'null', so a caller
 * writing `rubric: body.rubric ?? null` — the obvious shape for the P1.7 POST /attempts
 * route — stores text where the schema meant absence.
 *
 * The round trip hides it: JSON.parse('null') is null, so getAttemptsBySession reports
 * `rubric: null` either way. Only SQL sees the difference, and `rubric_json IS NOT NULL` is
 * how anything downstream will ask "which attempts were graded by rubric?".
 */
import { afterAll, beforeAll, describe, expect, it } from '@jest/globals'

import {
  _getDatabase,
  closeDb,
  getAttemptsBySession,
  initDb,
  insertAttempt,
  insertSession,
} from './db.js'

const attempt = (id, extra) => ({
  id,
  session_id: 'sess-null',
  student_id: 'public',
  subject: 'english',
  grade: 5,
  skill_id: 'e5.l.context-clues',
  problem_id: 'e5.l.context-clues#0',
  content_version: 1,
  seed: 1,
  difficulty: 1,
  shown: {},
  response: {},
  answer: {},
  correct: true,
  tries: 1,
  hints_used: 0,
  revealed: 0,
  stars: 3,
  local_date: '2026-09-27',
  ...extra,
})

describe('attempts.rubric_json is NULL, never the string "null"', () => {
  let conn

  beforeAll(() => {
    initDb(':memory:')
    conn = _getDatabase()
    insertSession({
      id: 'sess-null',
      student_id: 'public',
      kind: 'daily',
      local_date: '2026-09-27',
      tz: 'UTC',
    })
    insertAttempt(attempt('omitted'))
    insertAttempt(attempt('explicit-null', { rubric: null }))
    insertAttempt(attempt('graded', { rubric: { ideas: 3, evidence: 2 } }))
  })

  afterAll(() => {
    closeDb()
  })

  it('stores SQL NULL when the rubric is passed as null', () => {
    const row = conn.prepare(
      `SELECT typeof(rubric_json) AS t FROM attempts WHERE id = 'explicit-null'`,
    ).get()
    expect(row.t).toBe('null')
  })

  it('still stores SQL NULL when the rubric is omitted altogether', () => {
    const row = conn.prepare(
      `SELECT typeof(rubric_json) AS t FROM attempts WHERE id = 'omitted'`,
    ).get()
    expect(row.t).toBe('null')
  })

  it('still stores a real rubric as JSON text', () => {
    const row = conn.prepare(
      `SELECT typeof(rubric_json) AS t, rubric_json FROM attempts WHERE id = 'graded'`,
    ).get()
    expect(row.t).toBe('text')
    expect(JSON.parse(row.rubric_json)).toEqual({ ideas: 3, evidence: 2 })
  })

  it('answers "which attempts were rubric-graded?" with only the graded one', () => {
    const graded = conn
      .prepare(`SELECT id FROM attempts WHERE rubric_json IS NOT NULL ORDER BY id`)
      .all()
      .map(r => r.id)
    expect(graded).toEqual(['graded'])

    const ungraded = conn
      .prepare(`SELECT id FROM attempts WHERE rubric_json IS NULL ORDER BY id`)
      .all()
      .map(r => r.id)
    expect(ungraded).toEqual(['explicit-null', 'omitted'])
  })

  it('keeps the read side unchanged — all three parse back the same way', () => {
    const byId = Object.fromEntries(getAttemptsBySession('sess-null').map(a => [a.id, a]))
    expect(byId.omitted.rubric).toBeNull()
    expect(byId['explicit-null'].rubric).toBeNull()
    expect(byId.graded.rubric).toEqual({ ideas: 3, evidence: 2 })
  })
})
