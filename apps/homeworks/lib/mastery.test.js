/**
 * @jest-environment node
 *
 * U05 M-MASTERY acceptance (HOMEWORK_PLAN.md Phase 4): a scripted attempt
 * stream drives one skill through seed → sprout → sapling → tree → fruiting
 * and back down on a missed review, plus replay/idempotence, local-date
 * boundaries, due-review priority, locked prerequisites, and whole paths.
 *
 * `attempts` is the source of truth (plan §6.4): one row per solved instance
 * — `correct` is always 1, `revealed` marks a give-up, `tries` is the server
 * count, and the join to `practice_sessions.kind` marks spaced reviews.
 */
import { beforeEach, describe, expect, it } from '@jest/globals'

import { getSkill, listProblems } from '@grove/curriculum'

import { getDatabase, initDb, insertAttempt, insertSession, insertStudent } from './db.js'
import {
  addDays,
  computeSkillState,
  dueReviews,
  getSkillStates,
  nextForStudent,
  pickProblem,
  rebuildSkillState,
  refreshSkillState,
} from './mastery.js'

const SKILL = 'm5.oa.order-of-operations'
const PROBLEM = 'm5.oa.order-of-operations/precedence'
const D1 = '2026-09-27'
const D2 = '2026-09-28'
const D3 = '2026-09-29'
const D4 = '2026-10-02'

let sequence = 0
let sessionSequence = 0

function reviewSession(studentId, skillId, date) {
  sessionSequence += 1
  const id = `session-review-${sessionSequence}`
  insertSession({ id, student_id: studentId, kind: 'review', skill_id: skillId, local_date: date, tz: 'UTC' })
  return id
}

function attempt(studentId, { skillId = SKILL, problemId = PROBLEM, tries = 1, revealed = 0, date = D1, review = null } = {}) {
  sequence += 1
  const session = review ? reviewSession(studentId, skillId, date) : null
  insertAttempt({
    id: `attempt-${sequence}`, session_id: session, student_id: studentId, subject: 'math', grade: 5,
    skill_id: skillId, problem_id: problemId, content_version: 1, seed: sequence, difficulty: 1,
    shown: { prompt: 'sample' }, response: { value: 1 }, answer: { value: 1 }, correct: true,
    tries, hints_used: 0, revealed, stars: revealed ? 0 : 3, rubric: null, duration_ms: 1, local_date: date,
  })
}

function stateFor(studentId, skillId = SKILL) {
  return refreshSkillState(studentId, skillId)
}

function setState(studentId, skillId, { stage = 'tree', level = 3, box = 1, dueDate = null, attempts = 10, correct = 8 } = {}) {
  getDatabase().prepare(`
    INSERT INTO skill_state (student_id, skill_id, stage, level, box, due_date, attempts, correct, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, 100)
    ON CONFLICT (student_id, skill_id) DO UPDATE SET
      stage = excluded.stage, level = excluded.level, box = excluded.box,
      due_date = excluded.due_date, attempts = excluded.attempts, correct = excluded.correct
  `).run(studentId, skillId, stage, level, box, dueDate, attempts, correct)
}

function makeEvent(index, over = {}) {
  return { correct: true, revealed: false, tries: 1, localDate: D1, createdAt: index, review: false, ...over }
}

beforeEach(() => {
  sequence = 0
  sessionSequence = 0
  initDb(':memory:')
  insertStudent({ id: 'kid', display_name: 'Mina', avatar: '🦊', grade: 5, settings: {} })
  insertStudent({ id: 'kid-b', display_name: 'Theo', avatar: '🐻', grade: 5, settings: {} })
})

describe('addDays (plan: local date boundaries)', () => {
  it('walks calendar days across month and year boundaries', () => {
    expect(addDays('2026-09-30', 1)).toBe('2026-10-01')
    expect(addDays('2026-12-31', 1)).toBe('2027-01-01')
    expect(addDays('2026-09-30', -1)).toBe('2026-09-29')
    expect(addDays('2026-09-30', 0)).toBe('2026-09-30')
  })

  it('respects leap years', () => {
    expect(addDays('2024-02-28', 1)).toBe('2024-02-29')
    expect(addDays('2026-02-28', 1)).toBe('2026-03-01')
  })

  it('rejects malformed dates', () => {
    expect(() => addDays('2026-9-7', 1)).toThrow()
    expect(() => addDays('nope', 1)).toThrow()
    expect(() => addDays(null, 1)).toThrow()
  })
})

describe('computeSkillState (the replayable fold)', () => {
  it('keeps a never-tried skill at seed', () => {
    expect(computeSkillState([])).toEqual({
      stage: 'seed', level: 1, box: 0, dueDate: null, attempts: 0, correct: 0, updatedAt: null,
    })
  })

  it('climbs the ladder on 3 correct in a row and falls on 2 wrong (plan §6.5)', () => {
    const events = Array.from({ length: 6 }, (_, i) => makeEvent(i))
    expect(computeSkillState(events).level).toBe(3) // two 3-streaks: 1 → 2 → 3
    expect(computeSkillState([...events, makeEvent(6, { revealed: true, tries: 2 })]).level).toBe(2)
    const doubleGiveUp = [...events, makeEvent(6, { revealed: true, tries: 2 }), makeEvent(7, { revealed: true, tries: 2 })]
    expect(computeSkillState(doubleGiveUp).level).toBe(1) // floor, no level 0
  })

  it('reaches sapling at 60% of a full window but never tree without level-3 rows', () => {
    // Give-ups break the 3-correct streak, so the ladder never leaves level 1:
    // the window is 60% correct (sapling) but has zero level-3 rows, so it can
    // never satisfy the tree rule — no box, no due date.
    const events = Array.from({ length: 10 }, (_, i) =>
      makeEvent(i, { localDate: i < 5 ? D1 : D2, revealed: i === 2 || i === 5 || i === 8 || i === 9 }),
    )
    const state = computeSkillState(events)
    expect(state.stage).toBe('sapling')
    expect(state.level).toBe(1)
    expect(state.box).toBe(0)
    expect(state.dueDate).toBeNull()
  })

  it('applies the 60% boundary exactly: 6 of 10 is sapling, 5 of 10 is not', () => {
    const sixWins = Array.from({ length: 10 }, (_, i) => makeEvent(i, { revealed: i >= 6 }))
    expect(computeSkillState(sixWins).stage).toBe('sapling')
    const fiveWins = Array.from({ length: 10 }, (_, i) => makeEvent(i, { revealed: i >= 5 }))
    expect(computeSkillState(fiveWins).stage).toBe('sprout')
  })

  it('reaches tree at 80% across two days with level-3 work, entering box 1 (plan §6.5)', () => {
    // Six clean solves take the ladder to level 3, then ten window rows on two
    // days: eight clean at level 3, two give-ups.
    const events = [
      ...Array.from({ length: 6 }, (_, i) => makeEvent(i)),
      ...Array.from({ length: 10 }, (_, i) => makeEvent(6 + i, {
        localDate: i < 4 ? D1 : D2,
        revealed: i >= 8,
        tries: i >= 8 ? 2 : 1,
      })),
    ]
    const state = computeSkillState(events)
    expect(state.stage).toBe('tree')
    expect(state.level).toBe(1) // the back-to-back give-ups cost two levels
    expect(state.box).toBe(1)
    expect(state.dueDate).toBe(addDays(D2, 1)) // entered tree on D2
    expect(state.attempts).toBe(16)
    expect(state.correct).toBe(14) // give-ups never count as correct
  })

  it('enters the Leitner system on the day after reaching tree, across a month boundary', () => {
    // Six clean solves reach level 3; three give-ups on 09-29 keep the window
    // below 80% through 09-29. The ladder climbs back to level 3 on 09-30 and
    // needs one final solve to put three level-3 rows in an 80%+ window, so
    // the tree entry lands on 09-30 and the +1 due date crosses the month:
    // 2026-10-01.
    const events = [
      ...Array.from({ length: 6 }, (_, i) => makeEvent(i, { localDate: '2026-09-28' })),
      ...Array.from({ length: 3 }, (_, i) => makeEvent(6 + i, { localDate: '2026-09-29', revealed: true, tries: 2 })),
      ...Array.from({ length: 9 }, (_, i) => makeEvent(9 + i, { localDate: i < 5 ? '2026-09-29' : '2026-09-30' })),
    ]
    const state = computeSkillState(events)
    expect(state.stage).toBe('tree')
    expect(state.dueDate).toBe('2026-10-01')
  })

  it('a missed review drops a box and the stage back down from fruiting', () => {
    const events = [
      ...Array.from({ length: 16 }, (_, i) => makeEvent(i, { localDate: i < 10 ? D1 : D2, revealed: i === 14, tries: i === 14 ? 2 : 1 })),
      makeEvent(16, { review: true, localDate: D3 }), // pass → fruiting, box 2
      makeEvent(17, { review: true, revealed: true, tries: 2, localDate: D4 }), // miss
    ]
    const state = computeSkillState(events)
    expect(state.stage).toBe('tree')
    expect(state.box).toBe(1)
    expect(state.dueDate).toBe(addDays(D4, 1))
  })
})

describe('skill_state round-trip (derived data, plan §6.4)', () => {
  it('refreshSkillState persists the fold and is idempotent', () => {
    attempt('kid', { date: D1 })
    const first = stateFor('kid')
    expect(first).toMatchObject({ skillId: SKILL, stage: 'sprout', level: 1, box: 0, attempts: 1, correct: 1 })
    const second = stateFor('kid')
    expect(second).toEqual(first) // replay: same stream, same state
    expect(getSkillStates('kid')).toHaveLength(1)
  })

  it('rebuildSkillState recreates deleted rows byte-for-byte', () => {
    attempt('kid', { date: D1, tries: 2 })
    attempt('kid', { date: D2 })
    const before = stateFor('kid')
    getDatabase().prepare('DELETE FROM skill_state WHERE student_id = ?').run('kid')
    rebuildSkillState('kid')
    expect(stateFor('kid')).toEqual(before)
    // A second rebuild changes nothing: the rule is a pure function of attempts.
    const once = getSkillStates('kid')
    rebuildSkillState('kid')
    expect(getSkillStates('kid')).toEqual(once)
  })

  it('rebuildSkillState drops rows for skills whose attempts are gone', () => {
    attempt('kid', {})
    attempt('kid', { skillId: 'm5.nbt.place-value', problemId: 'm5.nbt.place-value/digits' })
    getDatabase().prepare("DELETE FROM attempts WHERE problem_id = 'm5.nbt.place-value/digits'").run()
    rebuildSkillState('kid')
    expect(getSkillStates('kid').map((state) => state.skillId)).toEqual([SKILL])
  })

  it('dueReviews surfaces only reviews whose local date has arrived, earliest first', () => {
    setState('kid', 'm5.oa.order-of-operations', { stage: 'tree', level: 3, box: 1, dueDate: '2026-10-02' })
    setState('kid', 'm5.nf.equiv-fractions', { stage: 'tree', level: 3, box: 2, dueDate: '2026-10-01' })
    setState('kid', 'm5.nbt.place-value', { stage: 'tree', level: 3, box: 1, dueDate: '2026-10-05' }) // still in the future
    const due = dueReviews('kid', '2026-10-02').map((state) => state.skillId)
    expect(due).toEqual(['m5.nf.equiv-fractions', 'm5.oa.order-of-operations'])
  })
})

describe('the scripted story (plan Phase 4 acceptance: seed → fruiting, back down on a miss)', () => {
  it('drives one skill through every stage, then through the Leitner boxes', () => {
    // Ten solves on day one: sprout until the tenth, then sapling (one day only).
    for (let i = 0; i < 10; i += 1) {
      attempt('kid', { date: D1 })
      const state = stateFor('kid')
      if (i < 9) expect(state.stage).toBe('sprout')
    }
    expect(stateFor('kid')).toMatchObject({ stage: 'sapling', level: 3, box: 0 })

    // The eleventh solve lands on day two: two days, level-3 work, clean window.
    attempt('kid', { date: D2 })
    expect(stateFor('kid')).toMatchObject({ stage: 'tree', level: 3, box: 1, dueDate: addDays(D2, 1) })

    // A give-up and a clean solve keep the window above 80%.
    attempt('kid', { date: D2, revealed: 1, tries: 2 })
    expect(stateFor('kid')).toMatchObject({ stage: 'tree', level: 2, box: 1, dueDate: addDays(D2, 1) })
    attempt('kid', { date: D2 })
    expect(stateFor('kid')).toMatchObject({ stage: 'tree', level: 2, box: 1, dueDate: addDays(D2, 1) })

    // The spaced review comes due, is passed: fruiting, box 2, due +3.
    attempt('kid', { date: D3, review: {} })
    expect(stateFor('kid')).toMatchObject({ stage: 'fruiting', level: 2, box: 2, dueDate: addDays(D3, 3) })
    expect(dueReviews('kid', D3)).toHaveLength(0) // +3 has not arrived yet
    expect(dueReviews('kid', addDays(D3, 3)).map((state) => state.skillId)).toEqual([SKILL])

    // The next review is missed: back to tree, box 1, due +1.
    attempt('kid', { date: addDays(D3, 3), review: {}, revealed: 1, tries: 2 })
    expect(stateFor('kid')).toMatchObject({ stage: 'tree', level: 1, box: 1, dueDate: addDays(addDays(D3, 3), 1) })

    // Four more passes graduate the skill: box 5, no further reviews.
    let reviewDate = addDays(addDays(D3, 3), 1)
    for (let box = 1; box < 5; box += 1) {
      attempt('kid', { date: reviewDate, review: {} })
      const state = stateFor('kid')
      expect(state.box).toBe(box + 1)
      expect(state.stage).toBe('fruiting')
      if (box + 1 < 5) {
        expect(state.dueDate).toBe(addDays(reviewDate, [null, 1, 3, 7, 14, 30][box + 1]))
        reviewDate = state.dueDate
      } else {
        expect(state.dueDate).toBeNull() // graduated
      }
    }
    expect(dueReviews('kid', addDays(reviewDate, 400))).toHaveLength(0)
  })
})
