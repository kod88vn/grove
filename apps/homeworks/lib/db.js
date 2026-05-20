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

export function createDatabase(dbPath) {
  if (dbPath !== ':memory:') {
    mkdirSync(path.dirname(dbPath), { recursive: true })
  }

  const db = new Database(dbPath)
  db.pragma('journal_mode = WAL')
  db.pragma('foreign_keys = ON')
  db.exec(SCHEMA)

  return db
}

function getDbPath() {
  return process.env.HOMEWORKS_DB_PATH || path.join(process.cwd(), 'data', 'homeworks.db')
}

let dbInstance = null

function getDatabase(customPath) {
  if (!dbInstance || customPath) {
    if (dbInstance) {
      try { dbInstance.close() } catch {}
    }
    dbInstance = createDatabase(customPath || getDbPath())
  }
  return dbInstance
}

// Prepared statements for performance
const stmts = {
  insertSubmission: null,
  getSubmissionsByDateRange: null,
  getSubmissionById: null,
  insertReading: null,
  getReadingsByDateRange: null,
  getReadingById: null,
}

function initStatements(db) {
  stmts.insertSubmission = db.prepare(`
    INSERT INTO submissions (id, student_id, subject, type, exercise_json, answers_json, score, max_score, percentage, feedback, details_json)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `)

  stmts.getSubmissionsByDateRange = db.prepare(`
    SELECT * FROM submissions
    WHERE created_at >= ? AND created_at < ?
    ORDER BY created_at DESC
  `)

  stmts.getSubmissionById = db.prepare(`
    SELECT * FROM submissions WHERE id = ?
  `)

  stmts.insertReading = db.prepare(`
    INSERT INTO readings (id, student_id, passage, questions_json, lesson_key_point, domain, score, max_score, percentage)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `)

  stmts.getReadingsByDateRange = db.prepare(`
    SELECT * FROM readings
    WHERE created_at >= ? AND created_at < ?
    ORDER BY created_at DESC
  `)

  stmts.getReadingById = db.prepare(`
    SELECT * FROM readings WHERE id = ?
  `)
}

// Initialize statements on first DB access (or after closeDb resets them)
function ensureStatements() {
  if (!stmts.insertSubmission) {
    initStatements(getDatabase())
  }
}

function ensureAllStatements() {
  if (!stmts.insertSubmission) {
    initStatements(getDatabase())
  }
}

export function insertSubmission(data) {
  ensureStatements()
  const { id, student_id: sid, subject, type, exercise, answers, score, max_score: mscore, percentage, feedback, details } = data
  return stmts.insertSubmission.run(
    id, sid, subject, type,
    JSON.stringify(exercise || {}),
    JSON.stringify(answers || []),
    score, mscore, percentage, feedback || '',
    JSON.stringify(details || {})
  )
}

export function getSubmissionsByDateRange(startDateMs, endDateMs) {
  ensureStatements()
  const startSec = Math.floor(startDateMs / 1000)
  const endSec = Math.floor(endDateMs / 1000)
  const rows = stmts.getSubmissionsByDateRange.all(startSec, endSec)
  return rows.map(r => ({
    ...r,
    exercise: JSON.parse(r.exercise_json),
    answers: JSON.parse(r.answers_json),
    details: JSON.parse(r.details_json),
  }))
}

export function getSubmissionById(id) {
  ensureStatements()
  const row = stmts.getSubmissionById.get(id)
  if (!row) return null
  return {
    ...row,
    exercise: JSON.parse(row.exercise_json),
    answers: JSON.parse(row.answers_json),
    details: JSON.parse(row.details_json),
  }
}

export function insertReading(data) {
  ensureStatements()
  const { id, student_id: sid, passage, questions, lesson_key_point, domain, score, max_score: mscore, percentage } = data
  return stmts.insertReading.run(
    id, sid, passage || '',
    JSON.stringify(questions || []),
    lesson_key_point || '',
    domain || 'random',
    score, mscore, percentage
  )
}

export function getReadingsByDateRange(startDateMs, endDateMs) {
  ensureStatements()
  const startSec = Math.floor(startDateMs / 1000)
  const endSec = Math.floor(endDateMs / 1000)
  const rows = stmts.getReadingsByDateRange.all(startSec, endSec)
  return rows.map(r => ({
    ...r,
    questions: JSON.parse(r.questions_json),
  }))
}

export function getReadingById(id) {
  ensureStatements()
  const row = stmts.getReadingById.get(id)
  if (!row) return null
  return {
    ...row,
    questions: JSON.parse(row.questions_json),
  }
}

// Stats helpers
export function getDailyStats(dateMs) {
  ensureStatements()
  const db = getDatabase()
  const startSec = Math.floor(dateMs / 86400) * 86400
  const endSec = startSec + 86400

  const submissions = db.prepare(`
    SELECT subject, type, COUNT(*) as count, AVG(percentage) as avg_score, SUM(CASE WHEN percentage >= 80 THEN 1 ELSE 0 END) as passed
    FROM submissions WHERE created_at >= ? AND created_at < ? GROUP BY subject, type
  `).all(startSec, endSec)

  const readings = db.prepare(`
    SELECT COUNT(*) as count, AVG(percentage) as avg_score
    FROM readings WHERE created_at >= ? AND created_at < ?
  `).first(startSec, endSec)

  return { submissions, readings: readings || { count: 0, avg_score: null } }
}

export function getAllSubmissions(startDateMs, endDateMs) {
  ensureAllStatements()
  const startSec = Math.floor(startDateMs / 1000)
  const endSec = Math.floor(endDateMs / 1000)

  const rows = stmts.getSubmissionsByDateRange.all(startSec, endSec)
  return rows.map(r => ({
    id: r.id,
    student_id: r.student_id,
    subject: r.subject,
    type: r.type,
    score: r.score,
    max_score: r.max_score,
    percentage: r.percentage,
    feedback: r.feedback,
    exercise: JSON.parse(r.exercise_json),
    answers: JSON.parse(r.answers_json),
    details: JSON.parse(r.details_json),
    date: new Date(r.created_at * 1000).toISOString(),
  }))
}

export function getAllReadings(startDateMs, endDateMs) {
  ensureAllStatements()
  const startSec = Math.floor(startDateMs / 1000)
  const endSec = Math.floor(endDateMs / 1000)

  const rows = stmts.getReadingsByDateRange.all(startSec, endSec)
  return rows.map(r => ({
    id: r.id,
    student_id: r.student_id,
    passage: r.passage,
    questions: JSON.parse(r.questions_json),
    lesson_key_point: r.lesson_key_point,
    domain: r.domain,
    score: r.score,
    max_score: r.max_score,
    percentage: r.percentage,
    date: new Date(r.created_at * 1000).toISOString(),
  }))
}

// Close DB on process exit
process.on('exit', () => {
  if (dbInstance) {
    try { dbInstance.close() } catch {}
  }
})

export function initDb(customPath) {
  // Reset everything to create a fresh DB connection
  if (dbInstance) {
    try { dbInstance.close() } catch {}
  }
  dbInstance = null
  stmts.insertSubmission = null
  stmts.getSubmissionsByDateRange = null
  stmts.getSubmissionById = null
  stmts.insertReading = null
  stmts.getReadingsByDateRange = null
  stmts.getReadingById = null

  dbInstance = createDatabase(customPath || getDbPath())
  return dbInstance
}

// Force a fresh DB connection for testing
export function resetDatabase(customPath) {
  if (dbInstance) {
    try { dbInstance.close() } catch {}
  }
  dbInstance = null
  stmts.insertSubmission = null
  stmts.getSubmissionsByDateRange = null
  stmts.getSubmissionById = null
  stmts.insertReading = null
  stmts.getReadingsByDateRange = null
  stmts.getReadingById = null

  dbInstance = createDatabase(customPath || getDbPath())
}

export function closeDb() {
  if (dbInstance) {
    try { dbInstance.close() } catch {}
    dbInstance = null
    stmts.insertSubmission = null
    stmts.getSubmissionsByDateRange = null
    stmts.getSubmissionById = null
    stmts.insertReading = null
    stmts.getReadingsByDateRange = null
    stmts.getReadingById = null
  }
}

export { getDatabase as _getDatabase, getDatabase }
