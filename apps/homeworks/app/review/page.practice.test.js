/**
 * P1.9 — Phase 1 acceptance (HOMEWORK_PLAN.md §10 "Phase 1"):
 *
 *   "a kid completes an 8-problem session of long multiplication, the answer never
 *    appears in the network payload before solving, and the review page shows every
 *    problem with the kid's answer."
 *
 * Both halves, in one run, through the real handlers. Nothing is stubbed except the
 * request object, the viewer's time zone and the clock that bounds the review window.
 *
 * Grounding for what the review must carry — §6.6, `GET /review?studentId&day`:
 *   "**extended**: attempts grouped by `local_date`, with `shown_json` vs
 *    `response_json` vs `answer_json`"
 * and §6.4, which names `shown_json` "snapshot of prompt/visual". `lib/db.js`
 * `parseAttempt()` already surfaces those three columns as `shown` / `response` /
 * `answer`, so the review payload uses the same three names.
 *
 * Why unsolved items appear, and why their answer is shown: the box is "review shows
 * every problem + answer", and §6.7 calls `/homeworks/review` the **parent** review.
 * Principle 5 ("the client receives the prompt, never the answer, until the problem is
 * solved") governs the child-facing solve path — §6.6 marks `/problems/:skill/:template`
 * and `/sessions/:id/items` "no answer, no explanation". The parent's page is the one
 * place the answer is meant to be legible. An item the kid never finished has no
 * `attempts` row (§6.6: the row is written "on correct/reveal"), so its prompt and
 * answer come from re-rendering `(problem_id, seed)`, which is deterministic by §6.4's
 * reproducibility rule and principle 7.
 */
import { afterAll, afterEach, beforeEach, describe, expect, it, jest } from '@jest/globals'
import '@testing-library/jest-dom'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'

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

const { getDatabase, initDb, insertReading, insertSubmission } = require('../../lib/db.js')
const { POST: createStudent } = require('../api/students/route')
const { POST: createSession } = require('../api/sessions/route')
const { POST: takeItem } = require('../api/sessions/[id]/items/route')
const { POST: askHint } = require('../api/hints/route')
const { POST: sendAttempt } = require('../api/attempts/route')
const { GET: reviewGET } = require('../api/review/route')
const ReviewPage = require('./page').default

const VIEWER_ZONE = 'America/New_York'
const NOW_ISO = '2026-09-27T16:00:00.000Z' // noon EDT
const LOCAL_DATE = '2026-09-27' // the same instant, in New York
const MATH_ID = 'm5.nbt.long-multiplication/two-by-two'
const ENGLISH_ID = 'e5.l.context-clues/easy-words'
const SESSION_LENGTH = 8

const realResolvedOptions = Intl.DateTimeFormat.prototype.resolvedOptions
const originalResponse = global.Response

const req = (body, url = 'http://localhost:3000/homeworks/api/x') => ({ url, json: async () => body })
const bodyOf = (res) => res.json()

const dayHeading = (localDate) =>
  new Date(`${localDate}T00:00:00Z`).toLocaleDateString('en-US', {
    weekday: 'short', month: 'short', day: 'numeric', year: 'numeric', timeZone: 'UTC',
  })

const correctResponse = (widget, answer) =>
  widget === 'cloze'
    ? { blanks: answer.blanks.map((blank) => blank.accept[0]) }
    : { value: answer.value }

const wrongResponse = (widget) =>
  widget === 'cloze' ? { blanks: ['zzzzzzz'] } : { value: -999999 }

const keysAtEveryDepth = (node, found = []) => {
  if (Array.isArray(node)) {
    for (const entry of node) keysAtEveryDepth(entry, found)
    return found
  }
  if (node && typeof node === 'object') {
    for (const [key, value] of Object.entries(node)) {
      found.push(key)
      keysAtEveryDepth(value, found)
    }
  }
  return found
}

/**
 * One kid, one day: an 8-problem long-multiplication session (the last problem is
 * abandoned after a wrong try) plus one context-clues problem in a second session.
 * Returns what the kid was shown and what the server said back, so both halves of the
 * acceptance can be asserted against real data rather than fixtures.
 */
async function practiseOneDay() {
  const student = (
    await bodyOf(await createStudent(req({ displayName: 'Kid', avatar: '🦊', grade: 5 })))
  ).student

  const openSession = async (skillId) =>
    (await bodyOf(await createSession(req({
      studentId: student.id, kind: 'skill', skillId, localDate: LOCAL_DATE, tz: VIEWER_ZONE,
    })))).sessionId

  const mathSession = await openSession('m5.nbt.long-multiplication')
  const englishSession = await openSession('e5.l.context-clues')

  const items = []
  const beforeSolving = []

  const play = async (sessionId, problemId, { solve, hint }) => {
    const taken = await bodyOf(await takeItem(req({ problemId }), { params: { id: sessionId } }))
    beforeSolving.push(taken)
    const { seed } = taken
    const solution = renderProblem(getProblem(problemId), seed)
    const widget = taken.instance.widget

    if (hint) {
      beforeSolving.push(await bodyOf(await askHint(req({ sessionId, problemId, seed }))))
    }

    beforeSolving.push(await bodyOf(await sendAttempt(req({
      sessionId, problemId, seed, response: wrongResponse(widget), durationMs: 5000,
    }))))

    const response = solve ? correctResponse(widget, solution.answer) : null
    if (solve) {
      await sendAttempt(req({ sessionId, problemId, seed, response, durationMs: 9000 }))
    }

    items.push({ sessionId, problemId, seed, solution, response, solved: Boolean(solve) })
  }

  for (let index = 0; index < SESSION_LENGTH; index += 1) {
    await play(mathSession, MATH_ID, {
      solve: index < SESSION_LENGTH - 1, // the last one is left unfinished
      hint: index === 0,
    })
  }
  await play(englishSession, ENGLISH_ID, { solve: true, hint: false })

  return { student, items, beforeSolving }
}

function saveLegacyRows() {
  insertSubmission({
    id: 'legacy-submission',
    student_id: 'public',
    subject: 'math',
    type: 'problem-set',
    exercise: { problems: [] },
    answers: { problems: [] },
    score: 4,
    max_score: 5,
    percentage: 80,
    feedback: '',
    details: {},
  })
  insertReading({
    id: 'legacy-reading',
    student_id: 'public',
    passage: 'A short passage.',
    questions: [],
    lesson_key_point: 'Legacy reading kept working',
    domain: 'random',
    score: 1,
    max_score: 1,
    percentage: 100,
  })
  const seconds = Math.floor(Date.parse('2026-09-27T14:00:00.000Z') / 1000)
  for (const [table, id] of [['submissions', 'legacy-submission'], ['readings', 'legacy-reading']]) {
    getDatabase().prepare(`UPDATE ${table} SET created_at = ? WHERE id = ?`).run(seconds, id)
  }
}

// Serve the page's own request with the real route, at a pinned clock.
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

// Open the day, then anything the day revealed, so a disclosure cannot hide an item.
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

describe('P1.9 acceptance — the answer stays hidden until it is solved, and the review shows every problem', () => {
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

  it('never puts the answer in a payload the kid receives before solving', async () => {
    const { items, beforeSolving } = await practiseOneDay()

    expect(beforeSolving.length).toBeGreaterThanOrEqual(SESSION_LENGTH * 2)

    for (const [index, payload] of beforeSolving.entries()) {
      const leaked = keysAtEveryDepth(payload)
        .filter((key) => ['answer', 'explanation', 'hints', 'steps', 'partials'].includes(key))
      expect([index, leaked]).toEqual([index, []])
      const text = JSON.stringify(payload)
      expect([index, text.includes(items[0].solution.explanation)]).toEqual([index, false])
    }

    // Every product the kid had not yet found, against everything the server put in
    // front of them before they found it. The scan is on the prompt, the visual, the
    // hint they bought and the feedback on their miss — the envelope also carries
    // seeds and small integers an answer is entitled to collide with.
    const visibleText = beforeSolving.map((payload) => JSON.stringify({
      prompt: payload.instance?.prompt,
      visual: payload.instance?.visual,
      hint: payload.hint,
      feedback: payload.feedback,
    }))
    for (const item of items.filter((entry) => entry.problemId === MATH_ID)) {
      const standalone = new RegExp(`(^|[^0-9])${item.solution.answer.value}([^0-9]|$)`)
      for (const [index, text] of visibleText.entries()) {
        expect([item.seed, index, standalone.test(text)]).toEqual([item.seed, index, false])
      }
    }
  })

  it('shows every problem of the day, with the kid\'s answer and the correct answer', async () => {
    const { items } = await practiseOneDay()
    saveLegacyRows()
    serveReview()

    render(<ReviewPage />)
    const text = await openEverything()

    // Every problem: the eight long multiplications by their prompt, the cloze by the
    // sentence the kid actually read.
    for (const item of items.filter((entry) => entry.problemId === MATH_ID)) {
      expect([item.seed, text.includes(item.solution.prompt)]).toEqual([item.seed, true])
    }
    const english = items.find((entry) => entry.problemId === ENGLISH_ID)
    expect(text).toContain(english.solution.visual.sentence)

    // The correct answer, including for the problem the kid walked away from.
    const unfinished = items.find((entry) => !entry.solved)
    expect(unfinished).toBeDefined()
    expect(text).toContain(String(unfinished.solution.answer.value))
    expect(text).toContain(english.solution.answer.blanks[0].accept[0])
    for (const item of items.filter((entry) => entry.solved && entry.problemId === MATH_ID)) {
      expect([item.seed, text.includes(String(item.solution.answer.value))]).toEqual([item.seed, true])
    }

    // The existing review keeps working.
    expect(text).toContain('Legacy reading kept working')
    expect(text).toContain('80%')
  })

  it('serves every practised item for the day, with shown, response and answer', async () => {
    const { student, items } = await practiseOneDay()

    const dayRes = await reviewGET({
      url: `http://localhost/homeworks/api/review?day=${LOCAL_DATE}&studentId=${student.id}`,
    })
    const day = await dayRes.json()

    expect(dayRes.status).toBe(200)
    expect(Array.isArray(day.submissions)).toBe(true)
    expect(Array.isArray(day.readings)).toBe(true)
    expect(day.practice).toHaveLength(items.length)

    for (const item of items) {
      const served = day.practice.find(
        (entry) => entry.problemId === item.problemId && entry.seed === item.seed
      )
      expect([item.seed, Boolean(served)]).toEqual([item.seed, true])
      expect(served.shown.prompt).toBe(item.solution.prompt)
      expect(served.shown.visual).toEqual(item.solution.visual)
      expect(served.answer).toEqual(item.solution.answer)
      expect(served.response).toEqual(item.response)
      expect(served.solved).toBe(item.solved)
    }
  })

  it('groups the day\'s practice under the session\'s local date', async () => {
    const { student, items } = await practiseOneDay()

    const res = await reviewGET({
      url: `http://localhost/homeworks/api/review?tz=${encodeURIComponent(VIEWER_ZONE)}&studentId=${student.id}`,
    })
    const body = await res.json()

    const bucket = body.days.find((entry) => entry.date === LOCAL_DATE)
    expect(bucket).toBeDefined()
    expect(bucket.practice).toHaveLength(items.length)
  })
})
