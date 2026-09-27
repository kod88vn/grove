/**
 * @jest-environment node
 */
/**
 * P1.7 part 6b of 10 — referee finding against POST /homeworks/api/sessions.
 *
 * The route rejects a UTC offset written as "+05:00" but accepts the same offset
 * written "+0530", "+05" or "-0800". Probed against lib/localDay.js in this worktree:
 *
 *   "+05:00"   isValidTimeZone=true   route=400
 *   "+0530"    isValidTimeZone=true   route=201
 *   "+05"      isValidTimeZone=true   route=201
 *   "-0800"    isValidTimeZone=true   route=201
 *
 * Intl accepts all four, so isValidTimeZone alone cannot separate them; the route added
 * a /^[+-]\d{2}:\d{2}$/ guard that catches exactly one spelling of the thing it meant to
 * ban. Two kids expressing the same intent get different answers, and the offsets that
 * slip through are stored as `practice_sessions.tz` forever.
 *
 * Why offsets are banned at all (ASSUMED — §6.6 says only that /sessions takes a `tz`):
 * a fixed offset cannot express daylight saving, so `dayBoundsInZone` silently draws the
 * day boundary an hour out for part of the year, and every streak, daily-seed and
 * review-window query in this app is keyed on that boundary. A zone name is required.
 *
 * The rule this pins: a tz must be an IANA zone NAME. Names do not start with + or -.
 * Fixed-offset zones that are genuine IANA names (UTC, GMT, Etc/GMT+5) stay legal —
 * they are names, they are stable, and banning them would be a different decision.
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

const post = (tz) =>
  POST({
    url: 'http://localhost:3000/homeworks/api/sessions',
    json: async () => ({
      studentId: 'public',
      kind: 'daily',
      localDate: '2026-09-27',
      tz,
    }),
  })

beforeEach(() => {
  initDb(':memory:')
})

afterAll(() => {
  global.Response = originalResponse
})

describe('POST /homeworks/api/sessions — a time zone must be a name, not an offset', () => {
  it.each([['+05:00'], ['-08:00'], ['+0530'], ['-0800'], ['+05'], ['-08'], ['+00:00']])(
    'rejects the offset %s with 400 and stores no session',
    async (tz) => {
      const res = await post(tz)
      expect([tz, res.status]).toEqual([tz, 400])
      const payload = await res.json()
      expect(typeof payload.error).toBe('string')
      expect(payload.sessionId).toBeUndefined()
    },
  )

  it.each([['UTC'], ['GMT'], ['Etc/GMT+5'], ['America/New_York'], ['Australia/Eucla']])(
    'still accepts the zone name %s',
    async (tz) => {
      const res = await post(tz)
      expect([tz, res.status]).toEqual([tz, 201])
      const { sessionId } = await res.json()
      expect(getSessionById(sessionId).tz).toBe(tz)
    },
  )

  it('treats every spelling of one offset the same way', async () => {
    const statuses = []
    for (const tz of ['+05:00', '+0500', '+05']) statuses.push((await post(tz)).status)
    expect(new Set(statuses).size).toBe(1)
  })
})
