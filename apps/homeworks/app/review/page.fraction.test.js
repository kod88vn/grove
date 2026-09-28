/**
 * P1.9 follow-up — the kid's answer must be legible on the parent review.
 *
 * The box is "review shows every problem + answer" (HOMEWORK_PROGRESS.md P1.9), and
 * HOMEWORK_PLAN.md §6.7 calls /homeworks/review the parent review. A parent reading
 * `{"text":"7/9"}` has not been shown the answer.
 *
 * The four shipped templates produce four response shapes, VERIFIED by driving the real
 * handlers (apps/homeworks/app/api/attempts/route.js stores `response` verbatim, and
 * packages/curriculum/src/engine/check.js defines what it accepts):
 *
 *   number / column   response { value: 246 }             answer { value: 246 }
 *   cloze             response { blanks: ['cautious'] }   answer { blanks: [{ accept: [...] }] }
 *   fraction          response { text: '7/9' }            answer { num: 7, den: 9, simplest: true }
 *
 * The fraction RESPONSE is the one the page does not know how to write down: its shape is
 * `{ text }`, not `{ num, den }`, so it falls through to JSON.
 *
 * This asserts the rendered page, not a formatter, so it stays true however the formatting
 * is arranged.
 */
import { afterEach, beforeEach, describe, expect, it, jest } from '@jest/globals'
import '@testing-library/jest-dom'
import { fireEvent, render, screen } from '@testing-library/react'

import { getProblem, render as renderProblem } from '@grove/curriculum'

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

const { initDb } = require('../../lib/db.js')
const { POST: createStudent } = require('../api/students/route')
const { POST: createSession } = require('../api/sessions/route')
const { POST: takeItem } = require('../api/sessions/[id]/items/route')
const { POST: sendAttempt } = require('../api/attempts/route')
const { GET: reviewGET } = require('../api/review/route')
const ReviewPage = require('./page').default

const VIEWER_ZONE = 'America/New_York'
const NOW_ISO = '2026-09-27T16:00:00.000Z' // noon EDT
const LOCAL_DATE = '2026-09-27'
const FRACTION_ID = 'm5.nf.add-fractions-unlike/multiple-denominators'

const realResolvedOptions = Intl.DateTimeFormat.prototype.resolvedOptions
const originalResponse = global.Response

const req = (body, url = 'http://localhost:3000/homeworks/api/x') => ({ url, json: async () => body })
const bodyOf = (res) => res.json()

const dayHeading = (localDate) =>
  new Date(`${localDate}T00:00:00Z`).toLocaleDateString('en-US', {
    weekday: 'short', month: 'short', day: 'numeric', year: 'numeric', timeZone: 'UTC',
  })

const countOf = (haystack, needle) => haystack.split(needle).length - 1

/** One kid, one fraction, solved. Returns what the kid saw and what they sent. */
async function practiseOneFraction() {
  const student = (
    await bodyOf(await createStudent(req({ displayName: 'Kid', avatar: '🦊', grade: 5 })))
  ).student

  const { sessionId } = await bodyOf(await createSession(req({
    studentId: student.id, kind: 'skill', skillId: 'm5.nf.add-fractions-unlike',
    localDate: LOCAL_DATE, tz: VIEWER_ZONE,
  })))

  const taken = await bodyOf(await takeItem(req({ problemId: FRACTION_ID }), { params: { id: sessionId } }))
  const solution = renderProblem(getProblem(FRACTION_ID), taken.seed)
  const response = { text: `${solution.answer.num}/${solution.answer.den}` }

  await sendAttempt(req({ sessionId, problemId: FRACTION_ID, seed: taken.seed, response, durationMs: 9000 }))

  return { student, solution, response }
}

function serveReview() {
  global.fetch = jest.fn(async (path) => {
    const clock = jest.spyOn(Date, 'now').mockReturnValue(Date.parse(NOW_ISO))
    try {
      const res = await reviewGET({ url: `http://localhost${path}` })
      const body = await res.json()
      return { ok: res.ok, status: res.status, json: async () => body }
    } finally {
      clock.mockRestore()
    }
  })
}

async function openEverything() {
  const heading = await screen.findByText(dayHeading(LOCAL_DATE))
  const seen = new Set(screen.queryAllByRole('button'))
  fireEvent.click(heading.closest('button'))
  for (const button of screen.queryAllByRole('button')) {
    if (seen.has(button) || /refresh/i.test(button.textContent)) continue
    fireEvent.click(button)
  }
  return document.body.textContent
}

describe('P1.9 follow-up — a fraction answer reads as a fraction, not as JSON', () => {
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
    initDb(':memory:')
  })

  it('writes the kid\'s fraction answer and the correct one as num/den, with no JSON on the page', async () => {
    const { solution } = await practiseOneFraction()
    serveReview()

    render(<ReviewPage />)
    const text = await openEverything()

    const written = `${solution.answer.num}/${solution.answer.den}`

    // the problem is on the page at all
    expect(text).toContain(solution.prompt)

    // nothing anywhere on the parent review is a serialized object
    expect(text).not.toMatch(/\{\s*"[A-Za-z_][A-Za-z0-9_]*"\s*:/)

    // both the kid's answer and the correct one are written as a fraction
    expect(countOf(text, written)).toBeGreaterThanOrEqual(2)
  })
})
