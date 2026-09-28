/**
 * @jest-environment node
 */
/**
 * P1.7 part 6 of 10 — POST /homeworks/api/sessions.
 *
 * HOMEWORK_PLAN.md §6.6, verbatim:
 *   POST /sessions — `{ studentId, kind, skillId?, localDate, tz }` → `{ sessionId }`;
 *   `studentId` must exist in `students`
 * So the request shape, the response shape and the existence check are GROUNDED, not
 * assumed. §6.4 adds the storage constraint: kind is
 * CHECK (kind IN ('daily','skill','review','path','free')), skill_id is nullable,
 * local_date and tz are NOT NULL, started_at defaults to unixepoch() and finished_at
 * starts null.
 *
 * ASSUMED:
 *   - an unknown studentId is 400, not 404. The id arrives in the body, not the URL, so
 *     the request itself is malformed; the resource being addressed is the collection,
 *     and it exists;
 *   - the session id is issued by the server, and a client-supplied `id` is refused
 *     rather than honoured — same reasoning as /students;
 *   - localDate is `YYYY-MM-DD` with a plausible month and day. §6.4 stores it as TEXT
 *     with no constraint, and every day-scoped query in lib/progress.js compares those
 *     strings, so one badly-shaped row is invisible for the rest of its life;
 *   - tz is validated with lib/localDay.js's isValidTimeZone, which this app already uses
 *     as its notion of a real zone. A bad zone stored now becomes a crash in whichever
 *     later query calls dayBoundsInZone on it;
 *   - skillId, when present, must be a non-empty string; it is NOT checked against the
 *     catalog. §6.6 requires existence only for studentId, and a session is a container,
 *     not a claim about curriculum.
 *
 * The plan does not say the route validates before it writes. AGENTS.md does: "No Silent
 * Failures". Every rejection below is asserted to leave the table exactly as it was.
 */
import { afterAll, beforeEach, describe, expect, it } from '@jest/globals'

import { getSessionById, getStudentById, initDb, insertStudent } from '../../../lib/db.js'

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

const VALID = {
  studentId: 'public',
  kind: 'daily',
  localDate: '2026-09-27',
  tz: 'America/New_York',
}

const post = (body) =>
  POST({ url: 'http://localhost:3000/homeworks/api/sessions', json: async () => body })

const create = async (overrides = {}) => {
  const res = await post({ ...VALID, ...overrides })
  return { res, payload: await res.json() }
}

beforeEach(() => {
  initDb(':memory:')
})

afterAll(() => {
  global.Response = originalResponse
})

describe('POST /homeworks/api/sessions', () => {
  it('answers 201 with a sessionId string', async () => {
    const { res, payload } = await create()
    expect(res.status).toBe(201)
    expect(typeof payload.sessionId).toBe('string')
    expect(payload.sessionId.length).toBeGreaterThan(0)
  })

  it('persists the row exactly as sent', async () => {
    const { payload } = await create()
    const session = getSessionById(payload.sessionId)
    expect(session).not.toBeNull()
    expect(session.student_id).toBe('public')
    expect(session.kind).toBe('daily')
    expect(session.local_date).toBe('2026-09-27')
    expect(session.tz).toBe('America/New_York')
  })

  it('starts the session open — started_at set, finished_at null', async () => {
    const { payload } = await create()
    const session = getSessionById(payload.sessionId)
    expect(Number.isInteger(session.started_at)).toBe(true)
    expect(session.started_at).toBeGreaterThan(0)
    expect(session.finished_at).toBeNull()
  })

  it.each([['daily'], ['skill'], ['review'], ['path'], ['free']])(
    'accepts the kind %s that the schema allows',
    async (kind) => {
      const { res, payload } = await create({ kind, skillId: 'm5.oa.order-of-operations' })
      expect([kind, res.status]).toEqual([kind, 201])
      expect(getSessionById(payload.sessionId).kind).toBe(kind)
    },
  )

  it('stores skillId when given and null when not', async () => {
    const withSkill = await create({ kind: 'skill', skillId: 'm5.nbt.long-multiplication' })
    expect(getSessionById(withSkill.payload.sessionId).skill_id).toBe('m5.nbt.long-multiplication')
    const without = await create()
    expect(getSessionById(without.payload.sessionId).skill_id).toBeNull()
  })

  it('issues a distinct id for every session', async () => {
    const ids = []
    for (let i = 0; i < 5; i++) ids.push((await create()).payload.sessionId)
    expect(new Set(ids).size).toBe(5)
  })

  it('works for a student created through the API, not only the seeded one', async () => {
    insertStudent({ id: 'kid-1', display_name: 'Mina', avatar: '🦊', grade: 4, settings: {} })
    expect(getStudentById('kid-1')).not.toBeNull()
    const { res, payload } = await create({ studentId: 'kid-1' })
    expect(res.status).toBe(201)
    expect(getSessionById(payload.sessionId).student_id).toBe('kid-1')
  })

  it('rejects an unknown studentId with 400 and writes nothing', async () => {
    const { res, payload } = await create({ studentId: 'no-such-kid' })
    expect(res.status).toBe(400)
    expect(typeof payload.error).toBe('string')
    expect(payload.sessionId).toBeUndefined()
  })

  it('rejects a client-supplied id with 400', async () => {
    const { res } = await create({ id: 'chosen-by-me' })
    expect(res.status).toBe(400)
    expect(getSessionById('chosen-by-me')).toBeNull()
  })

  it.each([
    ['no studentId', { studentId: undefined }],
    ['empty studentId', { studentId: '' }],
    ['non-string studentId', { studentId: 7 }],
    ['no kind', { kind: undefined }],
    ['unknown kind', { kind: 'cram' }],
    ['kind with different case', { kind: 'Daily' }],
    ['no localDate', { localDate: undefined }],
    ['localDate as a slash date', { localDate: '2026/09/27' }],
    ['localDate without padding', { localDate: '2026-9-7' }],
    ['localDate with a 13th month', { localDate: '2026-13-01' }],
    ['localDate with a zero month', { localDate: '2026-00-10' }],
    ['localDate with a zero day', { localDate: '2026-01-00' }],
    ['localDate with a 32nd day', { localDate: '2026-01-32' }],
    ['localDate as a timestamp', { localDate: 1758931200 }],
    ['no tz', { tz: undefined }],
    ['empty tz', { tz: '' }],
    ['a zone that does not exist', { tz: 'Mars/Phobos' }],
    ['a UTC offset instead of a zone', { tz: '+05:00' }],
    ['non-string skillId', { skillId: 42 }],
    ['empty skillId', { skillId: '' }],
  ])('rejects %s with 400, a reason, and no row', async (_label, overrides) => {
    const body = { ...VALID, ...overrides }
    for (const [key, value] of Object.entries(overrides)) if (value === undefined) delete body[key]
    const res = await post(body)
    expect(res.status).toBe(400)
    const payload = await res.json()
    expect(typeof payload.error).toBe('string')
    expect(payload.error.length).toBeGreaterThan(0)
    expect(payload.sessionId).toBeUndefined()
  })

  it.each([
    ['null body', null],
    ['array body', []],
    ['string body', 'daily'],
  ])('rejects a %s with 400', async (_label, body) => {
    const res = await post(body)
    expect(res.status).toBe(400)
    expect(typeof (await res.json()).error).toBe('string')
  })

  it('answers 400 rather than throwing when the body is not JSON at all', async () => {
    const res = await POST({
      url: 'http://localhost:3000/homeworks/api/sessions',
      json: async () => {
        throw new SyntaxError('Unexpected end of JSON input')
      },
    })
    expect(res.status).toBe(400)
    expect(typeof (await res.json()).error).toBe('string')
  })

  it('accepts UTC and other real zones', async () => {
    for (const tz of ['UTC', 'Europe/London', 'Asia/Tokyo', 'America/Los_Angeles']) {
      const { res } = await create({ tz })
      expect([tz, res.status]).toEqual([tz, 201])
    }
  })
})
