/**
 * @jest-environment node
 */
/**
 * P1.6, second half — `session_items`, the table the first spec wrongly left out.
 *
 * HOMEWORK_PLAN.md §6.4 defines four tables for Phase 1, and §10 line 671 lists all four by
 * name: students, practice_sessions, session_items, attempts. HOMEWORK_PROGRESS.md's P1.6
 * box names the same four. The first version of that spec asserted a three-table result, so
 * the loop that satisfied it could not have built this one.
 *
 * It is the load-bearing one. Plan §6.6 has the server pick the seed and create the row
 * (POST /sessions/:id/items), /hints increment hints_used on it, /attempts increment tries
 * on it, and both endpoints reject a (sessionId, problemId, seed) triple that has no row —
 * which is the whole reason stars and mastery cannot be inflated from the browser. Without
 * this table P1.7 has nothing to bind a seed to.
 *
 * Also pinned here: the seed row's display_name. §6.4 writes 'Explorer' verbatim.
 */
import { afterAll, beforeAll, beforeEach, describe, expect, it } from '@jest/globals'

import {
  _getDatabase,
  closeDb,
  getSessionItem,
  incrementSessionItemHints,
  incrementSessionItemTries,
  initDb,
  insertSession,
  insertSessionItem,
  markSessionItemDone,
  markSessionItemRevealed,
  resetDatabase,
} from './db.js'

const columns = (conn, table) =>
  conn.prepare(`PRAGMA table_info(${table})`).all().map(c => `${c.name}:${c.type}:${c.notnull}`)

const session = (id = 'sess-1') => ({
  id,
  student_id: 'public',
  kind: 'daily',
  local_date: '2026-09-27',
  tz: 'America/New_York',
})

describe('session_items — the shape plan §6.4 specifies', () => {
  let conn

  beforeAll(() => {
    initDb(':memory:')
    conn = _getDatabase()
  })

  afterAll(() => {
    closeDb()
  })

  it('has exactly the columns of plan §6.4, in order', () => {
    expect(columns(conn, 'session_items')).toEqual([
      'session_id:TEXT:1',
      'problem_id:TEXT:1',
      'seed:INTEGER:1',
      'tries:INTEGER:1',
      'hints_used:INTEGER:1',
      'revealed:INTEGER:1',
      'done:INTEGER:1',
    ])
  })

  it('is keyed on (session_id, problem_id, seed), which is what binds a seed to a session', () => {
    const pk = conn
      .prepare(`PRAGMA table_info(session_items)`)
      .all()
      .filter(c => c.pk > 0)
      .sort((a, b) => a.pk - b.pk)
      .map(c => c.name)
    expect(pk).toEqual(['session_id', 'problem_id', 'seed'])
  })

  it('counts from zero, so a fresh item has no tries, hints, reveal or completion', () => {
    const defaults = Object.fromEntries(
      conn.prepare(`PRAGMA table_info(session_items)`).all().map(c => [c.name, c.dflt_value]),
    )
    expect(defaults.tries).toBe('0')
    expect(defaults.hints_used).toBe('0')
    expect(defaults.revealed).toBe('0')
    expect(defaults.done).toBe('0')
  })

  it('references practice_sessions', () => {
    const fks = conn.prepare(`PRAGMA foreign_key_list(session_items)`).all()
    expect(fks.map(f => `${f.from}->${f.table}.${f.to}`)).toEqual(['session_id->practice_sessions.id'])
  })
})

describe('session_items — the constraints reject bad rows', () => {
  let conn

  beforeEach(() => {
    resetDatabase(':memory:')
    conn = _getDatabase()
    insertSession(session())
  })

  afterAll(() => {
    closeDb()
  })

  it('refuses an item whose session does not exist', () => {
    expect(() =>
      insertSessionItem({ session_id: 'ghost', problem_id: 'p1', seed: 1 }),
    ).toThrow(/FOREIGN KEY/i)
  })

  it('refuses a done value that is not 0 or 1', () => {
    insertSessionItem({ session_id: 'sess-1', problem_id: 'p1', seed: 1 })
    expect(() =>
      conn.prepare(`UPDATE session_items SET done = 2 WHERE problem_id = 'p1'`).run(),
    ).toThrow(/CHECK/i)
  })

  it('refuses the same (session, problem, seed) twice', () => {
    insertSessionItem({ session_id: 'sess-1', problem_id: 'p1', seed: 7 })
    expect(() =>
      insertSessionItem({ session_id: 'sess-1', problem_id: 'p1', seed: 7 }),
    ).toThrow(/UNIQUE|PRIMARY KEY/i)
  })

  it('allows the same problem twice in one session under different seeds', () => {
    insertSessionItem({ session_id: 'sess-1', problem_id: 'p1', seed: 7 })
    insertSessionItem({ session_id: 'sess-1', problem_id: 'p1', seed: 8 })
    expect(conn.prepare(`SELECT COUNT(*) AS n FROM session_items`).get().n).toBe(2)
  })
})

describe('session_items — the server-side counters', () => {
  beforeEach(() => {
    resetDatabase(':memory:')
    insertSession(session())
    insertSessionItem({ session_id: 'sess-1', problem_id: 'p1', seed: 42 })
  })

  afterAll(() => {
    closeDb()
  })

  it('inserts an item that starts at zero on every counter', () => {
    expect(getSessionItem('sess-1', 'p1', 42)).toMatchObject({
      session_id: 'sess-1',
      problem_id: 'p1',
      seed: 42,
      tries: 0,
      hints_used: 0,
      revealed: 0,
      done: 0,
    })
  })

  it('returns null for a seed that was never issued — the 409 case in plan §6.6', () => {
    expect(getSessionItem('sess-1', 'p1', 999)).toBeNull()
    expect(getSessionItem('sess-1', 'other', 42)).toBeNull()
    expect(getSessionItem('other-sess', 'p1', 42)).toBeNull()
  })

  it('increments tries on the server, one call at a time', () => {
    incrementSessionItemTries('sess-1', 'p1', 42)
    incrementSessionItemTries('sess-1', 'p1', 42)
    expect(getSessionItem('sess-1', 'p1', 42).tries).toBe(2)
    expect(getSessionItem('sess-1', 'p1', 42).hints_used).toBe(0)
  })

  it('increments hints_used independently of tries', () => {
    incrementSessionItemHints('sess-1', 'p1', 42)
    expect(getSessionItem('sess-1', 'p1', 42)).toMatchObject({ tries: 0, hints_used: 1 })
  })

  it('marks revealed and done as flags, idempotently', () => {
    markSessionItemRevealed('sess-1', 'p1', 42)
    markSessionItemRevealed('sess-1', 'p1', 42)
    markSessionItemDone('sess-1', 'p1', 42)
    markSessionItemDone('sess-1', 'p1', 42)
    expect(getSessionItem('sess-1', 'p1', 42)).toMatchObject({ revealed: 1, done: 1 })
  })

  it('touches only the addressed item', () => {
    insertSessionItem({ session_id: 'sess-1', problem_id: 'p2', seed: 43 })
    incrementSessionItemTries('sess-1', 'p1', 42)
    incrementSessionItemHints('sess-1', 'p1', 42)
    markSessionItemRevealed('sess-1', 'p1', 42)
    markSessionItemDone('sess-1', 'p1', 42)
    expect(getSessionItem('sess-1', 'p2', 43)).toMatchObject({
      tries: 0,
      hints_used: 0,
      revealed: 0,
      done: 0,
    })
  })

  it('does nothing when asked to increment an item that does not exist', () => {
    expect(() => incrementSessionItemTries('sess-1', 'p1', 999)).not.toThrow()
    expect(getSessionItem('sess-1', 'p1', 999)).toBeNull()
  })
})

describe('the seeded student carries the name plan §6.4 writes', () => {
  afterAll(() => {
    closeDb()
  })

  it("is 'Explorer', not a placeholder", () => {
    resetDatabase(':memory:')
    const row = _getDatabase().prepare(`SELECT * FROM students WHERE id = 'public'`).get()
    expect(row.display_name).toBe('Explorer')
    expect(row.avatar).toBe('🌱')
    expect(row.grade).toBe(5)
  })
})
