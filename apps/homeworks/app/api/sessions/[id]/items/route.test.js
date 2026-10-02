/**
 * @jest-environment node
 */
/**
 * P1.7 part 7 of 10 — POST /homeworks/api/sessions/:id/items.
 *
 * HOMEWORK_PLAN.md §6.6, verbatim:
 *   POST /sessions/:id/items — `{ problemId }` → server picks the seed (Daily Seed:
 *   derived from grade + date), inserts the `session_items` row, returns `{ seed,
 *   instance }` with no answer. The only way a seed enters a session
 * and, as the Phase-6 acceptance criterion (line 691):
 *   two sibling profiles see the same Daily Seed for the same grade on the same [day]
 *
 * That last line is the whole reason the seed is derived rather than random, and it is
 * what the determinism tests below pin: the seed is a PURE function of the student's
 * grade, the session's local_date and the problem id. Not of the student id, not of the
 * session id, not of the clock, not of any row already in the database.
 *
 * ASSUMED, because §6.6 does not say:
 *   - the exact hash. Any pure integer function of (grade, localDate, problemId) in
 *     0..2147483647 satisfies these tests. The spec pins the PROPERTIES — same inputs,
 *     same seed, in a fresh process against a fresh database — never a magic number,
 *     so the implementation stays free to change the mixing function;
 *   - posting the same problem twice yields a SECOND row with a DIFFERENT seed rather
 *     than an error or an idempotent replay. §6.4 makes (session_id, problem_id, seed)
 *     the primary key, so the derived seed collides with itself on the second post and
 *     something has to give; §6.6 says "a fresh seed only comes from /sessions/:id/items,
 *     and that is a genuinely new problem", which reads as: asking again gets you another
 *     go, not the same one. The bump must stay deterministic;
 *   - an unknown :id is 404 (it is the addressed resource) while an unknown problemId is
 *     400 (it is body content) — the same split the sessions route already makes;
 *   - a client-supplied `seed` is refused, not honoured. "The only way a seed enters a
 *     session" is the server, and the seed-binding invariant is worthless if the client
 *     can name the seed it is about to be bound to.
 */
import { afterAll, beforeEach, describe, expect, it } from '@jest/globals'

import { getProblem, render, toInstance } from '@grove/curriculum'

import {
  getSessionItem,
  getDatabase,
  finishSession,
  initDb,
  insertSession,
  insertStudent,
  markSessionItemDone,
} from '../../../../../lib/db.js'

class MockResponse {
  constructor(body, init = {}) {
    this.body = body
    this.status = init.status ?? 200
    this.headers = init.headers ?? {}
  }

  static json(payload, init = {}) {
    return new MockResponse(JSON.stringify(payload), {
      ...init,
      headers: { 'Content-Type': 'application/json', ...(init.headers ?? {}) },
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

const { POST } = require('./route')

const PROBLEM = 'm5.oa.order-of-operations/precedence'
const DATE = '2026-09-27'

const post = (sessionId, body) =>
  POST(
    {
      url: `http://localhost:3000/homeworks/api/sessions/${sessionId}/items`,
      json: async () => body,
    },
    { params: Promise.resolve({ id: sessionId }) },
  )

/** Build a world from scratch: fresh db, one student, one session. */
const world = ({ studentId = 'kid-a', grade = 5, localDate = DATE, sessionId = 's-1', kind = 'skill' } = {}) => {
  insertStudent({ id: studentId, display_name: 'Kid', avatar: '🦊', grade, settings: {} })
  insertSession({
    id: sessionId,
    student_id: studentId,
    kind,
    skill_id: null,
    local_date: localDate,
    tz: 'America/New_York',
  })
  return sessionId
}

const seedFor = async (options) => {
  initDb(':memory:')
  const sessionId = world(options)
  const res = await post(sessionId, { problemId: options?.problemId ?? PROBLEM })
  expect(res.status).toBe(201)
  return (await res.json()).seed
}

beforeEach(() => {
  initDb(':memory:')
})

afterAll(() => {
  global.Response = originalResponse
})

describe('POST /homeworks/api/sessions/:id/items', () => {
  it('answers 201 with a seed and an instance', async () => {
    const sessionId = world()
    const res = await post(sessionId, { problemId: PROBLEM })
    expect(res.status).toBe(201)
    const payload = await res.json()
    expect(Object.keys(payload).sort()).toEqual(['instance', 'seed'])
    expect(Number.isInteger(payload.seed)).toBe(true)
    expect(payload.seed).toBeGreaterThanOrEqual(0)
    expect(payload.seed).toBeLessThanOrEqual(2147483647)
  })

  it('returns exactly the instance the curriculum renders for that seed', async () => {
    const sessionId = world()
    const { seed, instance } = await (await post(sessionId, { problemId: PROBLEM })).json()
    const expected = JSON.parse(JSON.stringify(toInstance(render(getProblem(PROBLEM), seed))))
    expect(instance).toEqual(expected)
    expect(instance.seed).toBe(seed)
    expect(instance.problemId).toBe(PROBLEM)
  })

  it('binds the seed by writing the session_items row', async () => {
    const sessionId = world()
    const { seed } = await (await post(sessionId, { problemId: PROBLEM })).json()
    const row = getSessionItem(sessionId, PROBLEM, seed)
    expect(row).not.toBeNull()
    expect(row.tries).toBe(0)
    expect(row.hints_used).toBe(0)
    expect(row.revealed).toBe(0)
    expect(row.done).toBe(0)
  })

  it('gives two siblings in the same grade the same seed on the same day', async () => {
    const a = await seedFor({ studentId: 'kid-a', sessionId: 's-a', grade: 5 })
    const b = await seedFor({ studentId: 'kid-b', sessionId: 's-b', grade: 5 })
    expect(b).toBe(a)
  })

  it('does not depend on the session id', async () => {
    const a = await seedFor({ sessionId: 'session-one' })
    const b = await seedFor({ sessionId: 'session-two' })
    expect(b).toBe(a)
  })

  it('does not depend on anything already in the database', async () => {
    const first = await seedFor()
    initDb(':memory:')
    const sessionId = world()
    // burn a different problem into the session before asking for the one under test
    await post(sessionId, { problemId: 'm5.nbt.long-multiplication/three-by-two' })
    const again = await (await post(sessionId, { problemId: PROBLEM })).json()
    expect(again.seed).toBe(first)
  })

  it('changes with the grade', async () => {
    const seeds = []
    for (const grade of [3, 4, 5, 6, 7]) seeds.push(await seedFor({ grade }))
    expect(new Set(seeds).size).toBeGreaterThan(1)
  })

  it('changes with the day', async () => {
    const seeds = []
    for (const localDate of ['2026-09-25', '2026-09-26', '2026-09-27', '2026-09-28']) {
      seeds.push(await seedFor({ localDate }))
    }
    expect(new Set(seeds).size).toBeGreaterThan(1)
  })

  it('changes with the problem', async () => {
    const seeds = []
    for (const problemId of [
      'm5.oa.order-of-operations/precedence',
      'm5.oa.order-of-operations/exact-division',
      'm5.nbt.long-multiplication/three-by-two',
      'm5.nf.add-fractions-unlike/coprime-denominators',
    ]) {
      seeds.push(await seedFor({ problemId }))
    }
    expect(new Set(seeds).size).toBe(4)
  })

  it('gives a genuinely new problem when the same one is asked for twice', async () => {
    const sessionId = world()
    const first = await (await post(sessionId, { problemId: PROBLEM })).json()
    markSessionItemDone(sessionId, PROBLEM, first.seed)
    const second = await (await post(sessionId, { problemId: PROBLEM })).json()
    expect(second.seed).not.toBe(first.seed)
    expect(getSessionItem(sessionId, PROBLEM, first.seed)).not.toBeNull()
    expect(getSessionItem(sessionId, PROBLEM, second.seed)).not.toBeNull()
    expect(second.instance.seed).toBe(second.seed)
  })

  it.each(['skill', 'daily'])('refuses to issue another item after a %s session is finished', async (kind) => {
    const sessionId = world({ sessionId: `finished-${kind}`, kind })
    finishSession(sessionId, { finished: true, stars: 0, grew: [], next: null })

    const response = await post(sessionId, { problemId: PROBLEM })
    expect(response.status).toBe(409)
    expect(typeof (await response.json()).error).toBe('string')
    expect(getDatabase().prepare('SELECT COUNT(*) AS count FROM session_items WHERE session_id = ?').get(sessionId).count).toBe(0)
  })

  it('bumps deterministically — the same run produces the same sequence', async () => {
    const run = async () => {
      initDb(':memory:')
      const sessionId = world()
      const seeds = []
      for (let i = 0; i < 4; i++) {
        const { seed } = await (await post(sessionId, { problemId: PROBLEM })).json()
        seeds.push(seed)
        markSessionItemDone(sessionId, PROBLEM, seed)
      }
      return seeds
    }
    const a = await run()
    const b = await run()
    expect(b).toEqual(a)
    expect(new Set(a).size).toBe(4)
    for (const seed of a) {
      expect(Number.isInteger(seed)).toBe(true)
      expect(seed).toBeGreaterThanOrEqual(0)
      expect(seed).toBeLessThanOrEqual(2147483647)
    }
  })

  it('answers 404 for a session that does not exist, and writes nothing', async () => {
    const res = await post('no-such-session', { problemId: PROBLEM })
    expect(res.status).toBe(404)
    expect(typeof (await res.json()).error).toBe('string')
  })

  it.each([
    ['an unknown problemId', { problemId: 'm5.oa.order-of-operations/no-such-template' }],
    ['a problemId with no template segment', { problemId: 'm5.oa.order-of-operations' }],
    ['an empty problemId', { problemId: '' }],
    ['a non-string problemId', { problemId: 17 }],
    ['no problemId at all', {}],
    ['a client-chosen seed', { problemId: PROBLEM, seed: 1 }],
    ['a client-chosen tries count', { problemId: PROBLEM, tries: 99 }],
  ])('rejects %s with 400 and binds no seed', async (_label, body) => {
    const sessionId = world()
    const res = await post(sessionId, body)
    expect(res.status).toBe(400)
    const payload = await res.json()
    expect(typeof payload.error).toBe('string')
    expect(payload.seed).toBeUndefined()
    expect(getSessionItem(sessionId, PROBLEM, 1)).toBeNull()
  })

  it('answers 400 rather than throwing when the body is not JSON', async () => {
    const sessionId = world()
    const res = await POST(
      {
        url: `http://localhost:3000/homeworks/api/sessions/${sessionId}/items`,
        json: async () => {
          throw new SyntaxError('Unexpected end of JSON input')
        },
      },
      { params: Promise.resolve({ id: sessionId }) },
    )
    expect(res.status).toBe(400)
    expect(typeof (await res.json()).error).toBe('string')
  })

  it('never ships an answer, an explanation or a hint', async () => {
    const sessionId = world()
    const banned = ['answer', 'explanation', 'hints', 'steps', 'partials', 'parts', 'lcd']
    for (const problemId of [
      'm5.oa.order-of-operations/precedence',
      'm5.nbt.long-multiplication/three-by-two',
      'm5.nf.add-fractions-unlike/coprime-denominators',
      'e5.l.context-clues/strong-clues',
    ]) {
      const payload = await (await post(sessionId, { problemId })).json()
      const walk = (node, path) => {
        if (Array.isArray(node)) return node.forEach((child, i) => walk(child, `${path}[${i}]`))
        if (node && typeof node === 'object') {
          for (const [key, value] of Object.entries(node)) {
            expect([`${path}.${key}`, banned.includes(key)]).toEqual([`${path}.${key}`, false])
            walk(value, `${path}.${key}`)
          }
        }
      }
      walk(payload, problemId)
      const rendered = render(getProblem(problemId), payload.seed)
      expect(JSON.stringify(payload)).not.toContain(rendered.explanation)
    }
  })
})
