/**
 * @jest-environment node
 */
/**
 * P1.9 review follow-up — PR #85, Copilot thread on `lib/practiceReview.js:51`.
 *
 * The contract being pinned is HOMEWORK_PLAN.md principle 7 (§3, line 64): every attempt
 * stores `problem_id + seed + content_version` **and** "a snapshot of what was shown, so the
 * review page can show exactly what the kid saw", plus §6.4's column comment,
 * `shown_json TEXT NOT NULL, -- snapshot of prompt/visual`. The visual is named as part of
 * the snapshot, so for a **solved** item the snapshot is the whole answer and the curriculum
 * must not be consulted at all.
 *
 * That snapshot is already complete when it is written: `app/api/attempts/route.js` stores
 * `shown: toInstance(rendered)`, and `toInstance` returns `visual` among its fields
 * (`packages/curriculum/src/index.js`). `lib/db.js` round-trips the column whole via
 * `JSON.parse(row.shown_json)`. Nothing is missing for a re-render to supply.
 *
 * Two consequences are asserted here, both observed against the code as written:
 *
 *   1. Re-rendering the visual **replaces** the stored one, so the payload becomes a mix of
 *      the snapshot's prompt and the current curriculum's visual — neither what the kid saw
 *      nor a clean re-render.
 *   2. `getProblem` returns `null` for a template that has since been retired, and
 *      `render(null, …)` throws `TypeError: unknown template`. `app/api/review/route.js`
 *      wraps the whole handler in one try/catch, so a single retired template turns the
 *      parent's entire review page into a 502 — even though every attempt row holds a
 *      complete snapshot that needs no curriculum lookup.
 *
 * An **unsolved** item is different and is guarded below: it has no `attempts` row at all
 * (§6.6 writes that row only on correct/reveal), so re-rendering `(problem_id, seed)` is the
 * only way to show it and must stay.
 *
 * Isolation: jest.setup.js pins HOMEWORKS_DB_PATH=':memory:'; each test starts from a fresh
 * in-memory database. Nothing is written under apps/homeworks/data/.
 */
import { beforeEach, describe, expect, it } from '@jest/globals'

import { getProblem, render, toInstance } from '@grove/curriculum'

import {
  insertAttempt,
  insertSession,
  insertSessionItem,
  insertStudent,
  resetDatabase,
} from './db.js'
import { getAllPractice, getPracticeForDay } from './practiceReview.js'

const PROBLEM = 'm5.nbt.long-multiplication/two-by-one'
const SKILL = 'm5.nbt.long-multiplication'
// A template that was in the catalog when the kid solved it and has since been removed.
const RETIRED = 'm5.nbt.retired-template/two-by-one'
const SEED = 7
const STUDENT = 'kid'
const SESSION = 'session-1'
const TODAY = new Date().toISOString().slice(0, 10)

const startSession = () => {
  insertStudent({ id: STUDENT, display_name: 'Kid', avatar: 'fox', grade: 5, settings: {} })
  insertSession({
    id: SESSION,
    student_id: STUDENT,
    kind: 'skill',
    skill_id: SKILL,
    local_date: TODAY,
    tz: 'UTC',
  })
}

const storeAttempt = ({ id, problemId, shown, answer }) =>
  insertAttempt({
    id,
    session_id: SESSION,
    student_id: STUDENT,
    subject: 'math',
    grade: 5,
    skill_id: SKILL,
    content_version: 1,
    problem_id: problemId,
    seed: SEED,
    difficulty: 1,
    shown,
    response: answer,
    answer,
    correct: 1,
    tries: 1,
    hints_used: 0,
    revealed: 0,
    stars: 3,
    rubric: null,
    duration_ms: 1000,
    local_date: TODAY,
  })

describe('practice review serves the stored snapshot for solved items', () => {
  beforeEach(() => {
    resetDatabase(':memory:')
    startSession()
  })

  it('returns attempt.shown verbatim when the curriculum has drifted since the attempt', () => {
    const fresh = render(getProblem(PROBLEM), SEED)
    // What the kid actually saw. The prompt and the visual both differ from what the
    // curriculum renders today, which is exactly the situation shown_json exists for.
    const snapshot = {
      ...toInstance(fresh),
      prompt: 'PROMPT AS IT WAS SHOWN',
      visual: { kind: 'column', a: 111, b: 9 },
    }
    expect(snapshot.visual).not.toEqual(fresh.visual)

    insertSessionItem({ session_id: SESSION, problem_id: PROBLEM, seed: SEED })
    storeAttempt({ id: 'a1', problemId: PROBLEM, shown: snapshot, answer: fresh.answer })

    const [item] = getPracticeForDay(TODAY, STUDENT)

    expect(item.solved).toBe(true)
    // The whole object, so a re-rendered field cannot slip back in unnoticed.
    expect(item.shown).toEqual(snapshot)
    expect(item.shown.visual).toEqual(snapshot.visual)
  })

  it('still shows a solved item whose template has been retired, instead of failing the request', () => {
    // Precondition: this is what makes the review page 502 today.
    expect(getProblem(RETIRED)).toBeNull()

    const snapshot = {
      problemId: RETIRED,
      skill: SKILL,
      widget: 'numeric',
      difficulty: 1,
      version: 1,
      seed: SEED,
      prompt: 'What is 111 x 9?',
      visual: { kind: 'column', a: 111, b: 9 },
    }
    insertSessionItem({ session_id: SESSION, problem_id: RETIRED, seed: SEED })
    storeAttempt({ id: 'a2', problemId: RETIRED, shown: snapshot, answer: 999 })

    expect(() => getPracticeForDay(TODAY, STUDENT)).not.toThrow()

    const [item] = getPracticeForDay(TODAY, STUDENT)
    expect(item.problemId).toBe(RETIRED)
    expect(item.solved).toBe(true)
    expect(item.shown).toEqual(snapshot)
    expect(item.answer).toBe(999)
  })

  it('does not let one retired template hide the rest of the day', () => {
    const fresh = render(getProblem(PROBLEM), SEED)
    insertSessionItem({ session_id: SESSION, problem_id: RETIRED, seed: SEED })
    storeAttempt({
      id: 'a3',
      problemId: RETIRED,
      shown: { problemId: RETIRED, prompt: 'retired', visual: null, seed: SEED },
      answer: 1,
    })
    insertSessionItem({ session_id: SESSION, problem_id: PROBLEM, seed: SEED })
    storeAttempt({ id: 'a4', problemId: PROBLEM, shown: toInstance(fresh), answer: fresh.answer })

    const items = getPracticeForDay(TODAY, STUDENT)

    expect(items.map((item) => item.problemId).sort()).toEqual([PROBLEM, RETIRED].sort())
  })

  it('serves the stored snapshot through the grouped view as well', () => {
    const fresh = render(getProblem(PROBLEM), SEED)
    const snapshot = { ...toInstance(fresh), visual: { kind: 'column', a: 222, b: 8 } }
    insertSessionItem({ session_id: SESSION, problem_id: PROBLEM, seed: SEED })
    storeAttempt({ id: 'a5', problemId: PROBLEM, shown: snapshot, answer: fresh.answer })

    const [day] = getAllPractice(STUDENT)

    expect(day.date).toBe(TODAY)
    expect(day.practice[0].shown).toEqual(snapshot)
  })

  it('still renders an unsolved item from the curriculum, which has no snapshot to serve', () => {
    const fresh = render(getProblem(PROBLEM), SEED)
    insertSessionItem({ session_id: SESSION, problem_id: PROBLEM, seed: SEED })

    const [item] = getPracticeForDay(TODAY, STUDENT)

    expect(item.solved).toBe(false)
    expect(item.shown.prompt).toBe(fresh.prompt)
    expect(item.shown.visual).toEqual(fresh.visual)
    expect(item.answer).toEqual(fresh.answer)
  })
})
