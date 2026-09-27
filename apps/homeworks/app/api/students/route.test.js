/**
 * @jest-environment node
 */
/**
 * P1.7 part 3 of 10 — GET and POST /homeworks/api/students.
 *
 * HOMEWORK_PLAN.md §6.6 lists `/students` as "GET list, POST create" and nothing more, so
 * everything below beyond those five words is an ASSUMPTION this spec makes concrete:
 *
 *   - the list comes back under a `students` key, not as a bare array, so the payload has
 *     somewhere to grow (§6.6 gives every other route an object);
 *   - create answers 201 with `{ student }` — the created row, so the caller does not have
 *     to re-list to learn the id it was given;
 *   - the server issues the id. §6.4 makes `students.id` a TEXT primary key and seeds
 *     'public'; a client-chosen id is a collision and an enumeration surface, so a client
 *     `id` in the body is rejected rather than honoured or quietly dropped;
 *   - `grade` is an integer 1..12. §6.2 ids are grade-scoped (`m5.`, `e5.`) and the app is
 *     a K-12 homework app, so a grade outside that is a bug, not a preference;
 *   - a rejection is 400 with a non-empty `error` string. AGENTS.md "No Silent Failures":
 *     never suppress, never substitute a default.
 *
 * `settings` is stored as `settings_json` (§6.4) and parsed by lib/db.js's parseStudent,
 * so it must reach the caller as an object — a JSON string here would make every consumer
 * parse it a second time.
 */
import { afterAll, afterEach, beforeEach, describe, expect, it } from '@jest/globals'

import { getStudentById, initDb, listStudents } from '../../../lib/db.js'

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

const { GET, POST } = require('./route')

const post = (body) =>
  POST({
    url: 'http://localhost:3000/homeworks/api/students',
    json: async () => body,
  })

const get = () => GET({ url: 'http://localhost:3000/homeworks/api/students' })

beforeEach(() => {
  initDb(':memory:')
})

afterEach(() => {
  initDb(':memory:')
})

afterAll(() => {
  global.Response = originalResponse
})

describe('GET /homeworks/api/students', () => {
  it('answers 200 with the students under a `students` key', async () => {
    const res = await get()
    expect(res.status).toBe(200)
    const payload = await res.json()
    expect(Array.isArray(payload.students)).toBe(true)
  })

  it('includes the seeded `public` student, whose settings are an object and not a string', async () => {
    const { students } = await (await get()).json()
    const publicStudent = students.find((s) => s.id === 'public')
    expect(publicStudent).toBeDefined()
    expect(publicStudent.display_name).toBe('Explorer')
    expect(publicStudent.grade).toBe(5)
    expect(typeof publicStudent.settings).toBe('object')
    expect(publicStudent.settings).not.toBeNull()
  })

  it('returns every row lib/db.js has, in the same order', async () => {
    await post({ displayName: 'Mina', avatar: '🦊', grade: 4 })
    await post({ displayName: 'Theo', avatar: '🐢', grade: 6 })
    const { students } = await (await get()).json()
    expect(students.map((s) => s.id)).toEqual(listStudents().map((s) => s.id))
  })

  it('is JSON-serialisable — no undefined, no functions', async () => {
    const { students } = await (await get()).json()
    expect(JSON.parse(JSON.stringify(students))).toEqual(students)
  })
})

describe('POST /homeworks/api/students', () => {
  it('answers 201 with the created student', async () => {
    const res = await post({ displayName: 'Mina', avatar: '🦊', grade: 4 })
    expect(res.status).toBe(201)
    const { student } = await res.json()
    expect(student.display_name).toBe('Mina')
    expect(student.avatar).toBe('🦊')
    expect(student.grade).toBe(4)
  })

  it('issues the id itself, as a non-empty string that is not one the client sent', async () => {
    const { student } = await (await post({ displayName: 'Mina', avatar: '🦊', grade: 4 })).json()
    expect(typeof student.id).toBe('string')
    expect(student.id.length).toBeGreaterThan(0)
    expect(student.id).not.toBe('public')
  })

  it('issues a different id for every create', async () => {
    const ids = []
    for (let i = 0; i < 5; i++) {
      const { student } = await (await post({ displayName: `Kid ${i}`, avatar: '🌱', grade: 5 })).json()
      ids.push(student.id)
    }
    expect(new Set(ids).size).toBe(5)
  })

  it('persists the row — it is readable through lib/db.js afterwards', async () => {
    const { student } = await (await post({ displayName: 'Theo', avatar: '🐢', grade: 6 })).json()
    const stored = getStudentById(student.id)
    expect(stored).not.toBeNull()
    expect(stored.display_name).toBe('Theo')
    expect(stored.grade).toBe(6)
  })

  it('gives a new student empty settings, as an object', async () => {
    const { student } = await (await post({ displayName: 'Theo', avatar: '🐢', grade: 6 })).json()
    expect(student.settings).toEqual({})
    expect(getStudentById(student.id).settings).toEqual({})
  })

  it('rejects a client-supplied id with 400 and writes nothing', async () => {
    const before = listStudents().length
    const res = await post({ id: 'chosen-by-me', displayName: 'Mina', avatar: '🦊', grade: 4 })
    expect(res.status).toBe(400)
    expect(getStudentById('chosen-by-me')).toBeNull()
    expect(listStudents()).toHaveLength(before)
  })

  it.each([
    ['no displayName', { avatar: '🦊', grade: 4 }],
    ['blank displayName', { displayName: '   ', avatar: '🦊', grade: 4 }],
    ['non-string displayName', { displayName: 42, avatar: '🦊', grade: 4 }],
    ['no avatar', { displayName: 'Mina', grade: 4 }],
    ['blank avatar', { displayName: 'Mina', avatar: '', grade: 4 }],
    ['no grade', { displayName: 'Mina', avatar: '🦊' }],
    ['grade 0', { displayName: 'Mina', avatar: '🦊', grade: 0 }],
    ['grade 13', { displayName: 'Mina', avatar: '🦊', grade: 13 }],
    ['fractional grade', { displayName: 'Mina', avatar: '🦊', grade: 4.5 }],
    ['grade as a string', { displayName: 'Mina', avatar: '🦊', grade: '4' }],
    ['null body', null],
    ['array body', []],
  ])('rejects %s with 400, a reason, and no new row', async (_label, body) => {
    const before = listStudents().length
    const res = await post(body)
    expect(res.status).toBe(400)
    const payload = await res.json()
    expect(typeof payload.error).toBe('string')
    expect(payload.error.length).toBeGreaterThan(0)
    expect(listStudents()).toHaveLength(before)
  })

  it('answers 400 rather than throwing when the body is not JSON at all', async () => {
    const res = await POST({
      url: 'http://localhost:3000/homeworks/api/students',
      json: async () => {
        throw new SyntaxError('Unexpected end of JSON input')
      },
    })
    expect(res.status).toBe(400)
    expect(typeof (await res.json()).error).toBe('string')
  })

  it('trims the display name rather than storing the padding', async () => {
    const { student } = await (await post({ displayName: '  Mina  ', avatar: '🦊', grade: 4 })).json()
    expect(student.display_name).toBe('Mina')
  })
})
