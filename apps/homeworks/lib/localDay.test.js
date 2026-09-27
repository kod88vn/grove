import { describe, expect, it } from '@jest/globals'

import { dayBoundsInZone, isValidTimeZone, localDateOf } from './localDay.js'

describe('localDateOf', () => {
  it('returns the calendar day in the given zone, not the UTC day', () => {
    // 8 pm EDT on May 24 is 00:00Z on May 25.
    expect(localDateOf('2026-05-25T00:00:00.000Z', 'America/New_York')).toBe('2026-05-24')
    expect(localDateOf('2026-05-25T00:00:00.000Z', 'UTC')).toBe('2026-05-25')
  })

  it('handles zones east of UTC', () => {
    // 23:30Z on May 24 is already May 25 in Tokyo (UTC+9).
    expect(localDateOf('2026-05-24T23:30:00.000Z', 'Asia/Tokyo')).toBe('2026-05-25')
  })
})

describe('dayBoundsInZone', () => {
  it('spans local midnight to local midnight', () => {
    expect(dayBoundsInZone('2026-05-24', 'America/New_York')).toEqual({
      start: Date.UTC(2026, 4, 24, 4),
      end: Date.UTC(2026, 4, 25, 4),
    })
  })

  it('is UTC midnight to UTC midnight for UTC', () => {
    expect(dayBoundsInZone('2026-05-24', 'UTC')).toEqual({
      start: Date.UTC(2026, 4, 24),
      end: Date.UTC(2026, 4, 25),
    })
  })

  it('is 23 hours long on the spring-forward day', () => {
    const { start, end } = dayBoundsInZone('2026-03-08', 'America/New_York')
    expect(start).toBe(Date.UTC(2026, 2, 8, 5))
    expect(end).toBe(Date.UTC(2026, 2, 9, 4))
  })

  it('is 25 hours long on the fall-back day', () => {
    const { start, end } = dayBoundsInZone('2026-11-01', 'America/New_York')
    expect(start).toBe(Date.UTC(2026, 10, 1, 4))
    expect(end).toBe(Date.UTC(2026, 10, 2, 5))
  })

  it('puts the 8 pm submission inside its local day', () => {
    const { start, end } = dayBoundsInZone('2026-05-24', 'America/New_York')
    const eightPm = Date.parse('2026-05-25T00:00:00.000Z')
    expect(eightPm >= start && eightPm < end).toBe(true)
  })

  it('rejects a malformed day string', () => {
    expect(() => dayBoundsInZone('2026-5-24', 'UTC')).toThrow(/YYYY-MM-DD/)
  })
})

describe('isValidTimeZone', () => {
  it('accepts IANA names and rejects unknown ones', () => {
    expect(isValidTimeZone('America/New_York')).toBe(true)
    expect(isValidTimeZone('UTC')).toBe(true)
    expect(isValidTimeZone('Mars/Olympus')).toBe(false)
    expect(isValidTimeZone('')).toBe(false)
  })
})
