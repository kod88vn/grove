/**
 * @jest-environment node
 */
/**
 * P1.7 part 9 of 10 — POST /homeworks/api/attempts.
 *
 * HOMEWORK_PLAN.md §6.6, verbatim:
 *   POST /attempts — `{ sessionId, problemId, seed, response, durationMs }` → server
 *   re-renders from seed, checks, increments `session_items.tries`, and on correct/reveal
 *   writes the `attempts` row using the **server's** tries and hints; returns
 *   `{ correct, stars, feedback, explanation?, skillState }`
 * plus the seed-binding invariant: an unbound `(sessionId, problemId, seed)` is 409, and
 * so is a row that is already `done`.
 *
 * The stars ladder is GROUNDED in §5.1:
 *   ⭐⭐⭐ first try, no hint · ⭐⭐ hint or second try · ⭐ solved eventually ·
 *   no stars after "show me how"
 * read here as: 3 when tries === 1 and hints_used === 0; 2 when tries <= 2 and
 * hints_used <= 1; 1 for any other correct answer; 0 when not correct.
 *
 * GROUNDED by probe against packages/curriculum in this worktree:
 *   check(widget, answer, response) -> { correct, reason }
 *   reason is null when right, and otherwise 'wrong', 'invalid' or 'not-simplest'
 *   listProblems() carries { id, skill, subject, grade, title, difficulty, widget, version }
 * The route needs all of that: `attempts` is NOT NULL on subject, grade, skill_id,
 * content_version and difficulty, and CHECKs subject IN ('math','english'), difficulty
 * BETWEEN 1 AND 3 and tries >= 1.
 *
 * ASSUMED, because §6.6 does not say:
 *   - reason 'invalid' is 400 and costs nothing. "banana" typed into a number box is a
 *     malformed request, not a wrong answer, and charging a try for it would spend the
 *     kid's three stars on a typo. 'wrong' and 'not-simplest' are real answers: they are
 *     200, and they cost a try;
 *   - `explanation` is present only when the attempt was correct. §6.6 marks it optional
 *     and P1.7 has no reveal route, so the only moment the working may be shown is once
 *     the kid has solved it. On a wrong answer the key is absent entirely — not null,
 *     not empty;
 *   - `skillState` is null throughout P1.7. §6.4's Phase 1 tables are students,
 *     practice_sessions, session_items and attempts; there is no skill_state table to
 *     report from yet, and P1.7's tracker line does not claim one;
 *   - `durationMs` is optional, and stored as null when absent;
 *   - the attempts row is written for a correct answer only, since P1.7 has no reveal.
 */
import { afterAll, beforeEach, describe, expect, it } from '@jest/globals'

import { getProblem, listProblems, render, toInstance } from '@grove/curriculum'

import {
  finishSession,
  getAttemptsByStudent,
  getAttemptsBySession,
  getSessionItem,
  incrementSessionItemHints,
  initDb,
  insertSession,
  insertSessionItem,
  insertAttempt,
  insertStudent,
} from '../../../lib/db.js'

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

const SESSION = 's-1'
const PROBLEM = 'm5.oa.order-of-operations/precedence'
const FRACTION = 'm5.nf.add-fractions-unlike/coprime-denominators'
const TAP_SELECT = 'e5.l.context-clues/find-the-clue'
const SEED = 4242
const DATE = '2026-09-27'

const rendered = (problemId = PROBLEM, seed = SEED) => render(getProblem(problemId), seed)

const post = (body) =>
  POST({ url: 'http://localhost:3000/homeworks/api/attempts', json: async () => body })

const attempt = (response, overrides = {}) =>
  post({
    sessionId: SESSION,
    problemId: PROBLEM,
    seed: SEED,
    response,
    durationMs: 1200,
    ...overrides,
  })

const right = (overrides) => attempt(rendered().answer, overrides)
const wrong = (overrides) => attempt({ value: -12345 }, overrides)

const bind = (problemId = PROBLEM, seed = SEED) =>
  insertSessionItem({ session_id: SESSION, problem_id: problemId, seed })

beforeEach(() => {
  initDb(':memory:')
  insertStudent({ id: 'kid', display_name: 'Kid', avatar: '🦊', grade: 5, settings: {} })
  insertSession({
    id: SESSION,
    student_id: 'kid',
    kind: 'daily',
    skill_id: null,
    local_date: DATE,
    tz: 'America/New_York',
  })
  bind()
})

afterAll(() => {
  global.Response = originalResponse
})

describe('POST /homeworks/api/attempts — answering', () => {
  it('charges an all-distractor tap selection as a wrong attempt and returns retry feedback', async () => {
    bind(TAP_SELECT, SEED)
    const answer = rendered(TAP_SELECT).answer
    const response = { ids: answer.availableIds.filter((id) => !answer.ids.includes(id)) }
    expect(response.ids.length).toBeGreaterThan(0)
    const res = await attempt(response, { problemId: TAP_SELECT })
    expect(res.status).toBe(200)
    const payload = await res.json()
    expect(payload.correct).toBe(false)
    expect(payload.feedback).toEqual(expect.any(String))
    expect(payload.feedback.length).toBeGreaterThan(0)
    expect(payload.explanation).toBeUndefined()
    expect(getSessionItem(SESSION, TAP_SELECT, SEED).tries).toBe(1)
    expect(getAttemptsBySession(SESSION)).toHaveLength(0)
  })

  it('accepts a right answer and says so', async () => {
    const res = await right()
    expect(res.status).toBe(200)
    const payload = await res.json()
    expect(Object.keys(payload).sort()).toEqual([
      'correct',
      'explanation',
      'feedback',
      'skillState',
      'stars',
    ])
    expect(payload.correct).toBe(true)
    expect(payload.explanation).toBe(rendered().explanation)
    expect(typeof payload.feedback).toBe('string')
    expect(payload.feedback.length).toBeGreaterThan(0)
    // P4.1: a correct answer refreshes the mastery fold, so the client learns
    // the kid's new standing (sprout, box 0 after a first correct answer).
    expect(payload.skillState).toEqual({
      studentId: 'kid',
      skillId: 'm5.oa.order-of-operations',
      stage: 'sprout',
      level: 1,
      box: 0,
      dueDate: null,
      attempts: 1,
      correct: 1,
      updatedAt: expect.any(Number),
    })
  })

  it('accepts a wrong answer without showing the working', async () => {
    const res = await wrong()
    expect(res.status).toBe(200)
    const payload = await res.json()
    expect(Object.keys(payload).sort()).toEqual(['correct', 'feedback', 'skillState', 'stars'])
    expect(payload.correct).toBe(false)
    expect(payload.stars).toBe(0)
    expect(typeof payload.feedback).toBe('string')
    expect(payload.feedback.length).toBeGreaterThan(0)
  })

  it('counts every real answer as a try, right or wrong', async () => {
    await wrong()
    expect(getSessionItem(SESSION, PROBLEM, SEED).tries).toBe(1)
    await wrong()
    expect(getSessionItem(SESSION, PROBLEM, SEED).tries).toBe(2)
    await right()
    expect(getSessionItem(SESSION, PROBLEM, SEED).tries).toBe(3)
  })

  it('marks the item done once it is solved', async () => {
    expect(getSessionItem(SESSION, PROBLEM, SEED).done).toBe(0)
    await right()
    expect(getSessionItem(SESSION, PROBLEM, SEED).done).toBe(1)
  })

  it('re-renders from the seed rather than trusting the client', async () => {
    const other = await attempt(rendered(PROBLEM, 999).answer)
    const payload = await other.json()
    expect([rendered().answer.value === rendered(PROBLEM, 999).answer.value, payload.correct])
      .toEqual([false, false])
  })
})

describe('POST /homeworks/api/attempts — stars, from the server counters', () => {
  it('gives three for a first try with no hint', async () => {
    expect((await (await right()).json()).stars).toBe(3)
  })

  it('gives two after one hint', async () => {
    incrementSessionItemHints(SESSION, PROBLEM, SEED)
    expect((await (await right()).json()).stars).toBe(2)
  })

  it('gives two on the second try', async () => {
    await wrong()
    expect((await (await right()).json()).stars).toBe(2)
  })

  it('gives one on the third try', async () => {
    await wrong()
    await wrong()
    expect((await (await right()).json()).stars).toBe(1)
  })

  it('gives one after both hints', async () => {
    incrementSessionItemHints(SESSION, PROBLEM, SEED)
    incrementSessionItemHints(SESSION, PROBLEM, SEED)
    expect((await (await right()).json()).stars).toBe(1)
  })
})

describe('POST /homeworks/api/attempts — the row it writes', () => {
  it('writes nothing until the answer is right', async () => {
    await wrong()
    await wrong()
    expect(getAttemptsBySession(SESSION)).toHaveLength(0)
    await right()
    expect(getAttemptsBySession(SESSION)).toHaveLength(1)
  })

  it('copies the problem metadata the schema demands', async () => {
    await right()
    const [row] = getAttemptsBySession(SESSION)
    const meta = listProblems().find((problem) => problem.id === PROBLEM)
    expect(row.session_id).toBe(SESSION)
    expect(row.student_id).toBe('kid')
    expect(row.subject).toBe(meta.subject)
    expect(row.grade).toBe(meta.grade)
    expect(row.skill_id).toBe(meta.skill)
    expect(row.problem_id).toBe(PROBLEM)
    expect(row.content_version).toBe(meta.version)
    expect(row.seed).toBe(SEED)
    expect(row.difficulty).toBe(rendered().difficulty)
    expect(row.local_date).toBe(DATE)
    expect(typeof row.id).toBe('string')
    expect(row.id.length).toBeGreaterThan(0)
  })

  it('copies the SERVER\u2019s counters, not the client\u2019s', async () => {
    incrementSessionItemHints(SESSION, PROBLEM, SEED)
    await wrong({ durationMs: 10 })
    await right({ tries: 1, hints_used: 0, stars: 3, correct: true })
    const [row] = getAttemptsBySession(SESSION)
    expect(row.tries).toBe(2)
    expect(row.hints_used).toBe(1)
    expect(row.stars).toBe(2)
    expect(row.correct).toBe(1)
    expect(row.revealed).toBe(0)
  })

  it('keeps what was shown, what was sent and what was right', async () => {
    const response = rendered().answer
    await attempt(response)
    const [row] = getAttemptsBySession(SESSION)
    expect(row.shown).toEqual(JSON.parse(JSON.stringify(toInstance(rendered()))))
    expect(row.response).toEqual(JSON.parse(JSON.stringify(response)))
    expect(row.answer).toEqual(JSON.parse(JSON.stringify(rendered().answer)))
  })

  it('stores durationMs, and null when it was not sent', async () => {
    await right()
    expect(getAttemptsBySession(SESSION)[0].duration_ms).toBe(1200)

    initDb(':memory:')
    insertStudent({ id: 'kid', display_name: 'Kid', avatar: '🦊', grade: 5, settings: {} })
    insertSession({
      id: SESSION,
      student_id: 'kid',
      kind: 'daily',
      skill_id: null,
      local_date: DATE,
      tz: 'America/New_York',
    })
    bind()
    await post({ sessionId: SESSION, problemId: PROBLEM, seed: SEED, response: rendered().answer })
    expect(getAttemptsBySession(SESSION)[0].duration_ms).toBeNull()
  })
})

describe('POST /homeworks/api/attempts — refusals', () => {
  it.each(['daily', 'skill'])('rejects scored answers after a %s session is finished without changing stars or tries', async (kind) => {
    const finishedSessionId = kind === 'daily' ? SESSION : 'finished-skill'
    if (kind === 'skill') {
      insertSession({
        id: finishedSessionId,
        student_id: 'kid',
        kind,
        skill_id: 'm5.oa.order-of-operations',
        local_date: DATE,
        tz: 'America/New_York',
      })
      insertSessionItem({ session_id: finishedSessionId, problem_id: PROBLEM, seed: SEED })
    }
    insertSession({
      id: 'prior-earned-session', student_id: 'kid', kind: 'daily', local_date: DATE, tz: 'UTC',
    })
    insertAttempt({
      id: 'prior-earned-attempt', session_id: 'prior-earned-session', student_id: 'kid', subject: 'math',
      grade: 5, skill_id: 'm5.nbt.long-multiplication', problem_id: 'prior-problem', content_version: 1,
      seed: 1, difficulty: 1, shown: {}, response: {}, answer: {}, correct: true, tries: 1,
      hints_used: 0, revealed: 0, stars: 2, rubric: null, duration_ms: 1, local_date: DATE,
    })
    const starsBefore = getAttemptsByStudent('kid').reduce((total, row) => total + row.stars, 0)
    finishSession(finishedSessionId, { finished: true, stars: 0, grew: [], next: null })

    const response = await attempt(rendered().answer, { sessionId: finishedSessionId })

    expect(response.status).toBe(409)
    expect(getSessionItem(finishedSessionId, PROBLEM, SEED)).toEqual(expect.objectContaining({ tries: 0 }))
    expect(getAttemptsByStudent('kid').reduce((total, row) => total + row.stars, 0)).toBe(starsBefore)
    expect(getAttemptsByStudent('kid')).toHaveLength(1)
  })

  it('refuses a seed that was never bound, and charges nothing', async () => {
    const res = await right({ seed: 777 })
    expect(res.status).toBe(409)
    expect(typeof (await res.json()).error).toBe('string')
    expect(getSessionItem(SESSION, PROBLEM, SEED).tries).toBe(0)
    expect(getAttemptsBySession(SESSION)).toHaveLength(0)
  })

  it.each([
    ['an unbound problem', { problemId: 'm5.nbt.long-multiplication/two-by-one' }],
    ['a problem that does not exist', { problemId: 'm5.oa.order-of-operations/nope' }],
    ['a session that does not exist', { sessionId: 'no-such-session' }],
  ])('refuses %s with 409', async (_label, overrides) => {
    const res = await right(overrides)
    expect(res.status).toBe(409)
    expect(getAttemptsBySession(SESSION)).toHaveLength(0)
  })

  it('refuses a second answer once the item is done', async () => {
    await right()
    const triesAfterSolving = getSessionItem(SESSION, PROBLEM, SEED).tries

    const replay = await right()
    expect(replay.status).toBe(409)
    expect(typeof (await replay.json()).error).toBe('string')
    expect(getAttemptsBySession(SESSION)).toHaveLength(1)
    expect(getSessionItem(SESSION, PROBLEM, SEED).tries).toBe(triesAfterSolving)
  })

  it.each([
    ['a number box with words in it', { value: 'banana' }],
    ['an empty response object', {}],
    ['a null response', null],
  ])('rejects %s with 400 and does not charge a try', async (_label, response) => {
    const res = await attempt(response)
    expect(res.status).toBe(400)
    expect(typeof (await res.json()).error).toBe('string')
    expect(getSessionItem(SESSION, PROBLEM, SEED).tries).toBe(0)
    expect(getAttemptsBySession(SESSION)).toHaveLength(0)
  })

  it('treats an unsimplified fraction as a real wrong answer, not a malformed one', async () => {
    bind(FRACTION, 7)
    const answer = rendered(FRACTION, 7).answer
    const res = await post({
      sessionId: SESSION,
      problemId: FRACTION,
      seed: 7,
      response: { text: `${answer.num * 2}/${answer.den * 2}` },
      durationMs: 900,
    })
    expect(res.status).toBe(200)
    const payload = await res.json()
    expect(payload.correct).toBe(false)
    expect(payload.explanation).toBeUndefined()
    expect(getSessionItem(SESSION, FRACTION, 7).tries).toBe(1)
    expect(getAttemptsBySession(SESSION)).toHaveLength(0)
  })

  it.each([
    ['no sessionId', { sessionId: undefined }],
    ['a non-string sessionId', { sessionId: 5 }],
    ['no problemId', { problemId: undefined }],
    ['a non-string problemId', { problemId: 5 }],
    ['no seed', { seed: undefined }],
    ['a seed sent as text', { seed: '4242' }],
    ['a fractional seed', { seed: 1.5 }],
    ['no response at all', { response: undefined }],
    ['a negative durationMs', { durationMs: -1 }],
    ['a durationMs sent as text', { durationMs: '1200' }],
  ])('rejects %s with 400', async (_label, overrides) => {
    const body = {
      sessionId: SESSION,
      problemId: PROBLEM,
      seed: SEED,
      response: rendered().answer,
      durationMs: 1200,
      ...overrides,
    }
    for (const [key, value] of Object.entries(overrides)) if (value === undefined) delete body[key]
    const res = await post(body)
    expect(res.status).toBe(400)
    expect(typeof (await res.json()).error).toBe('string')
    expect(getAttemptsBySession(SESSION)).toHaveLength(0)
  })

  it.each([
    ['null', null],
    ['an array', []],
    ['a string', 'four'],
  ])('rejects a body that is %s with 400', async (_label, body) => {
    const res = await post(body)
    expect(res.status).toBe(400)
    expect(typeof (await res.json()).error).toBe('string')
  })

  it('answers 400 rather than throwing when the body is not JSON', async () => {
    const res = await POST({
      url: 'http://localhost:3000/homeworks/api/attempts',
      json: async () => {
        throw new SyntaxError('Unexpected end of JSON input')
      },
    })
    expect(res.status).toBe(400)
    expect(typeof (await res.json()).error).toBe('string')
  })
})

describe('POST /homeworks/api/attempts — what a wrong answer may not reveal', () => {
  it('keeps the answer and the working out of the reply', async () => {
    const solution = rendered()
    const payload = await (await wrong()).json()
    const text = JSON.stringify(payload)
    for (const key of ['answer', 'explanation', 'hints', 'steps', 'partials', 'parts', 'lcd']) {
      expect([key, Object.prototype.hasOwnProperty.call(payload, key)]).toEqual([key, false])
    }
    expect(text).not.toContain(solution.explanation)
    expect(text).not.toContain(solution.hints[0])
    expect(text).not.toContain(String(solution.answer.value))
  })
})
