/**
 * F6: a math submission on /review shows only its score.
 *
 * The math flow and the review page disagree about the stored shape:
 * - MathExercise posts type 'mixed' (the only math type Nora's grader has a schema
 *   for), but the page renders math details only for type 'problem-set', so a math
 *   row falls through to the reading renderer and shows nothing.
 * - Problems carry `problem` and `expectedAnswer`; the page reads prompt/text/answer.
 * - Answers are stored as { problems: [{ id, answer, work }] }; the page reads answers[idx].
 * - Nora's math grade returns `comment`; only `overallFeedback` is kept as feedback.
 *
 * The row is produced by the real grade route + real SQLite and read back through
 * the real review route. Only the AI grader is faked.
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

const originalResponse = global.Response
global.Response = TestResponse

jest.mock('../../lib/aiClient', () => ({
  gradeSubmission: jest.fn(),
}))

const { gradeSubmission } = jest.requireMock('../../lib/aiClient')
const { initDb, insertSubmission } = require('../../lib/db.js')
const { POST: gradePOST } = require('../api/grade/route')
const { GET: reviewGET } = require('../api/review/route')
const ReviewPage = require('./page').default

// Shape taken from Nora's math exercise prompt (apps/nora/app/api/nora-homework/exercise/route.js).
const EXERCISE = {
  problems: [
    { id: 1, problem: '24 × 38 = ?', problemType: 'column-method', operands: ['24', '38'], operator: '*', expectedAnswer: '912' },
    { id: 2, problem: 'Maya has 24 bags of cookies with 6 cookies each. How many cookies does she have in total?', problemType: 'standard', expectedAnswer: '144' },
  ],
}

// Shape MathExercise.handleSubmit posts.
const ANSWERS = {
  problems: [
    { id: 1, answer: '900', work: '{"digits":{},"carries":{}}' },
    { id: 2, answer: '144', work: '24 x 6 = 144' },
  ],
}

// Shape of Nora's MATH_MIXED_GRADE_SCHEMA (apps/nora/app/api/nora-homework/grade/route.js).
const GRADE = {
  problems: [
    { id: 1, answer: '900', correct: false, workShown: true, feedback: 'Recheck the tens row.' },
    { id: 2, answer: '144', correct: true, workShown: true, feedback: 'Correct.' },
  ],
  totalCorrect: 1,
  totalProblems: 2,
  score: 50,
  comment: 'Check your carrying in problem 1.',
}

async function reviewPayload() {
  // getAll() excludes rows created in the current second; read one second later.
  const realNow = Date.now()
  const spy = jest.spyOn(Date, 'now').mockReturnValue(realNow + 2000)
  const res = await reviewGET({ url: 'http://localhost/homeworks/api/review?tz=UTC' })
  spy.mockRestore()
  expect(res.status).toBe(200)
  return res.json()
}

async function renderReview() {
  const payload = await reviewPayload()
  global.fetch = jest.fn(async () => ({ ok: true, status: 200, json: async () => payload }))
  render(<ReviewPage />)
  const header = await screen.findByText(/1 submission/)
  fireEvent.click(header.closest('button'))
  fireEvent.click(screen.getByText(/Show exercise & answers/))
}

describe('ReviewPage shows what a math submission contained (F6)', () => {
  beforeEach(() => {
    initDb(':memory:')
  })

  afterEach(() => {
    jest.restoreAllMocks()
    delete global.fetch
  })

  afterAll(() => {
    global.Response = originalResponse
    initDb(':memory:')
  })

  it('renders the problems, correct answers, student answers, results and feedback of a graded math set', async () => {
    gradeSubmission.mockResolvedValue(GRADE)
    const gradeRes = await gradePOST({
      json: async () => ({ subject: 'math', type: 'mixed', exercise: EXERCISE, answers: ANSWERS }),
    })
    expect(gradeRes.status).toBe(200)

    await renderReview()

    expect(screen.getAllByText(/24 × 38 = \?/).length).toBeGreaterThan(0)
    expect(screen.getAllByText(/Maya has 24 bags of cookies/).length).toBeGreaterThan(0)
    expect(screen.getByText(/Correct answer:\s*912/)).toBeInTheDocument()
    expect(screen.getByText(/Correct answer:\s*144/)).toBeInTheDocument()
    expect(screen.getByText(/Student answer:\s*900/)).toBeInTheDocument()
    expect(screen.getByText(/Student answer:\s*144/)).toBeInTheDocument()
    expect(screen.getByText(/❌\s*Problem 1/)).toBeInTheDocument()
    expect(screen.getByText(/✅\s*Problem 2/)).toBeInTheDocument()
    expect(screen.getByText('Check your carrying in problem 1.')).toBeInTheDocument()
    expect(screen.queryByText(/"problemType"/)).not.toBeInTheDocument()
  })

  it('shows the grader comment for a math row saved before the fix (empty feedback column)', async () => {
    insertSubmission({
      id: 'math-legacy',
      student_id: 'public',
      subject: 'math',
      type: 'mixed',
      exercise: EXERCISE,
      answers: ANSWERS,
      score: 1,
      max_score: 2,
      percentage: 50,
      feedback: '',
      details: { ...GRADE, studentAnswers: ANSWERS },
    })

    await renderReview()

    expect(screen.getByText('Check your carrying in problem 1.')).toBeInTheDocument()
    expect(screen.getByText(/Student answer:\s*900/)).toBeInTheDocument()
  })
})
