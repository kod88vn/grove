/**
 * @jest-environment node
 */
/**
 * P1.7 part 8 of 10 — POST /homeworks/api/hints.
 *
 * HOMEWORK_PLAN.md §6.6, verbatim:
 *   POST /hints — `{ sessionId, problemId, seed }` → the next unused hint; increments
 *   `session_items.hints_used` on the server. POST, not GET, because it has a side effect
 * and the seed-binding invariant beneath the table:
 *   `/hints` and `/attempts` reject (409) any `(sessionId, problemId, seed)` that has no
 *   `session_items` row ... So a client cannot reset tries or hints by sending a new seed
 *
 * The counter is the whole point. §6.6: "the counters exist so a kid cannot fake stars by
 * replaying requests". A hint taken is a hint that must still be taken after a reload, a
 * new tab, or a forged request — so every assertion below reads `hints_used` back out of
 * the database rather than trusting the response.
 *
 * GROUNDED by probe against packages/curriculum in this worktree: every Grade 5 template
 * renders exactly 2 hints, they are plain strings, and `hint(rendered, used)` returns
 * `hints[used]` or null once they run out. So the third request for the same item has
 * nothing left to give.
 *
 * ASSUMED, because §6.6 does not say:
 *   - the response body is `{ hint, hintsUsed }`, with hintsUsed the count AFTER this
 *     hint was taken — the client needs it to render "hint 2 of 2" without a second call;
 *   - running out is 409, not 200-with-null. It is the same class of refusal as an unbound
 *     seed: the request is well formed, the state will not have it. A null hint would be a
 *     silent failure, which AGENTS.md forbids;
 *   - a refused request increments NOTHING. A 409 that still charges the kid a hint is
 *     worse than either outcome on its own;
 *   - shape is checked before binding, so a malformed body is 400 and a well-formed body
 *     naming a problem that is not bound is 409 — including a problemId that does not
 *     exist at all. /hints never reveals which problems exist; it only answers about the
 *     row in front of it.
 */
import { afterAll, beforeEach, describe, expect, it } from '@jest/globals'

import { getProblem, render } from '@grove/curriculum'

import {
  getSessionItem,
  initDb,
  insertSession,
  insertSessionItem,
  insertStudent,
} from '../../../lib/db.js'

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

const SESSION = 's-1'
const PROBLEM = 'm5.oa.order-of-operations/precedence'
const OTHER = 'm5.nbt.long-multiplication/two-by-one'
const SEED = 4242

const post = (body) =>
  POST({ url: 'http://localhost:3000/homeworks/api/hints', json: async () => body })

const ask = (overrides = {}) =>
  post({ sessionId: SESSION, problemId: PROBLEM, seed: SEED, ...overrides })

const bind = (problemId = PROBLEM, seed = SEED, sessionId = SESSION) =>
  insertSessionItem({ session_id: sessionId, problem_id: problemId, seed })

beforeEach(() => {
  initDb(':memory:')
  insertStudent({ id: 'kid', display_name: 'Kid', avatar: '🦊', grade: 5, settings: {} })
  insertSession({
    id: SESSION,
    student_id: 'kid',
    kind: 'daily',
    skill_id: null,
    local_date: '2026-09-27',
    tz: 'America/New_York',
  })
  bind()
})

afterAll(() => {
  global.Response = originalResponse
})

describe('POST /homeworks/api/hints', () => {
  it('hands back the first hint of the rendered problem', async () => {
    const res = await ask()
    expect(res.status).toBe(200)
    const payload = await res.json()
    expect(Object.keys(payload).sort()).toEqual(['hint', 'hintsUsed'])
    expect(payload.hint).toBe(render(getProblem(PROBLEM), SEED).hints[0])
    expect(payload.hintsUsed).toBe(1)
  })

  it('counts the hint against the item, in the database', async () => {
    await ask()
    expect(getSessionItem(SESSION, PROBLEM, SEED).hints_used).toBe(1)
  })

  it('walks through the hints in order and stops when they run out', async () => {
    const hints = render(getProblem(PROBLEM), SEED).hints
    expect(hints.length).toBe(2)

    const first = await (await ask()).json()
    expect([first.hint, first.hintsUsed]).toEqual([hints[0], 1])

    const second = await (await ask()).json()
    expect([second.hint, second.hintsUsed]).toEqual([hints[1], 2])
    expect(getSessionItem(SESSION, PROBLEM, SEED).hints_used).toBe(2)

    const third = await ask()
    expect(third.status).toBe(409)
    const payload = await third.json()
    expect(typeof payload.error).toBe('string')
    expect(payload.hint).toBeUndefined()
    expect(getSessionItem(SESSION, PROBLEM, SEED).hints_used).toBe(2)
  })

  it('never lets a fourth request push the counter past the hints that exist', async () => {
    for (let i = 0; i < 6; i++) await ask()
    expect(getSessionItem(SESSION, PROBLEM, SEED).hints_used).toBe(2)
  })

  it('leaves tries alone', async () => {
    await ask()
    await ask()
    expect(getSessionItem(SESSION, PROBLEM, SEED).tries).toBe(0)
  })

  it('charges only the item that was asked about', async () => {
    bind(OTHER, 99)
    await ask()
    expect(getSessionItem(SESSION, PROBLEM, SEED).hints_used).toBe(1)
    expect(getSessionItem(SESSION, OTHER, 99).hints_used).toBe(0)
  })

  it('serves each bound item its own hints', async () => {
    bind(OTHER, 99)
    const mine = await (await ask()).json()
    const theirs = await (await ask({ problemId: OTHER, seed: 99 })).json()
    expect(mine.hint).toBe(render(getProblem(PROBLEM), SEED).hints[0])
    expect(theirs.hint).toBe(render(getProblem(OTHER), 99).hints[0])
  })

  it.each([
    ['a seed that was never bound', { seed: 777 }],
    ['a problem that was never bound', { problemId: OTHER }],
    ['a problem that does not exist at all', { problemId: 'm5.oa.order-of-operations/nope' }],
    ['a session that does not exist', { sessionId: 'no-such-session' }],
    ['someone else\u2019s session id', { sessionId: 's-2' }],
  ])('refuses %s with 409', async (_label, overrides) => {
    const res = await ask(overrides)
    expect(res.status).toBe(409)
    const payload = await res.json()
    expect(typeof payload.error).toBe('string')
    expect(payload.hint).toBeUndefined()
    expect(getSessionItem(SESSION, PROBLEM, SEED).hints_used).toBe(0)
  })

  it('refuses a seed that only differs by type', async () => {
    const res = await ask({ seed: String(SEED) })
    expect([400, 409]).toContain(res.status)
    expect(getSessionItem(SESSION, PROBLEM, SEED).hints_used).toBe(0)
  })

  it.each([
    ['no sessionId', { sessionId: undefined }],
    ['a non-string sessionId', { sessionId: 5 }],
    ['an empty sessionId', { sessionId: '' }],
    ['no problemId', { problemId: undefined }],
    ['a non-string problemId', { problemId: 5 }],
    ['an empty problemId', { problemId: '' }],
    ['no seed', { seed: undefined }],
    ['a fractional seed', { seed: 1.5 }],
    ['a negative seed', { seed: -1 }],
    ['a null seed', { seed: null }],
  ])('rejects %s with 400 and no side effect', async (_label, overrides) => {
    const body = { sessionId: SESSION, problemId: PROBLEM, seed: SEED, ...overrides }
    for (const [key, value] of Object.entries(overrides)) if (value === undefined) delete body[key]
    const res = await post(body)
    expect(res.status).toBe(400)
    expect(typeof (await res.json()).error).toBe('string')
    expect(getSessionItem(SESSION, PROBLEM, SEED).hints_used).toBe(0)
  })

  it.each([
    ['null', null],
    ['an array', []],
    ['a string', 'hint please'],
  ])('rejects a body that is %s with 400', async (_label, body) => {
    const res = await post(body)
    expect(res.status).toBe(400)
    expect(typeof (await res.json()).error).toBe('string')
  })

  it('answers 400 rather than throwing when the body is not JSON', async () => {
    const res = await POST({
      url: 'http://localhost:3000/homeworks/api/hints',
      json: async () => {
        throw new SyntaxError('Unexpected end of JSON input')
      },
    })
    expect(res.status).toBe(400)
    expect(typeof (await res.json()).error).toBe('string')
  })

  it('ships a hint and nothing else — no answer, no explanation, no remaining hints', async () => {
    const rendered = render(getProblem(PROBLEM), SEED)
    const payload = await (await ask()).json()
    const text = JSON.stringify(payload)
    for (const key of ['answer', 'explanation', 'hints', 'steps', 'partials', 'parts', 'lcd']) {
      expect([key, Object.prototype.hasOwnProperty.call(payload, key)]).toEqual([key, false])
    }
    expect(text).not.toContain(rendered.explanation)
    expect(text).not.toContain(rendered.hints[1])
  })
})
