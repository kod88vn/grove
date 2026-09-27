/**
 * @jest-environment node
 */
/**
 * P1.7 part 4 of 10 — GET /homeworks/api/problems.
 *
 * HOMEWORK_PLAN.md §6.6: "/problems — GET, filtered by subject/grade/skill/difficulty".
 * The data is already assembled by @grove/curriculum's listProblems(filter) (P1.7 part 1,
 * run 73), so this route is a query-string parser and nothing else: it must not rebuild
 * the list, re-derive subject/grade, or reach into src/problems by path.
 *
 * ASSUMED, because §6.6 says only "filtered by":
 *   - the envelope key is `problems`, matching /students;
 *   - `grade` and `difficulty` arrive as decimal strings and must parse to integers; a
 *     non-integer is a 400, not a silently-ignored filter, because silently ignoring it
 *     returns the WRONG rows and the caller cannot tell (AGENTS.md "No Silent Failures");
 *   - a filter that matches nothing is 200 with an empty array, not a 404 — an empty
 *     result set is a valid answer to a valid question;
 *   - unknown query parameters are a 400. §6.6's later phases add `status` and
 *     `studentId` filters backed by the skill_state table, which is Phase 4 and does not
 *     exist yet; accepting either now would answer "all problems" to a caller asking for
 *     "the ones this kid is struggling with", which is worse than refusing.
 *
 * The payload is metadata only: no generate(), and none of the answer-bearing keys. This
 * route is listed before a problem is ever rendered, so nothing here can leak — but the
 * assertion is kept local rather than deferred to the cross-route leak spec, so that a
 * regression here fails in the file that owns the route.
 */
import { afterAll, describe, expect, it } from '@jest/globals'

import { listProblems } from '@grove/curriculum'

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

const { GET } = require('./route')

const get = (query = '') =>
  GET({ url: `http://localhost:3000/homeworks/api/problems${query}` })

const body = async (query = '') => (await get(query)).json()

const METADATA_KEYS = ['difficulty', 'grade', 'id', 'skill', 'subject', 'title', 'version', 'widget']

function walk(node, visit, path = '$') {
  visit(node, path)
  if (Array.isArray(node)) {
    node.forEach((item, i) => walk(item, visit, `${path}[${i}]`))
  } else if (node && typeof node === 'object') {
    for (const [key, value] of Object.entries(node)) walk(value, visit, `${path}.${key}`)
  }
}

afterAll(() => {
  global.Response = originalResponse
})

describe('GET /homeworks/api/problems', () => {
  it('answers 200 with every problem the package knows, under a `problems` key', async () => {
    const res = await get()
    expect(res.status).toBe(200)
    const { problems } = await res.json()
    expect(problems).toEqual(listProblems())
    expect(problems.length).toBeGreaterThan(0)
  })

  it('carries metadata only — the eight keys, and no generate()', async () => {
    const { problems } = await body()
    for (const problem of problems) {
      expect(Object.keys(problem).sort()).toEqual(METADATA_KEYS)
      expect(problem.generate).toBeUndefined()
    }
  })

  it.each([
    ['subject=math'],
    ['subject=english'],
    ['grade=5'],
    ['difficulty=1'],
    ['difficulty=3'],
  ])('filters on %s exactly as listProblems does', async (query) => {
    const { problems } = await body(`?${query}`)
    const [key, raw] = query.split('=')
    const value = key === 'subject' ? raw : Number(raw)
    expect(problems).toEqual(listProblems({ [key]: value }))
    expect(problems.length).toBeGreaterThan(0)
  })

  it('filters on skill', async () => {
    const skill = listProblems()[0].skill
    const { problems } = await body(`?skill=${encodeURIComponent(skill)}`)
    expect(problems).toEqual(listProblems({ skill }))
    expect(problems.every((p) => p.skill === skill)).toBe(true)
  })

  it('combines filters rather than letting the last one win', async () => {
    const { problems } = await body('?subject=math&difficulty=1')
    expect(problems).toEqual(listProblems({ subject: 'math', difficulty: 1 }))
    expect(problems.every((p) => p.subject === 'math' && p.difficulty === 1)).toBe(true)
  })

  it('answers 200 and an empty array when nothing matches', async () => {
    const res = await get('?subject=astrophysics')
    expect(res.status).toBe(200)
    expect((await res.json()).problems).toEqual([])
  })

  it.each([
    ['grade=five', 'grade'],
    ['grade=5.5', 'grade'],
    ['grade=', 'grade'],
    ['difficulty=hard', 'difficulty'],
    ['difficulty=2.5', 'difficulty'],
  ])('rejects %s with 400 and a reason naming the parameter', async (query, name) => {
    const res = await get(`?${query}`)
    expect(res.status).toBe(400)
    const payload = await res.json()
    expect(typeof payload.error).toBe('string')
    expect(payload.error).toContain(name)
  })

  it.each([
    ['status=struggling'],
    ['studentId=public'],
    ['limit=3'],
  ])('refuses the unsupported parameter %s with 400 rather than ignoring it', async (query) => {
    const res = await get(`?${query}`)
    expect(res.status).toBe(400)
    expect(typeof (await res.json()).error).toBe('string')
  })

  it('never returns an answer, an explanation or a hint at any depth', async () => {
    const banned = ['answer', 'explanation', 'hints', 'steps', 'partials', 'parts', 'lcd']
    const found = []
    walk(await body(), (value, path) => {
      if (!value || typeof value !== 'object' || Array.isArray(value)) return
      for (const key of banned) if (key in value) found.push(`${path}.${key}`)
    })
    expect(found).toEqual([])
  })

  it('is plain JSON — no functions, no undefined', async () => {
    const payload = await body()
    expect(JSON.parse(JSON.stringify(payload))).toEqual(payload)
    const bad = []
    walk(payload, (value, path) => {
      if (typeof value === 'function' || value === undefined) bad.push(path)
    })
    expect(bad).toEqual([])
  })
})
