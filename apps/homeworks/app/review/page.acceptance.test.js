/**
 * Phase 0 acceptance (HOMEWORK_PLAN.md §10): the review page buckets an 8 pm
 * America/New_York submission on the correct day.
 *
 * 8 pm in New York is already the next day in UTC, so a page that groups by UTC
 * shows homework done on Sunday evening under Monday.
 *
 * Nothing between the stored row and the rendered header is faked: rows go into real
 * in-memory SQLite, the page's own fetch URL is served by the real review route, and
 * the page renders what that route returns. Only the viewer's time zone and the
 * clock that bounds getAll()'s 30-day window are pinned.
 */
import { afterAll, afterEach, beforeEach, describe, expect, it, jest } from '@jest/globals'
import '@testing-library/jest-dom'
import { fireEvent, render, screen } from '@testing-library/react'

class TestResponse {
  constructor(body, init = {}) {
    this.body = body
    this.status = init.status ?? 200
    this.ok = this.status >= 200 && this.status < 300
  }

  static json(payload, init = {}) {
    return new TestResponse(JSON.stringify(payload), init)
  }

  async json() {
    return JSON.parse(this.body)
  }
}

const { getDatabase, initDb, insertReading, insertSubmission } = require('../../lib/db.js')
const { GET: reviewGET } = require('../api/review/route')
const ReviewPage = require('./page').default

const VIEWER_ZONE = 'America/New_York'
const realResolvedOptions = Intl.DateTimeFormat.prototype.resolvedOptions
const originalResponse = global.Response

function saveSubmission(id, isoInstant) {
  insertSubmission({
    id,
    student_id: 'public',
    subject: 'math',
    type: 'mixed',
    exercise: { problems: [] },
    answers: { problems: [] },
    score: 1,
    max_score: 1,
    percentage: 100,
    feedback: '',
    details: {},
  })
  backdate('submissions', id, isoInstant)
}

function saveReading(id, isoInstant) {
  insertReading({
    id,
    student_id: 'public',
    passage: 'A short passage.',
    questions: [],
    lesson_key_point: `Reading ${id}`,
    domain: 'random',
    score: 1,
    max_score: 1,
    percentage: 100,
  })
  backdate('readings', id, isoInstant)
}

// created_at defaults to SQLite's own clock, so the submission time is set directly.
function backdate(table, id, isoInstant) {
  const seconds = Math.floor(Date.parse(isoInstant) / 1000)
  getDatabase().prepare(`UPDATE ${table} SET created_at = ? WHERE id = ?`).run(seconds, id)
}

// Serve the page's own request with the real route, as of `nowIso`.
function serveReviewAt(nowIso) {
  global.fetch = jest.fn(async (path) => {
    const clock = jest.spyOn(Date, 'now').mockReturnValue(Date.parse(nowIso))
    try {
      const res = await reviewGET({ url: `http://localhost${path}` })
      const body = await res.json()
      return { ok: res.ok, status: res.status, json: async () => body }
    } finally {
      clock.mockRestore()
    }
  })
}

async function openDay(header) {
  const heading = await screen.findByText(header)
  fireEvent.click(heading.closest('button'))
  return heading.closest('button').parentElement
}

describe('Review page buckets a New York evening submission on its local day', () => {
  beforeEach(() => {
    global.Response = TestResponse
    initDb(':memory:')
    jest.spyOn(Intl.DateTimeFormat.prototype, 'resolvedOptions').mockImplementation(function () {
      return { ...realResolvedOptions.call(this), timeZone: VIEWER_ZONE }
    })
  })

  afterEach(() => {
    jest.restoreAllMocks()
    delete global.fetch
    global.Response = originalResponse
  })

  afterAll(() => {
    initDb(':memory:')
  })

  it('shows an 8 pm EDT submission and reading under that Sunday, not Monday', async () => {
    // Sun 2026-05-24 20:00 EDT (UTC-4) is Mon 2026-05-25 00:00 UTC.
    saveSubmission('edt-8pm', '2026-05-25T00:00:00.000Z')
    saveReading('edt-8pm-reading', '2026-05-25T00:00:00.000Z')
    serveReviewAt('2026-05-25T12:00:00.000Z')

    render(<ReviewPage />)

    const card = await openDay('Sun, May 24, 2026')
    expect(card).toHaveTextContent('2 submissions')
    expect(card).toHaveTextContent('🔢 Math')
    expect(card).toHaveTextContent('Reading edt-8pm-reading')
    expect(screen.queryByText('Mon, May 25, 2026')).not.toBeInTheDocument()
    expect(global.fetch).toHaveBeenCalledWith(`/homeworks/api/review?tz=${encodeURIComponent(VIEWER_ZONE)}`)
  })

  it('shows an 8 pm EST submission under that Thursday, and splits the day at New York midnight', async () => {
    // Thu 2026-01-15 20:00 EST (UTC-5) is Fri 2026-01-16 01:00 UTC.
    saveSubmission('est-8pm', '2026-01-16T01:00:00.000Z')
    // 23:59:59 EST is still Thursday; 00:00 EST is Friday.
    saveSubmission('est-last-second', '2026-01-16T04:59:59.000Z')
    saveSubmission('est-midnight', '2026-01-16T05:00:00.000Z')
    serveReviewAt('2026-01-16T12:00:00.000Z')

    render(<ReviewPage />)

    const thursday = await openDay('Thu, Jan 15, 2026')
    expect(thursday).toHaveTextContent('2 submissions')
    const friday = await openDay('Fri, Jan 16, 2026')
    expect(friday).toHaveTextContent('1 submission')
    expect(friday).not.toHaveTextContent('2 submissions')
  })
})
