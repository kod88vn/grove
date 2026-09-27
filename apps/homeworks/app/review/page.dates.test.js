/**
 * Bug: the review page day headers are one day early for anyone west of UTC.
 *
 * /homeworks/api/review groups submissions by the UTC calendar day and returns
 * `day.date` as 'YYYY-MM-DD' (app/api/review/route.js). formatDate parses that as
 * UTC midnight but formats it in the viewer's local zone, so in the US
 * '2026-05-24' renders as 'Sat, May 23, 2026'.
 *
 * CI runs in UTC, where the bug is invisible, so this spec simulates a US-Pacific
 * viewer: toLocaleDateString defaults to America/Los_Angeles unless the caller
 * passes an explicit timeZone.
 */
import { describe, it, expect, beforeEach, afterEach, jest } from '@jest/globals'
import '@testing-library/jest-dom'
import { render, screen } from '@testing-library/react'

import ReviewPage from './page'

const realToLocaleDateString = Date.prototype.toLocaleDateString

function day(date) {
  return { date, submissions: [], readings: [] }
}

describe('ReviewPage day headers for a viewer west of UTC', () => {
  beforeEach(() => {
    jest.spyOn(Date.prototype, 'toLocaleDateString').mockImplementation(function (locales, options) {
      return realToLocaleDateString.call(this, locales, { timeZone: 'America/Los_Angeles', ...options })
    })
    global.fetch = jest.fn(async () => ({
      ok: true,
      status: 200,
      json: async () => ({ days: [day('2026-05-24'), day('2026-01-01')] }),
    }))
  })

  afterEach(() => {
    jest.restoreAllMocks()
  })

  it('shows the calendar day the API grouped by, not the day before', async () => {
    render(<ReviewPage />)

    expect(await screen.findByText('Sun, May 24, 2026')).toBeInTheDocument()
    expect(screen.getByText('Thu, Jan 1, 2026')).toBeInTheDocument()
    expect(screen.queryByText('Sat, May 23, 2026')).not.toBeInTheDocument()
    expect(screen.queryByText('Wed, Dec 31, 2025')).not.toBeInTheDocument()
  })

  // F1: the server can only bucket by the viewer's local day if it is told the zone.
  it("asks the API to group by the viewer's own time zone", async () => {
    const tz = Intl.DateTimeFormat().resolvedOptions().timeZone
    render(<ReviewPage />)

    await screen.findByText('Sun, May 24, 2026')
    expect(global.fetch).toHaveBeenCalledWith(`/homeworks/api/review?tz=${encodeURIComponent(tz)}`)
  })
})
