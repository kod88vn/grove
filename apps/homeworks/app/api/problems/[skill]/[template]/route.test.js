/**
 * @jest-environment node
 */
/**
 * P1.7 part 5 of 10 — GET /homeworks/api/problems/:skill/:template.
 *
 * HOMEWORK_PLAN.md §6.6: "/problems/:skill/:template — GET, rendered instance — no answer,
 * no explanation". §6.2 makes a problem id `<skill>/<template>`, so the two path segments
 * concatenate back into the id @grove/curriculum's getProblem takes.
 *
 * §10 Phase 1 acceptance: "the answer never appears in the network payload before solving".
 * That is why toInstance exists (part 1, run 73) and why this route must project through
 * it rather than deleting two keys by hand: order-of-operations puts the worked answer in
 * visual.steps, long-multiplication puts the per-row answers in visual.partials, and the
 * fraction templates put hint 1 in visual.lcd. All three survive a `delete answer`.
 *
 * ASSUMED, because §6.6 names no parameters:
 *   - `?seed=` is honoured when given, so a client can re-fetch the exact instance it was
 *     already shown (a refresh must not silently become a different problem);
 *   - an absent seed means the SERVER picks one and returns it in the payload. §6.6's
 *     /sessions/:id/items row says "server-issued seed"; this route is the unbound preview
 *     of the same thing, so the seed still comes from the server, never from the client's
 *     imagination;
 *   - the seed domain is the 32-bit non-negative range, matching session_items.seed;
 *   - a malformed seed is a 400, not a silently-substituted random one, because the caller
 *     would then be shown a different problem than the one it asked for and could not tell;
 *   - an unknown skill or template is a 404;
 *   - the envelope key is `instance`, matching `students` and `problems`.
 *
 * This route touches no database. It is a pure function of (id, seed).
 */
import { afterAll, describe, expect, it } from '@jest/globals'

import { getProblem, listProblems, render, toInstance } from '@grove/curriculum'

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

const ALL = listProblems()
const SAMPLE = ALL[0].id
const INSTANCE_KEYS = ['difficulty', 'problemId', 'prompt', 'seed', 'skill', 'version', 'visual', 'widget']

const split = (id) => {
  const cut = id.lastIndexOf('/')
  return { skill: id.slice(0, cut), template: id.slice(cut + 1) }
}

const get = (id, query = '') =>
  GET(
    { url: `http://localhost:3000/homeworks/api/problems/${id}${query}` },
    { params: Promise.resolve(split(id)) },
  )

const instanceOf = async (id, query = '') => (await (await get(id, query)).json()).instance

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

describe('GET /homeworks/api/problems/:skill/:template', () => {
  it('answers 200 with the instance under an `instance` key', async () => {
    const res = await get(SAMPLE, '?seed=12345')
    expect(res.status).toBe(200)
    const { instance } = await res.json()
    expect(instance.problemId).toBe(SAMPLE)
  })

  it('serves every template the catalog lists', async () => {
    for (const { id } of ALL) {
      const res = await get(id, '?seed=7')
      expect([id, res.status]).toEqual([id, 200])
      expect((await res.json()).instance.problemId).toBe(id)
    }
  })

  it('is exactly toInstance(render(template, seed)) — no hand-rolled projection', async () => {
    for (const { id } of ALL) {
      const expected = toInstance(render(getProblem(id), 4242))
      expect(await instanceOf(id, '?seed=4242')).toEqual(JSON.parse(JSON.stringify(expected)))
    }
  })

  it('carries exactly the eight public keys', async () => {
    for (const { id } of ALL) {
      expect(Object.keys(await instanceOf(id, '?seed=7')).sort()).toEqual(INSTANCE_KEYS)
    }
  })

  it('honours the seed it was given and echoes it back', async () => {
    for (const seed of [0, 1, 12345, 2147483647]) {
      expect((await instanceOf(SAMPLE, `?seed=${seed}`)).seed).toBe(seed)
    }
  })

  it('is deterministic — the same seed twice gives the identical instance', async () => {
    expect(await instanceOf(SAMPLE, '?seed=987654321')).toEqual(await instanceOf(SAMPLE, '?seed=987654321'))
  })

  it('issues its own seed when none is given, in the 32-bit non-negative range', async () => {
    const seeds = []
    for (let i = 0; i < 40; i++) seeds.push((await instanceOf(SAMPLE)).seed)
    for (const seed of seeds) {
      expect(Number.isInteger(seed)).toBe(true)
      expect(seed).toBeGreaterThanOrEqual(0)
      expect(seed).toBeLessThanOrEqual(2147483647)
    }
    expect(new Set(seeds).size).toBeGreaterThan(1)
  })

  it('renders the instance it claims — a server-issued seed reproduces it exactly', async () => {
    const issued = await instanceOf(SAMPLE)
    expect(await instanceOf(SAMPLE, `?seed=${issued.seed}`)).toEqual(issued)
  })

  it.each([
    ['seed=abc'],
    ['seed=1.5'],
    ['seed=-1'],
    ['seed='],
    ['seed=2147483648'],
    ['seed=1e3'],
  ])('rejects %s with 400 and a reason', async (query) => {
    const res = await get(SAMPLE, `?${query}`)
    expect(res.status).toBe(400)
    const payload = await res.json()
    expect(typeof payload.error).toBe('string')
    expect(payload.instance).toBeUndefined()
  })

  it('rejects an unsupported query parameter with 400', async () => {
    expect((await get(SAMPLE, '?studentId=public')).status).toBe(400)
  })

  it.each([
    ['unknown skill', 'm5.zz.not-a-skill/exact-division'],
    ['unknown template', `${split(SAMPLE).skill}/not-a-template`],
    ['both unknown', 'nope/nope'],
  ])('answers 404 for an %s', async (_label, id) => {
    const res = await get(id, '?seed=7')
    expect(res.status).toBe(404)
    expect(typeof (await res.json()).error).toBe('string')
  })

  it('never returns an answer, explanation, hint or working at any depth', async () => {
    const banned = ['answer', 'explanation', 'hints', 'steps', 'partials', 'parts', 'lcd']
    const found = []
    for (const { id } of ALL) {
      for (const seed of [1, 7, 66, 4242]) {
        const payload = await (await get(id, `?seed=${seed}`)).json()
        walk(payload, (value, path) => {
          if (!value || typeof value !== 'object' || Array.isArray(value)) return
          for (const key of banned) if (key in value) found.push(`${id}@${seed} ${path}.${key}`)
        })
      }
    }
    expect(found).toEqual([])
  })

  it('never returns the explanation text, even embedded in a longer string', async () => {
    const found = []
    for (const { id } of ALL) {
      for (const seed of [1, 7, 66, 4242]) {
        const { explanation } = render(getProblem(id), seed)
        if (typeof explanation !== 'string' || explanation.length === 0) continue
        const serialised = JSON.stringify(await (await get(id, `?seed=${seed}`)).json())
        if (serialised.includes(explanation)) found.push(`${id}@${seed}`)
      }
    }
    expect(found).toEqual([])
  })

  it('never returns a numeric answer inside the prompt or the visual', async () => {
    // Restricted to the widgets whose answer is a bare number: a cloze answer is
    // necessarily one of visual.choices, and a fraction's denominator is legitimately an
    // addend's. Metadata is excluded for the same reason as in the package spec —
    // difficulty 3 on a problem whose answer is 3 tells a kid nothing.
    let checked = 0
    const found = []
    for (const { id, widget } of ALL) {
      if (widget !== 'number' && widget !== 'column') continue
      for (const seed of [1, 7, 66, 4242, 987654321]) {
        const answer = render(getProblem(id), seed).answer.value
        expect(typeof answer).toBe('number')
        const { prompt, visual } = await instanceOf(id, `?seed=${seed}`)
        walk({ prompt, visual }, (value, path) => {
          if (value === answer) found.push(`${id}@${seed} ${path} === ${answer}`)
          if (typeof value === 'string' && value.trim() === String(answer)) {
            found.push(`${id}@${seed} ${path} === "${answer}"`)
          }
        })
        checked++
      }
    }
    expect(found).toEqual([])
    expect(checked).toBeGreaterThanOrEqual(4)
  })

  it('is plain JSON — no functions, no undefined', async () => {
    const payload = await (await get(SAMPLE, '?seed=7')).json()
    expect(JSON.parse(JSON.stringify(payload))).toEqual(payload)
    const bad = []
    walk(payload, (value, path) => {
      if (typeof value === 'function' || value === undefined) bad.push(path)
    })
    expect(bad).toEqual([])
  })
})
