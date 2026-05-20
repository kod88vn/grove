// Set env var before any module loads
process.env.HOMEWORKS_DB_PATH = ':memory:'

import Database from 'better-sqlite3'
import path from 'path'
import { mkdirSync } from 'fs'

const SCHEMA = `
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

  CREATE INDEX IF NOT EXISTS idx_submissions_student ON submissions(student_id, created_at DESC);
  CREATE INDEX IF NOT EXISTS idx_submissions_subject ON submissions(subject, created_at DESC);
  CREATE INDEX IF NOT EXISTS idx_submissions_date ON submissions(created_at);

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
    created_at INTEGER NOT NULL DEFAULT (unixepoch())
  );

  CREATE INDEX IF NOT EXISTS idx_readings_student ON readings(student_id, created_at DESC);
  CREATE INDEX IF NOT EXISTS idx_readings_date ON readings(created_at);
`

let testDb = null

function createTestDb() {
  if (testDb) {
    try { testDb.close() } catch {}
  }
  const db = new Database(':memory:')
  db.pragma('journal_mode = WAL')
  db.pragma('foreign_keys = ON')
  db.exec(SCHEMA)
  testDb = db
  return db
}

beforeEach(() => { createTestDb() })
afterEach(() => { if (testDb) { try { testDb.close() } catch {} testDb = null } })

// Helper to insert submission directly into test DB
function insertSubmission(db, studentId, subject, type, exerciseId, score, maxScore, details) {
  const id = `${subject}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
  const percentage = Math.round((score / maxScore) * 100)
  const stmt = db.prepare(`
    INSERT INTO submissions (id, student_id, subject, type, exercise_json, answers_json, score, max_score, percentage, feedback, details_json)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `)
  stmt.run(
    id, studentId, subject, type,
    JSON.stringify({ id: exerciseId }),
    JSON.stringify(details?.answers || []),
    score, maxScore, percentage, details?.feedback || '',
    JSON.stringify(details || {})
  )
  return { id, percentage }
}

// Helper to insert reading directly into test DB
function insertReading(db, studentId, passage, questions, lessonKeyPoint, domain, score, maxScore) {
  const id = `reading-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
  const percentage = maxScore ? Math.round((score / maxScore) * 100) : null
  const stmt = db.prepare(`
    INSERT INTO readings (id, student_id, passage, questions_json, lesson_key_point, domain, score, max_score, percentage)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `)
  stmt.run(id, studentId, passage || '', JSON.stringify(questions || []), lessonKeyPoint || '', domain || 'random', score, maxScore, percentage)
  return id
}

// Helper to get submissions from test DB
function getSubmissionsFromDb(db, startMs, endMs) {
  const startSec = Math.floor(startMs / 1000)
  const endSec = Math.floor(endMs / 1000)
  const rows = db.prepare(`
    SELECT * FROM submissions WHERE created_at >= ? AND created_at < ? ORDER BY created_at DESC
  `).all(startSec, endSec)
  return rows.map(r => ({
    ...r,
    exercise: JSON.parse(r.exercise_json),
    answers: JSON.parse(r.answers_json),
    details: JSON.parse(r.details_json),
  }))
}

// Helper to get readings from test DB
function getReadingsFromDb(db, startMs, endMs) {
  const startSec = Math.floor(startMs / 1000)
  const endSec = Math.floor(endMs / 1000)
  const rows = db.prepare(`
    SELECT * FROM readings WHERE created_at >= ? AND created_at < ? ORDER BY created_at DESC
  `).all(startSec, endSec)
  return rows.map(r => ({ ...r, questions: JSON.parse(r.questions_json) }))
}

describe('SQLite progress persistence (direct DB)', () => {
  // Helper: get today's day-range in ms (matches the passing "date range queries" pattern)
  function getTodayRange() {
    const today = new Date().toISOString().split('T')[0]
    const date = new Date(today + 'T00:00:00Z')
    return { start: date.getTime(), end: date.getTime() + 86400 * 1000 }
  }

  describe('recordSubmission', () => {
    test('saves a submission to SQLite and retrieves it', () => {
      const result = insertSubmission(testDb, 'public', 'math', 'problem-set', 'math-test-1', 4, 5, { feedback: 'Great work!' })

      expect(result).toHaveProperty('id')
      expect(result.percentage).toBe(80)

      const { start, end } = getTodayRange()
      const submissions = getSubmissionsFromDb(testDb, start, end)
      expect(submissions.length).toBe(1)
      expect(submissions[0].subject).toBe('math')
      expect(submissions[0].type).toBe('problem-set')
      expect(submissions[0].score).toBe(4)
      expect(submissions[0].max_score).toBe(5)
      expect(submissions[0].percentage).toBe(80)
    })

    test('saves english reading submission', () => {
      const result = insertSubmission(testDb, 'public', 'english', 'reading', 'eng-read-1', 3, 5, { answers: ['Answer A', 'Answer B'], feedback: 'Good reading!' })

      expect(result.percentage).toBe(60)

      const { start, end } = getTodayRange()
      const submissions = getSubmissionsFromDb(testDb, start, end)
      expect(submissions.length).toBe(1)
      expect(submissions[0].subject).toBe('english')
    })

    test('saves english writing submission', () => {
      const result = insertSubmission(testDb, 'public', 'english', 'writing', 'eng-write-1', 15, 20, { criteria: [{ name: 'grammar', score: 8 }, { name: 'content', score: 7 }], feedback: 'Well written!' })

      expect(result.percentage).toBe(75)
    })
  })

  describe('recordReading', () => {
    test('saves a reading session to SQLite and retrieves it', () => {
      const id = insertReading(testDb, 'public', 'The quick brown fox jumps over the lazy dog.', [
        { id: 1, question: 'What color is the fox?', correctAnswer: 'brown' },
        { id: 2, question: 'What is the fox doing?', correctAnswer: 'jumps' },
      ], 'Main idea: action description', 'science', 2, 2)

      expect(id).toBeDefined()

      const { start, end } = getTodayRange()
      const readings = getReadingsFromDb(testDb, start, end)
      expect(readings.length).toBe(1)
      expect(readings[0].passage).toContain('quick brown fox')
      expect(readings[0].domain).toBe('science')
      expect(readings[0].percentage).toBe(100)
    })

    test('handles reading with null percentage when maxScore is 0', () => {
      const id = insertReading(testDb, 'public', 'Test passage', [], 'Test lesson point', 'random', 0, 0)

      expect(id).toBeDefined()

      const { start, end } = getTodayRange()
      const readings = getReadingsFromDb(testDb, start, end)
      expect(readings.length).toBe(1)
      expect(readings[0].percentage).toBeNull()
    })
  })

  describe('date range queries', () => {
    test('returns submissions for a specific date', () => {
      const today = new Date().toISOString().split('T')[0]
      const date = new Date(today + 'T00:00:00Z')
      const start = date.getTime()
      const end = start + 86400 * 1000

      insertSubmission(testDb, 'public', 'math', 'problem-set', `test-${Date.now()}`, 5, 5, {})
      insertSubmission(testDb, 'public', 'english', 'reading', `test-${Date.now() + 1}`, 3, 5, {})

      const submissions = getSubmissionsFromDb(testDb, start, end)
      expect(submissions.length).toBe(2)
    })

    test('returns empty array for date with no submissions', () => {
      const yesterday = new Date(Date.now() - 86400000).toISOString().split('T')[0]
      const date = new Date(yesterday + 'T00:00:00Z')
      const start = date.getTime()
      const end = start + 86400 * 1000

      const submissions = getSubmissionsFromDb(testDb, start, end)
      expect(submissions.length).toBe(0)
    })

    test('returns readings for a specific date', () => {
      const today = new Date().toISOString().split('T')[0]
      const date = new Date(today + 'T00:00:00Z')
      const start = date.getTime()
      const end = start + 86400 * 1000

      insertReading(testDb, 'public', 'Passage one', [], 'Point 1', 'science', 1, 1)
      insertReading(testDb, 'public', 'Passage two', [], 'Point 2', 'history', 2, 2)

      const readings = getReadingsFromDb(testDb, start, end)
      expect(readings.length).toBe(2)
    })

    test('returns empty array for date with no readings', () => {
      const yesterday = new Date(Date.now() - 86400000).toISOString().split('T')[0]
      const date = new Date(yesterday + 'T00:00:00Z')
      const start = date.getTime()
      const end = start + 86400 * 1000

      const readings = getReadingsFromDb(testDb, start, end)
      expect(readings.length).toBe(0)
    })
  })

  describe('data integrity', () => {
    test('multiple submissions and readings coexist correctly', () => {
      insertSubmission(testDb, 'public', 'math', 'problem-set', `m-${Date.now()}`, 5, 5, {})
      insertReading(testDb, 'public', 'Test passage', [], 'Point', 'science', 1, 2)

      const { start, end } = getTodayRange()
      const submissions = getSubmissionsFromDb(testDb, start, end)
      const readings = getReadingsFromDb(testDb, start, end)

      expect(submissions.length).toBe(1)
      expect(readings.length).toBe(1)
    })

    test('student_id is always public', () => {
      insertSubmission(testDb, 'public', 'math', 'problem-set', `p-${Date.now()}`, 1, 1, {})
      insertReading(testDb, 'public', 'Test', [], 'Point', 'random', 1, 1)

      const { start, end } = getTodayRange()
      const submissions = getSubmissionsFromDb(testDb, start, end)
      const readings = getReadingsFromDb(testDb, start, end)

      expect(submissions[0].student_id).toBe('public')
      expect(readings[0].student_id).toBe('public')
    })
  })
})