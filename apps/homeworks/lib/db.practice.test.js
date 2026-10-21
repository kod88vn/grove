/**
 * @jest-environment node
 */
/**
 * P1.6 — practice tables.
 *
 * HOMEWORK_PLAN.md §6.4 adds `students`, `practice_sessions`, `session_items` and
 * `attempts` to apps/homeworks/lib/db.js, with "existing tables untouched". §10 Phase 1
 * names exactly those four; `skill_state` is Phase 4 and `badges` is Phase 3, so neither
 * is in scope here. `session_items` gets its own columns-and-constraints coverage in
 * db.session-items.test.js; this file pins the created-table set and the other three.
 * The plan's `students.id` comment says 'public' is seeded for backward
 * compatibility — every row already in `submissions` and `readings` carries that id, and
 * the new foreign keys point at it, so the seed has to exist before anything references
 * it and must survive re-initialisation.
 *
 * Isolation: HOMEWORK_PLAN.md §11 reads grove AGENTS.md as "homeworks lib/db.js gets
 * side-by-side tests against ':memory:'", and jest.setup.js already pins
 * HOMEWORKS_DB_PATH=':memory:' for the whole run. The two tests that need a real file
 * (WAL, and migrating a database that already has data) use os.tmpdir(), never
 * apps/homeworks/data/.
 */
import { afterAll, beforeAll, describe, expect, it } from '@jest/globals'
import Database from 'better-sqlite3'
import { existsSync, mkdtempSync, rmSync } from 'fs'
import os from 'os'
import path from 'path'

import * as db from './db.js'
import {
  closeDb,
  createDatabase,
  finishSession,
  getAttemptsBySession,
  getAttemptsByStudentDay,
  getSessionById,
  getStudentById,
  initDb,
  insertAttempt,
  insertSession,
  insertStudent,
  listStudents,
} from './db.js'

// PRAGMA table_info rows, flattened to 'name:type:notnull' so a dropped NOT NULL is as
// visible as a renamed column.
const columns = (conn, table) =>
  conn.prepare(`PRAGMA table_info(${table})`).all().map(c => `${c.name}:${c.type}:${c.notnull}`)

const indexNames = (conn, table) =>
  conn.prepare(`PRAGMA index_list(${table})`).all().map(i => i.name).sort()

const tableNames = conn =>
  conn
    .prepare(`SELECT name FROM sqlite_master WHERE type = 'table' AND name NOT LIKE 'sqlite_%'`)
    .all()
    .map(t => t.name)

// The two tables as they stand on master, verbatim from the SCHEMA literal in db.js.
const LEGACY_SCHEMA = `
  CREATE TABLE IF NOT EXISTS submissions (
    id TEXT PRIMARY KEY,
    student_id TEXT NOT NULL DEFAULT 'public',
    subject TEXT NOT NULL,
    type TEXT NOT NULL,
    exercise_json TEXT NOT NULL DEFAULT '{}',
    answers_json TEXT NOT NULL DEFAULT '[]',
    score REAL NOT NULL DEFAULT 0,
    max_score REAL NOT NULL DEFAULT 1,
    percentage INTEGER NOT NULL DEFAULT 0,
    feedback TEXT,
    details_json TEXT DEFAULT '{}',
    created_at INTEGER NOT NULL DEFAULT (unixepoch())
  );

  CREATE TABLE IF NOT EXISTS readings (
    id TEXT PRIMARY KEY,
    student_id TEXT NOT NULL DEFAULT 'public',
    passage TEXT NOT NULL DEFAULT '',
    questions_json TEXT NOT NULL DEFAULT '[]',
    lesson_key_point TEXT NOT NULL DEFAULT '',
    domain TEXT NOT NULL DEFAULT 'random',
    score REAL NOT NULL DEFAULT 0,
    max_score REAL NOT NULL DEFAULT 1,
    percentage INTEGER,
    answers_json TEXT NOT NULL DEFAULT '{}',
    created_at INTEGER NOT NULL DEFAULT (unixepoch())
  );
`

const tmpDirs = []
const tmpDb = name => {
  const dir = mkdtempSync(path.join(os.tmpdir(), 'hw-p16-'))
  tmpDirs.push(dir)
  return path.join(dir, name)
}

afterAll(() => {
  for (const dir of tmpDirs) {
    try { rmSync(dir, { recursive: true, force: true }) } catch {}
  }
})

describe('P1.6 schema — the four tables of plan §6.4 (students, practice_sessions, session_items, attempts)', () => {
  let conn

  beforeAll(() => {
    conn = createDatabase(':memory:')
  })

  afterAll(() => {
    try { conn.close() } catch {}
  })

  it('creates the P1.6 tables plus the Phase 4 skill_state', () => {
    expect(tableNames(conn).sort()).toEqual(
      ['attempts', 'practice_sessions', 'readings', 'session_items', 'skill_state', 'student_decorations', 'students', 'submissions'],
    )
  })

  it('creates the Phase 4 skill_state table but not the later-phase tables yet', () => {
    const names = tableNames(conn)
    expect(names).toContain('skill_state')
    expect(names).not.toContain('badges')
  })

  it('gives students the plan\u2019s columns', () => {
    expect(columns(conn, 'students')).toEqual([
      'id:TEXT:0',
      'display_name:TEXT:1',
      'avatar:TEXT:1',
      'grade:INTEGER:1',
      'settings_json:TEXT:1',
      'created_at:INTEGER:1',
    ])
    const info = conn.prepare(`PRAGMA table_info(students)`).all()
    expect(info.find(c => c.name === 'id').pk).toBe(1)
    expect(info.find(c => c.name === 'settings_json').dflt_value).toBe(`'{}'`)
  })

  it('gives practice_sessions the plan\u2019s columns, with skill_id and finished_at nullable', () => {
    expect(columns(conn, 'practice_sessions')).toEqual([
      'id:TEXT:0',
      'student_id:TEXT:1',
      'kind:TEXT:1',
      'skill_id:TEXT:0',
      'local_date:TEXT:1',
      'tz:TEXT:1',
      'started_at:INTEGER:1',
      'finished_at:INTEGER:0',
      'finish_result_json:TEXT:0',
    ])
  })

  it('gives attempts the plan\u2019s columns, in the plan\u2019s order', () => {
    expect(columns(conn, 'attempts')).toEqual([
      'id:TEXT:0',
      'session_id:TEXT:0',
      'student_id:TEXT:1',
      'subject:TEXT:1',
      'grade:INTEGER:1',
      'skill_id:TEXT:1',
      'problem_id:TEXT:1',
      'content_version:INTEGER:1',
      'seed:INTEGER:1',
      'difficulty:INTEGER:1',
      'shown_json:TEXT:1',
      'response_json:TEXT:1',
      'answer_json:TEXT:1',
      'correct:INTEGER:1',
      'tries:INTEGER:1',
      'hints_used:INTEGER:1',
      'revealed:INTEGER:1',
      'stars:INTEGER:1',
      'rubric_json:TEXT:0',
      'duration_ms:INTEGER:0',
      'local_date:TEXT:1',
      'created_at:INTEGER:1',
    ])
  })

  it('carries both attempts indexes from the plan', () => {
    expect(indexNames(conn, 'attempts')).toEqual(
      expect.arrayContaining(['idx_attempts_student_date', 'idx_attempts_student_skill']),
    )
    const sql = conn
      .prepare(`SELECT name, sql FROM sqlite_master WHERE type = 'index' AND tbl_name = 'attempts'`)
      .all()
    const byDate = sql.find(i => i.name === 'idx_attempts_student_date')
    const bySkill = sql.find(i => i.name === 'idx_attempts_student_skill')
    expect(byDate.sql).toContain('student_id')
    expect(byDate.sql).toContain('local_date DESC')
    expect(bySkill.sql).toContain('skill_id')
    expect(bySkill.sql).toContain('created_at DESC')
  })

  it('wires the foreign keys the plan draws', () => {
    const sessionFks = conn.prepare(`PRAGMA foreign_key_list(practice_sessions)`).all()
    expect(sessionFks.map(f => `${f.from}->${f.table}.${f.to}`)).toEqual(['student_id->students.id'])

    const attemptFks = conn
      .prepare(`PRAGMA foreign_key_list(attempts)`)
      .all()
      .map(f => `${f.from}->${f.table}.${f.to}`)
      .sort()
    expect(attemptFks).toEqual([
      'session_id->practice_sessions.id',
      'student_id->students.id',
    ])
  })

  it('turns foreign key enforcement on', () => {
    expect(conn.pragma('foreign_keys', { simple: true })).toBe(1)
  })
})

describe('P1.6 constraints actually reject bad rows', () => {
  let conn

  beforeAll(() => {
    conn = createDatabase(':memory:')
    conn.prepare(
      `INSERT INTO practice_sessions (id, student_id, kind, local_date, tz)
       VALUES ('s-ok', 'public', 'daily', '2026-09-27', 'America/New_York')`,
    ).run()
  })

  afterAll(() => {
    try { conn.close() } catch {}
  })

  const attempt = overrides => {
    const row = {
      id: `a-${Math.random().toString(36).slice(2)}`,
      session_id: 's-ok',
      student_id: 'public',
      subject: 'math',
      grade: 5,
      skill_id: 'm5.nbt.long-multiplication',
      problem_id: 'p1',
      content_version: 1,
      seed: 42,
      difficulty: 2,
      shown_json: '{}',
      response_json: '{}',
      answer_json: '{}',
      correct: 1,
      tries: 1,
      hints_used: 0,
      revealed: 0,
      stars: 3,
      rubric_json: null,
      duration_ms: 1000,
      local_date: '2026-09-27',
      ...overrides,
    }
    return () =>
      conn.prepare(
        `INSERT INTO attempts (id, session_id, student_id, subject, grade, skill_id, problem_id,
           content_version, seed, difficulty, shown_json, response_json, answer_json, correct,
           tries, hints_used, revealed, stars, rubric_json, duration_ms, local_date)
         VALUES (@id, @session_id, @student_id, @subject, @grade, @skill_id, @problem_id,
           @content_version, @seed, @difficulty, @shown_json, @response_json, @answer_json,
           @correct, @tries, @hints_used, @revealed, @stars, @rubric_json, @duration_ms,
           @local_date)`,
      ).run(row)
  }

  it('accepts a well-formed attempt', () => {
    expect(attempt({})).not.toThrow()
  })

  it('rejects a grade outside 1..12', () => {
    expect(() =>
      conn.prepare(
        `INSERT INTO students (id, display_name, avatar, grade) VALUES ('bad', 'Bad', 'x', 0)`,
      ).run(),
    ).toThrow(/CHECK constraint failed/)
  })

  it('rejects an unknown practice_sessions.kind', () => {
    expect(() =>
      conn.prepare(
        `INSERT INTO practice_sessions (id, student_id, kind, local_date, tz)
         VALUES ('s-bad', 'public', 'homework', '2026-09-27', 'UTC')`,
      ).run(),
    ).toThrow(/CHECK constraint failed/)
  })

  it.each([
    ['subject', { subject: 'science' }],
    ['difficulty', { difficulty: 4 }],
    ['correct', { correct: 2 }],
    ['tries', { tries: 0 }],
    ['stars', { stars: 4 }],
  ])('rejects an out-of-range attempts.%s', (_label, overrides) => {
    expect(attempt(overrides)).toThrow(/CHECK constraint failed/)
  })

  it('rejects a session whose student does not exist', () => {
    expect(() =>
      conn.prepare(
        `INSERT INTO practice_sessions (id, student_id, kind, local_date, tz)
         VALUES ('s-orphan', 'ghost', 'daily', '2026-09-27', 'UTC')`,
      ).run(),
    ).toThrow(/FOREIGN KEY constraint failed/)
  })

  it('rejects an attempt whose session does not exist', () => {
    expect(attempt({ session_id: 'ghost-session' })).toThrow(/FOREIGN KEY constraint failed/)
  })

  it('rejects an attempt whose student does not exist', () => {
    expect(attempt({ student_id: 'ghost-student' })).toThrow(/FOREIGN KEY constraint failed/)
  })
})

describe('P1.6 the public student seed', () => {
  it('seeds exactly one row, id "public", with a usable profile', () => {
    const conn = createDatabase(':memory:')
    const rows = conn.prepare(`SELECT * FROM students`).all()
    expect(rows).toHaveLength(1)
    expect(rows[0].id).toBe('public')
    expect(rows[0].display_name.length).toBeGreaterThan(0)
    expect(rows[0].avatar.length).toBeGreaterThan(0)
    expect(rows[0].grade).toBeGreaterThanOrEqual(1)
    expect(rows[0].grade).toBeLessThanOrEqual(12)
    expect(() => JSON.parse(rows[0].settings_json)).not.toThrow()
    conn.close()
  })

  it('is idempotent — initialising the same file twice leaves one public row', () => {
    const file = tmpDb('seed-twice.db')

    const first = createDatabase(file)
    first.prepare(`UPDATE students SET display_name = 'Renamed' WHERE id = 'public'`).run()
    first.close()

    const second = createDatabase(file)
    const rows = second.prepare(`SELECT * FROM students WHERE id = 'public'`).all()
    expect(rows).toHaveLength(1)
    // A blind re-seed would overwrite the edit; INSERT OR IGNORE leaves it alone.
    expect(rows[0].display_name).toBe('Renamed')
    expect(second.prepare(`SELECT COUNT(*) AS n FROM students`).get().n).toBe(1)
    second.close()
  })
})

describe('P1.6 leaves the existing tables untouched', () => {
  let conn

  beforeAll(() => {
    conn = createDatabase(':memory:')
  })

  afterAll(() => {
    try { conn.close() } catch {}
  })

  it('keeps the submissions columns exactly as they were', () => {
    expect(columns(conn, 'submissions')).toEqual([
      'id:TEXT:0',
      'student_id:TEXT:1',
      'subject:TEXT:1',
      'type:TEXT:1',
      'exercise_json:TEXT:1',
      'answers_json:TEXT:1',
      'score:REAL:1',
      'max_score:REAL:1',
      'percentage:INTEGER:1',
      'feedback:TEXT:0',
      'details_json:TEXT:0',
      'created_at:INTEGER:1',
    ])
  })

  it('keeps the readings columns exactly as they were', () => {
    expect(columns(conn, 'readings')).toEqual([
      'id:TEXT:0',
      'student_id:TEXT:1',
      'passage:TEXT:1',
      'questions_json:TEXT:1',
      'lesson_key_point:TEXT:1',
      'domain:TEXT:1',
      'score:REAL:1',
      'max_score:REAL:1',
      'percentage:INTEGER:0',
      'answers_json:TEXT:1',
      'created_at:INTEGER:1',
    ])
  })

  it('keeps the existing indexes', () => {
    expect(indexNames(conn, 'submissions')).toEqual(
      expect.arrayContaining([
        'idx_submissions_date',
        'idx_submissions_student',
        'idx_submissions_subject',
      ]),
    )
    expect(indexNames(conn, 'readings')).toEqual(
      expect.arrayContaining(['idx_readings_date', 'idx_readings_student']),
    )
  })

  it('does not put a foreign key on submissions.student_id', () => {
    // Legacy rows carry student_id = 'public' but were written with no FK; adding one
    // would rewrite the table, which §6.4 forbids.
    expect(conn.prepare(`PRAGMA foreign_key_list(submissions)`).all()).toEqual([])
    expect(conn.prepare(`PRAGMA foreign_key_list(readings)`).all()).toEqual([])
  })
})

describe('P1.6 migrating a database that already exists', () => {
  it('adds the new tables and the seed without losing legacy rows', () => {
    const file = tmpDb('legacy.db')

    const legacy = new Database(file)
    legacy.pragma('journal_mode = WAL')
    legacy.exec(LEGACY_SCHEMA)
    legacy.prepare(
      `INSERT INTO submissions (id, student_id, subject, type, score, max_score, percentage)
       VALUES ('old-sub', 'public', 'math', 'problem-set', 7, 10, 70)`,
    ).run()
    legacy.prepare(
      `INSERT INTO readings (id, student_id, passage, score, max_score)
       VALUES ('old-read', 'public', 'Once upon a time', 3, 4)`,
    ).run()
    legacy.close()

    const migrated = createDatabase(file)
    expect(tableNames(migrated).sort()).toEqual(
      ['attempts', 'practice_sessions', 'readings', 'session_items', 'skill_state', 'student_decorations', 'students', 'submissions'],
    )
    expect(migrated.prepare(`SELECT score FROM submissions WHERE id = 'old-sub'`).get().score).toBe(7)
    expect(migrated.prepare(`SELECT passage FROM readings WHERE id = 'old-read'`).get().passage)
      .toBe('Once upon a time')
    expect(migrated.prepare(`SELECT COUNT(*) AS n FROM students`).get().n).toBe(1)

    // The legacy rows' student_id now resolves against the seeded profile.
    const joined = migrated.prepare(
      `SELECT s.id FROM submissions s JOIN students st ON st.id = s.student_id`,
    ).all()
    expect(joined.map(r => r.id)).toEqual(['old-sub'])
    migrated.close()
  })

  it('still opens file-backed databases in WAL mode with foreign keys on', () => {
    const conn = createDatabase(tmpDb('pragmas.db'))
    expect(conn.pragma('journal_mode', { simple: true })).toBe('wal')
    expect(conn.pragma('foreign_keys', { simple: true })).toBe(1)
    conn.close()
  })

  it('adds the saved finish result to an existing sessions table without changing finished rows', () => {
    const file = tmpDb('finished-session.db')
    const legacy = new Database(file)
    legacy.exec(`
      CREATE TABLE students (
        id TEXT PRIMARY KEY, display_name TEXT NOT NULL, avatar TEXT NOT NULL,
        grade INTEGER NOT NULL, settings_json TEXT NOT NULL DEFAULT '{}',
        created_at INTEGER NOT NULL DEFAULT (unixepoch())
      );
      INSERT INTO students (id, display_name, avatar, grade) VALUES ('public', 'Explorer', '🌱', 5);
      CREATE TABLE practice_sessions (
        id TEXT PRIMARY KEY, student_id TEXT NOT NULL REFERENCES students(id),
        kind TEXT NOT NULL, skill_id TEXT, local_date TEXT NOT NULL, tz TEXT NOT NULL,
        started_at INTEGER NOT NULL DEFAULT (unixepoch()), finished_at INTEGER
      );
      INSERT INTO practice_sessions (id, student_id, kind, local_date, tz, finished_at)
      VALUES ('old-finished', 'public', 'daily', '2026-09-30', 'UTC', 123);
    `)
    legacy.close()

    const migrated = createDatabase(file)
    const columnsAfterMigration = columns(migrated, 'practice_sessions')
    const oldSession = migrated.prepare(`SELECT * FROM practice_sessions WHERE id = 'old-finished'`).get()
    expect(columnsAfterMigration).toContain('finish_result_json:TEXT:0')
    expect(oldSession.finished_at).toBe(123)
    expect(oldSession.finish_result_json).toBeNull()
    migrated.close()
  })
})

describe('P1.6 repository functions', () => {
  beforeAll(() => {
    initDb(':memory:')
  })

  afterAll(() => {
    closeDb()
  })

  it('exports the P1.6 helpers alongside everything callers already use', () => {
    expect(Object.keys(db).sort()).toEqual([
      '_getDatabase',
      'closeDb',
      'createDatabase',
      'finishSession',
      'getAllReadings',
      'getAllSubmissions',
      'getAttemptsBySession',
      'getAttemptsByStudent',
      'getAttemptsByStudentDay',
      'getDatabase',
      'getOwnedDecorations',
      'getReadingById',
      'getReadingsByDateRange',
      'getSessionById',
      'getSessionItem',
      'getStudentById',
      'getSubmissionById',
      'getSubmissionsByDateRange',
      'getSunshineBalance',
      'incrementSessionItemHints',
      'incrementSessionItemTries',
      'initDb',
      'insertAttempt',
      'insertReading',
      'insertSession',
      'insertSessionItem',
      'insertStudent',
      'insertSubmission',
      'listStudents',
      'markSessionItemDone',
      'markSessionItemRevealed',
      'purchaseDecoration',
      'resetDatabase',
    ])
  })

  it('round-trips a student, parsing settings', () => {
    insertStudent({
      id: 'kid-1',
      display_name: 'Mia',
      avatar: '🦊',
      grade: 5,
      settings: { sounds: true, tz: 'America/New_York' },
    })

    const kid = getStudentById('kid-1')
    expect(kid.display_name).toBe('Mia')
    expect(kid.avatar).toBe('🦊')
    expect(kid.grade).toBe(5)
    expect(kid.settings).toEqual({ sounds: true, tz: 'America/New_York' })
    expect(typeof kid.created_at).toBe('number')
  })

  it('defaults settings to an empty object when none is given', () => {
    insertStudent({ id: 'kid-2', display_name: 'Leo', avatar: '🐢', grade: 3 })
    expect(getStudentById('kid-2').settings).toEqual({})
  })

  it('returns null for a student who does not exist', () => {
    expect(getStudentById('nobody')).toBeNull()
  })

  it('lists the seeded public profile with the created ones', () => {
    expect(listStudents().map(s => s.id).sort()).toEqual(['kid-1', 'kid-2', 'public'])
    expect(listStudents().every(s => typeof s.settings === 'object' && s.settings !== null)).toBe(true)
  })

  it('round-trips a practice session, open until it is finished', () => {
    insertSession({
      id: 'sess-1',
      student_id: 'kid-1',
      kind: 'daily',
      skill_id: 'm5.nbt.long-multiplication',
      local_date: '2026-09-27',
      tz: 'America/New_York',
    })

    const session = getSessionById('sess-1')
    expect(session.student_id).toBe('kid-1')
    expect(session.kind).toBe('daily')
    expect(session.local_date).toBe('2026-09-27')
    expect(session.tz).toBe('America/New_York')
    expect(typeof session.started_at).toBe('number')
    expect(session.finished_at).toBeNull()
  })

  it('accepts a session with no skill and returns null for an unknown id', () => {
    insertSession({
      id: 'sess-free',
      student_id: 'kid-2',
      kind: 'free',
      local_date: '2026-09-27',
      tz: 'UTC',
    })
    expect(getSessionById('sess-free').skill_id).toBeNull()
    expect(getSessionById('no-such-session')).toBeNull()
  })

  it('stamps finished_at when the session ends', () => {
    finishSession('sess-free', { finished: true, stars: 0, grew: [], next: null })
    expect(typeof getSessionById('sess-free').finished_at).toBe('number')
    expect(JSON.parse(getSessionById('sess-free').finish_result_json)).toEqual({
      finished: true, stars: 0, grew: [], next: null,
    })
  })

  it('returns and preserves the first saved result on repeated finishes', () => {
    const first = { finished: true, stars: 3, grew: [], next: { id: 'first-next' } }
    const changed = { finished: true, stars: 99, grew: [{ skillId: 'later' }], next: null }

    expect(finishSession('sess-1', first)).toEqual(first)
    expect(finishSession('sess-1', changed)).toEqual(first)
  })

  it('stores an attempt with its snapshot, tries and hints, and reads them back parsed', () => {
    insertAttempt({
      id: 'att-1',
      session_id: 'sess-1',
      student_id: 'kid-1',
      subject: 'math',
      grade: 5,
      skill_id: 'm5.nbt.long-multiplication',
      problem_id: 'm5.nbt.long-multiplication#0',
      content_version: 1,
      seed: 12345,
      difficulty: 2,
      shown: { prompt: '34 × 21' },
      response: { value: '714' },
      answer: { value: '714' },
      correct: true,
      tries: 2,
      hints_used: 1,
      revealed: 0,
      stars: 2,
      duration_ms: 41000,
      local_date: '2026-09-27',
    })

    const [att] = getAttemptsBySession('sess-1')
    expect(att.id).toBe('att-1')
    expect(att.shown).toEqual({ prompt: '34 × 21' })
    expect(att.response).toEqual({ value: '714' })
    expect(att.answer).toEqual({ value: '714' })
    expect(att.correct).toBe(1)
    expect(att.tries).toBe(2)
    expect(att.hints_used).toBe(1)
    expect(att.revealed).toBe(0)
    expect(att.stars).toBe(2)
    expect(att.duration_ms).toBe(41000)
    expect(att.rubric).toBeNull()
  })

  it('keeps a free-response rubric when one is given', () => {
    insertAttempt({
      id: 'att-2',
      session_id: 'sess-1',
      student_id: 'kid-1',
      subject: 'english',
      grade: 5,
      skill_id: 'e5.l.context-clues',
      problem_id: 'e5.l.context-clues#3',
      content_version: 1,
      seed: 7,
      difficulty: 1,
      shown: { prompt: 'Pick the meaning' },
      response: { value: 'b' },
      answer: { value: 'b' },
      correct: false,
      tries: 1,
      hints_used: 0,
      revealed: 1,
      stars: 0,
      rubric: { ideas: 3, evidence: 2 },
      local_date: '2026-09-27',
    })

    const att = getAttemptsBySession('sess-1').find(a => a.id === 'att-2')
    expect(att.correct).toBe(0)
    expect(att.revealed).toBe(1)
    expect(att.rubric).toEqual({ ideas: 3, evidence: 2 })
    expect(att.duration_ms).toBeNull()
  })

  it('finds a kid\u2019s attempts for one local date, and none for another', () => {
    insertAttempt({
      id: 'att-3',
      session_id: 'sess-1',
      student_id: 'kid-1',
      subject: 'math',
      grade: 5,
      skill_id: 'm5.oa.order-of-operations',
      problem_id: 'm5.oa.order-of-operations#1',
      content_version: 1,
      seed: 9,
      difficulty: 1,
      shown: {},
      response: {},
      answer: {},
      correct: true,
      tries: 1,
      hints_used: 0,
      revealed: 0,
      stars: 3,
      local_date: '2026-09-26',
    })

    expect(getAttemptsByStudentDay('kid-1', '2026-09-27').map(a => a.id).sort())
      .toEqual(['att-1', 'att-2'])
    expect(getAttemptsByStudentDay('kid-1', '2026-09-26').map(a => a.id)).toEqual(['att-3'])
    expect(getAttemptsByStudentDay('kid-2', '2026-09-27')).toEqual([])
  })

  it('accepts an attempt with no session (a one-off problem)', () => {
    insertAttempt({
      id: 'att-loose',
      session_id: null,
      student_id: 'kid-2',
      subject: 'math',
      grade: 3,
      skill_id: 'm3.oa.multiply-within-100',
      problem_id: 'm3.oa.multiply-within-100#0',
      content_version: 1,
      seed: 1,
      difficulty: 1,
      shown: {},
      response: {},
      answer: {},
      correct: true,
      tries: 1,
      hints_used: 0,
      revealed: 0,
      stars: 3,
      local_date: '2026-09-25',
    })

    const [att] = getAttemptsByStudentDay('kid-2', '2026-09-25')
    expect(att.id).toBe('att-loose')
    expect(att.session_id).toBeNull()
  })

  it('refuses an attempt for a student who does not exist', () => {
    expect(() =>
      insertAttempt({
        id: 'att-ghost',
        session_id: null,
        student_id: 'ghost',
        subject: 'math',
        grade: 5,
        skill_id: 'm5.oa.order-of-operations',
        problem_id: 'x',
        content_version: 1,
        seed: 1,
        difficulty: 1,
        shown: {},
        response: {},
        answer: {},
        correct: true,
        tries: 1,
        hints_used: 0,
        revealed: 0,
        stars: 3,
        local_date: '2026-09-27',
      }),
    ).toThrow(/FOREIGN KEY constraint failed/)
  })

  it('refuses a session for a student who does not exist', () => {
    expect(() =>
      insertSession({
        id: 'sess-ghost',
        student_id: 'ghost',
        kind: 'daily',
        local_date: '2026-09-27',
        tz: 'UTC',
      }),
    ).toThrow(/FOREIGN KEY constraint failed/)
  })
})

describe('P1.6 writes nothing into the repository', () => {
  it('never creates apps/homeworks/data', () => {
    // jest.setup.js pins HOMEWORKS_DB_PATH=':memory:' and createDatabase skips mkdirSync
    // for it, so the checked-in tree must stay clean after a full run.
    expect(existsSync(path.join(process.cwd(), 'data'))).toBe(false)
  })
})
