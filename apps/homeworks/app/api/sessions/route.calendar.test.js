/**
 * @jest-environment node
 */
/**
 * P1.7 review follow-up — POST /homeworks/api/sessions must reject impossible
 * calendar dates.
 *
 * PR #83 review, Medium: "Incomplete date validation permits impossible calendar dates."
 *
 * VERIFIED against the route at fec2cea by probe
 * (`node tmp/P17-review-probe.mjs`, output pasted in tmp/P17-review-report.md):
 *   2024-02-30 -> 201 STORED local_date=2024-02-30
 *   2024-04-31 -> 201 STORED local_date=2024-04-31
 *   2024-11-31 -> 201 STORED local_date=2024-11-31
 *   2023-02-29 -> 201 STORED local_date=2023-02-29
 * The route only range-checks the two numbers (`month` 1..12, `day` 1..31), so any
 * day <= 31 is waved through regardless of which month it lands in.
 *
 * Why this matters rather than being cosmetic: `practice_sessions.local_date` is the
 * key every daily-practice query groups by (§6.4 stores it as TEXT, and
 * `getAttemptsByStudentDay(studentId, localDate)` reads it back verbatim). A session
 * filed under a day that does not exist can never be reached again by a real
 * "today" lookup, so the attempts written under it are orphaned — silently, which
 * AGENTS.md "No Silent Failures" forbids.
 *
 * This spec pins the CLASS, not the four dates above: it sweeps every (year, month,
 * day) triple in a range that covers all four month lengths and all three branches of
 * the Gregorian leap rule, and asserts the route agrees with an oracle written out
 * here independently of the implementation.
 *
 * Deliberately NOT changed, and asserted so:
 *   - the success-path response shape stays `{ sessionId }` at 201, and the stored
 *     `local_date` is the submitted string byte for byte;
 *   - the rejection keeps the SAME message the existing format/range rejections use
 *     ('localDate must be a valid YYYY-MM-DD date'), so no caller has a new string to
 *     branch on;
 *   - every rejection the existing spec already covers (slash form, unpadded, month
 *     13, month 00, day 00, day 32, non-string) still rejects, with no session written.
 */
import { afterAll, beforeEach, describe, expect, it } from '@jest/globals'

import { getSessionById, initDb } from '../../../lib/db.js'

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

const DATE_ERROR = 'localDate must be a valid YYYY-MM-DD date'

const post = (body) =>
  POST({ url: 'http://localhost:3000/homeworks/api/sessions', json: async () => body })

const create = async (localDate) => {
  const res = await post({ ...VALID, localDate })
  return { res, payload: await res.json() }
}

// The oracle. Written out from the Gregorian rules rather than derived from Date,
// so that it is independent of whatever the route ends up doing.
const isLeapYear = (year) => (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0

const daysInMonth = (year, month) =>
  [31, isLeapYear(year) ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31][month - 1]

const pad = (value) => String(value).padStart(2, '0')

// 1900 is the century-not-divisible-by-400 case, 2000 the divisible-by-400 case,
// 2024 an ordinary leap year, 2023/2025 ordinary common years, 2100 a second
// century non-leap year. Days run to 32 so the one-past-the-end of every month
// length (28, 29, 30, 31) is exercised.
const YEARS = [1900, 2000, 2023, 2024, 2025, 2100]
const MONTHS = Array.from({ length: 12 }, (_, index) => index + 1)
const DAYS = Array.from({ length: 32 }, (_, index) => index + 1)

const sweep = () => {
  const real = []
  const impossible = []
  for (const year of YEARS) {
    for (const month of MONTHS) {
      for (const day of DAYS) {
        const text = `${year}-${pad(month)}-${pad(day)}`
        if (day <= daysInMonth(year, month)) real.push(text)
        else impossible.push(text)
      }
    }
  }
  return { real, impossible }
}

beforeEach(() => {
  initDb(':memory:')
})

afterAll(() => {
  global.Response = originalResponse
})

describe('POST /homeworks/api/sessions — localDate must be a real calendar date', () => {
  it('rejects every day that overruns its month, across all four month lengths', async () => {
    const { impossible } = sweep()
    expect(impossible.length).toBeGreaterThan(100)

    const accepted = []
    for (const localDate of impossible) {
      const { res, payload } = await create(localDate)
      if (res.status !== 400 || payload.sessionId !== undefined) {
        accepted.push(`${localDate} -> ${res.status}`)
      }
    }
    expect(accepted).toEqual([])
  })

  it('still accepts every real calendar date in the same sweep', async () => {
    const { real } = sweep()
    expect(real.length).toBeGreaterThan(2000)

    const refused = []
    for (const localDate of real) {
      const { res, payload } = await create(localDate)
      if (res.status !== 201 || typeof payload.sessionId !== 'string') {
        refused.push(`${localDate} -> ${res.status}`)
      }
    }
    expect(refused).toEqual([])
  })

  it('applies the full Gregorian leap rule to 29 February', async () => {
    const cases = [
      ['2024-02-29', 201],
      ['2000-02-29', 201],
      ['1996-02-29', 201],
      ['2023-02-29', 400],
      ['2025-02-29', 400],
      ['1900-02-29', 400],
      ['2100-02-29', 400],
      ['2200-02-29', 400],
    ]
    const seen = []
    for (const [localDate] of cases) {
      const { res } = await create(localDate)
      seen.push([localDate, res.status])
    }
    expect(seen).toEqual(cases)
  })

  it('rejects the four dates the review named', async () => {
    const named = ['2024-02-30', '2024-04-31', '2024-11-31', '2023-02-29']
    const seen = []
    for (const localDate of named) {
      const { res, payload } = await create(localDate)
      seen.push([localDate, res.status, payload.error])
    }
    expect(seen).toEqual(named.map((localDate) => [localDate, 400, DATE_ERROR]))
  })

  it('accepts the last real day of every month and refuses the one after it', async () => {
    const year = 2025
    const seen = []
    for (const month of MONTHS) {
      const last = daysInMonth(year, month)
      const ok = await create(`${year}-${pad(month)}-${pad(last)}`)
      const over = await create(`${year}-${pad(month)}-${pad(last + 1)}`)
      seen.push([month, ok.res.status, over.res.status])
    }
    expect(seen).toEqual(MONTHS.map((month) => [month, 201, 400]))
  })

  it('writes no session row when the date is impossible', async () => {
    const { payload } = await create('2024-02-30')
    expect(payload.sessionId).toBeUndefined()
    expect(payload.error).toBe(DATE_ERROR)

    const good = await create('2024-02-29')
    const session = getSessionById(good.payload.sessionId)
    expect(session.local_date).toBe('2024-02-29')
  })

  it('keeps the existing format and range rejections, with the same message', async () => {
    const bad = [
      '2026/09/27',
      '2026-9-7',
      '2026-13-01',
      '2026-00-10',
      '2026-01-00',
      '2026-01-32',
      '2026-01-01T00:00:00Z',
      '',
    ]
    const seen = []
    for (const localDate of bad) {
      const { res, payload } = await create(localDate)
      seen.push([localDate, res.status, payload.error])
    }
    expect(seen).toEqual(bad.map((localDate) => [localDate, 400, DATE_ERROR]))

    const notAString = await post({ ...VALID, localDate: 1758931200 })
    expect(notAString.status).toBe(400)
    expect((await notAString.json()).error).toBe(DATE_ERROR)
  })

  it('leaves the success path untouched — 201, { sessionId }, stored verbatim', async () => {
    const { res, payload } = await create('2026-09-27')
    expect(res.status).toBe(201)
    expect(Object.keys(payload)).toEqual(['sessionId'])
    expect(typeof payload.sessionId).toBe('string')

    const session = getSessionById(payload.sessionId)
    expect(session.local_date).toBe('2026-09-27')
    expect(session.student_id).toBe('public')
    expect(session.kind).toBe('daily')
    expect(session.tz).toBe('America/New_York')
  })
})
