import { describe, expect, it } from '@jest/globals'

import { dayBoundsInZone, localDateOf } from './localDay.js'

// PR #53 review. Some zones change offset AT local midnight, so a local day can start at
// 01:00 (midnight skipped) or end after a repeated 23:00 hour. Expected instants come from
// the tz database, not from the implementation:
//   America/Sao_Paulo 2018-11-04 00:00 -03 -> 01:00 -02 (DST start, midnight skipped)
//   America/Sao_Paulo 2019-02-17 00:00 -02 -> 2019-02-16 23:00 -03 (DST end, 23:00 repeated)
const SAO_PAULO = 'America/Sao_Paulo'

describe('dayBoundsInZone when the offset changes at local midnight', () => {
  it('starts the day at 01:00 local when midnight is skipped', () => {
    expect(dayBoundsInZone('2018-11-04', SAO_PAULO)).toEqual({
      start: Date.UTC(2018, 10, 4, 3), // 01:00 -02
      end: Date.UTC(2018, 10, 5, 2), // 00:00 -02
    })
  })

  it('ends the previous day where the skipped day begins', () => {
    expect(dayBoundsInZone('2018-11-03', SAO_PAULO)).toEqual({
      start: Date.UTC(2018, 10, 3, 3), // 00:00 -03
      end: Date.UTC(2018, 10, 4, 3), // first instant of Nov 4
    })
  })

  it('makes the day before a repeated 23:00 hour 25 hours long', () => {
    expect(dayBoundsInZone('2019-02-16', SAO_PAULO)).toEqual({
      start: Date.UTC(2019, 1, 16, 2), // 00:00 -02
      end: Date.UTC(2019, 1, 17, 3), // 00:00 -03, after the repeated hour
    })
  })

  it.each([
    ['2018-11-03', SAO_PAULO],
    ['2018-11-04', SAO_PAULO],
    ['2019-02-16', SAO_PAULO],
    ['2019-02-17', SAO_PAULO],
    ['2026-03-08', 'America/Havana'],
    ['2026-11-01', 'America/Havana'],
    ['2026-09-06', 'America/Santiago'],
    ['2026-03-08', 'America/New_York'],
    ['2026-11-01', 'America/New_York'],
  ])('%s in %s spans exactly the instants whose local date is that day', (day, zone) => {
    const { start, end } = dayBoundsInZone(day, zone)
    expect(localDateOf(start, zone)).toBe(day)
    expect(localDateOf(start - 1, zone)).not.toBe(day)
    expect(localDateOf(end - 1, zone)).toBe(day)
    expect(localDateOf(end, zone)).not.toBe(day)
  })
})

describe('dayBoundsInZone with a well-formed string that is not a calendar date', () => {
  it.each(['2026-02-31', '2026-04-31', '2026-13-01', '2026-00-10', '2026-05-00', '2025-02-29'])(
    'rejects %s instead of rolling it into another day',
    (day) => {
      expect(() => dayBoundsInZone(day, 'UTC')).toThrow(day)
    },
  )

  it('accepts February 29 in a leap year', () => {
    expect(dayBoundsInZone('2024-02-29', 'UTC')).toEqual({
      start: Date.UTC(2024, 1, 29),
      end: Date.UTC(2024, 2, 1),
    })
  })
})
