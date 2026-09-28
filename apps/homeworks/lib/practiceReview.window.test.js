/**
 * @jest-environment node
 */
/**
 * P1.9 review follow-up — PR #85, Copilot thread on `lib/practiceReview.js:79`.
 *
 * The default review endpoint is documented as a last-30-days view in three places:
 * HOMEWORK_PLAN.md §2 ("Review page | app/review/page.js | Last 30 days, grouped by day"),
 * grove AGENTS.md ("The review page at /homeworks/review shows all submissions from the last
 * 30 days"), and the comment on the default branch of app/api/review/route.js itself.
 *
 * The filter implementing it compares `session.local_date` — a string the **client** supplies
 * — against a cutoff date. `app/api/sessions/route.js` validates only that `localDate` is a
 * well-formed, calendar-valid `YYYY-MM-DD`; it never checks that the date is not in the
 * future. So the column the window trusts is entirely under the caller's control, and two
 * things follow, both observed against the code as written:
 *
 *   - a session labelled with a future date stays in the "last 30 days" for as long as that
 *     label is in the future, which is to say indefinitely;
 *   - a session that genuinely started moments ago but carries an old label is dropped from
 *     the view it belongs in.
 *
 * `practice_sessions.started_at` (lib/db.js) defaults to `unixepoch()` — written by SQLite,
 * never by the caller — and is the only column here that records when the session actually
 * happened. The window belongs on it.
 *
 * Only the lower edge is asserted. `started_at` is not reachable from any caller —
 * `insertSession()` does not accept it and no route passes it — so a session from the future
 * is not a state this system can be in, and bounding the top would only tie the review window
 * to `Date.now()`, which several existing tests legitimately mock while SQLite keeps writing
 * `unixepoch()` from the real clock.
 *
 * The explicit `?day=` path is deliberately NOT bounded and is guarded below: there the
 * viewer is naming a calendar day, which is exactly what `local_date` means.
 *
 * Determinism: every offset below is at least fifteen days clear of the thirty-day edge, so
 * no assertion can flip on a slow run or a date boundary, and no clock injection is needed.
 * Isolation: jest.setup.js pins HOMEWORKS_DB_PATH=':memory:'; nothing is written under
 * apps/homeworks/data/.
 */
import { beforeEach, describe, expect, it } from '@jest/globals'

import {
  getDatabase,
  insertSession,
  insertSessionItem,
  insertStudent,
  resetDatabase,
} from './db.js'
import { getAllPractice, getPracticeForDay } from './practiceReview.js'

const PROBLEM = 'm5.nbt.long-multiplication/two-by-one'
const SKILL = 'm5.nbt.long-multiplication'
const STUDENT = 'kid'

const DAY_MS = 86400 * 1000
const NOW = Date.now()
const dateOf = (ms) => new Date(ms).toISOString().slice(0, 10)
const secondsOf = (ms) => Math.floor(ms / 1000)

const TODAY = dateOf(NOW)
const FORTY_FIVE_DAYS_AGO = dateOf(NOW - 45 * DAY_MS)
const FAR_FUTURE = dateOf(NOW + 400 * DAY_MS)

let seed = 0

// `local_date` is whatever the client sent; `startedAtMs` is what SQLite recorded.
const addSession = (id, localDate, startedAtMs) => {
  insertSession({
    id,
    student_id: STUDENT,
    kind: 'skill',
    skill_id: SKILL,
    local_date: localDate,
    tz: 'UTC',
  })
  getDatabase()
    .prepare('UPDATE practice_sessions SET started_at = ? WHERE id = ?')
    .run(secondsOf(startedAtMs), id)
  seed += 1
  insertSessionItem({ session_id: id, problem_id: PROBLEM, seed })
}

const defaultViewDates = () => getAllPractice(STUDENT).map((entry) => entry.date)

describe('the default practice review is a last-30-days window on the server clock', () => {
  beforeEach(() => {
    seed = 0
    resetDatabase(':memory:')
    insertStudent({ id: STUDENT, display_name: 'Kid', avatar: 'fox', grade: 5, settings: {} })
  })

  it('drops a session labelled with a future date once it is really 30 days old', () => {
    addSession('future-label', FAR_FUTURE, NOW - 45 * DAY_MS)

    expect(defaultViewDates()).not.toContain(FAR_FUTURE)
    expect(defaultViewDates()).toHaveLength(0)
  })

  it('keeps a session that genuinely started moments ago, whatever date the client sent', () => {
    addSession('stale-label', '2020-01-01', NOW - 10 * 1000)

    expect(defaultViewDates()).toContain('2020-01-01')
  })

  it('keeps a session whose client label is in the future but which started just now', () => {
    addSession('future-but-fresh', FAR_FUTURE, NOW - 10 * 1000)

    expect(defaultViewDates()).toContain(FAR_FUTURE)
  })

  it('still shows a session from today', () => {
    addSession('today', TODAY, NOW - 60 * 1000)

    expect(defaultViewDates()).toEqual([TODAY])
  })

  it('still drops a session that really is 45 days old', () => {
    addSession('genuinely-old', FORTY_FIVE_DAYS_AGO, NOW - 45 * DAY_MS)

    expect(defaultViewDates()).toHaveLength(0)
  })

  it('shows each session under the calendar day the client recorded', () => {
    addSession('today', TODAY, NOW - 60 * 1000)
    addSession('stale-label', '2020-01-01', NOW - 10 * 1000)

    expect(defaultViewDates().sort()).toEqual([TODAY, '2020-01-01'].sort())
  })

  it('does not bound the explicit day view, which asks for one calendar day by name', () => {
    addSession('old-by-request', FORTY_FIVE_DAYS_AGO, NOW - 45 * DAY_MS)

    expect(getPracticeForDay(FORTY_FIVE_DAYS_AGO, STUDENT)).toHaveLength(1)
  })
})
