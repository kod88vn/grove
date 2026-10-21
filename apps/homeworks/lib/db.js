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
    answers_json TEXT NOT NULL DEFAULT '{}',
    created_at INTEGER NOT NULL DEFAULT (unixepoch())
  );

  CREATE INDEX IF NOT EXISTS idx_readings_student ON readings(student_id, created_at DESC);
  CREATE INDEX IF NOT EXISTS idx_readings_date ON readings(created_at);

  CREATE TABLE IF NOT EXISTS students (
    id TEXT PRIMARY KEY,
    display_name TEXT NOT NULL,
    avatar TEXT NOT NULL,
    grade INTEGER NOT NULL CHECK (grade BETWEEN 1 AND 12),
    settings_json TEXT NOT NULL DEFAULT '{}',
    created_at INTEGER NOT NULL DEFAULT (unixepoch())
  );

  CREATE TABLE IF NOT EXISTS practice_sessions (
    id TEXT PRIMARY KEY,
    student_id TEXT NOT NULL REFERENCES students(id),
    kind TEXT NOT NULL CHECK (kind IN ('daily','skill','review','path','free')),
    skill_id TEXT,
    local_date TEXT NOT NULL,
    tz TEXT NOT NULL,
    started_at INTEGER NOT NULL DEFAULT (unixepoch()),
    finished_at INTEGER,
    finish_result_json TEXT
  );

  CREATE TABLE IF NOT EXISTS session_items (
    session_id TEXT NOT NULL REFERENCES practice_sessions(id),
    problem_id TEXT NOT NULL,
    seed INTEGER NOT NULL,
    tries INTEGER NOT NULL DEFAULT 0,
    hints_used INTEGER NOT NULL DEFAULT 0,
    revealed INTEGER NOT NULL DEFAULT 0,
    done INTEGER NOT NULL DEFAULT 0 CHECK (done IN (0,1)),
    PRIMARY KEY (session_id, problem_id, seed)
  );

  CREATE TABLE IF NOT EXISTS attempts (
    id TEXT PRIMARY KEY,
    session_id TEXT REFERENCES practice_sessions(id),
    student_id TEXT NOT NULL REFERENCES students(id),
    subject TEXT NOT NULL CHECK (subject IN ('math','english')),
    grade INTEGER NOT NULL,
    skill_id TEXT NOT NULL,
    problem_id TEXT NOT NULL,
    content_version INTEGER NOT NULL,
    seed INTEGER NOT NULL,
    difficulty INTEGER NOT NULL CHECK (difficulty BETWEEN 1 AND 3),
    shown_json TEXT NOT NULL,
    response_json TEXT NOT NULL,
    answer_json TEXT NOT NULL,
    correct INTEGER NOT NULL CHECK (correct IN (0,1)),
    tries INTEGER NOT NULL CHECK (tries >= 1),
    hints_used INTEGER NOT NULL DEFAULT 0,
    revealed INTEGER NOT NULL DEFAULT 0,
    stars INTEGER NOT NULL CHECK (stars BETWEEN 0 AND 3),
    rubric_json TEXT,
    duration_ms INTEGER,
    local_date TEXT NOT NULL,
    created_at INTEGER NOT NULL DEFAULT (unixepoch())
  );
  CREATE INDEX IF NOT EXISTS idx_attempts_student_date ON attempts(student_id, local_date DESC);
  CREATE INDEX IF NOT EXISTS idx_attempts_student_skill ON attempts(student_id, skill_id, created_at DESC);

  CREATE TABLE IF NOT EXISTS student_decorations (
    student_id TEXT NOT NULL REFERENCES students(id),
    decoration_id TEXT NOT NULL,
    purchase_cost INTEGER NOT NULL CHECK (purchase_cost > 0),
    purchased_at INTEGER NOT NULL DEFAULT (unixepoch()),
    PRIMARY KEY (student_id, decoration_id)
  );

  CREATE TABLE IF NOT EXISTS skill_state (
    student_id TEXT NOT NULL REFERENCES students(id),
    skill_id TEXT NOT NULL,
    stage TEXT NOT NULL CHECK (stage IN ('seed','sprout','sapling','tree','fruiting')),
    level INTEGER NOT NULL DEFAULT 1 CHECK (level BETWEEN 1 AND 3),  -- difficulty ladder position
    box INTEGER NOT NULL DEFAULT 0 CHECK (box BETWEEN 0 AND 5),      -- Leitner box
    due_date TEXT,                                                    -- next spaced review (local date)
    attempts INTEGER NOT NULL DEFAULT 0,
    correct INTEGER NOT NULL DEFAULT 0,
    updated_at INTEGER NOT NULL DEFAULT (unixepoch()),
    PRIMARY KEY (student_id, skill_id)
  );

  CREATE INDEX IF NOT EXISTS idx_skill_state_student ON skill_state(student_id, stage);
`

export function createDatabase(dbPath) {
  if (dbPath !== ':memory:') {
    mkdirSync(path.dirname(dbPath), { recursive: true })
  }

  const db = new Database(dbPath)
  db.pragma('journal_mode = WAL')
  db.pragma('foreign_keys = ON')
  db.exec(SCHEMA)
  const sessionColumns = db.pragma('table_info(practice_sessions)')
  if (!sessionColumns.some((column) => column.name === 'finish_result_json')) {
    db.exec(`ALTER TABLE practice_sessions ADD COLUMN finish_result_json TEXT`)
  }
  db.prepare(`
    INSERT OR IGNORE INTO students (id, display_name, avatar, grade)
    VALUES ('public', 'Explorer', '🌱', 5)
  `).run()

  // Migrate: ensure answers_json column exists on existing databases
  try {
    db.exec(`ALTER TABLE readings ADD COLUMN answers_json TEXT NOT NULL DEFAULT '{}'`)
  } catch (_) { /* column already exists */ }

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
  insertStudent: null,
  getStudentById: null,
  listStudents: null,
  insertSession: null,
  getSessionById: null,
  finishSession: null,
  insertSessionItem: null,
  getSessionItem: null,
  incrementSessionItemTries: null,
  incrementSessionItemHints: null,
  markSessionItemRevealed: null,
  markSessionItemDone: null,
  insertAttempt: null,
  getAttemptsBySession: null,
  getAttemptsByStudentDay: null,
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
    INSERT INTO readings (id, student_id, passage, questions_json, lesson_key_point, domain, score, max_score, percentage, answers_json)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `)

  stmts.getReadingsByDateRange = db.prepare(`
    SELECT * FROM readings
    WHERE created_at >= ? AND created_at < ?
    ORDER BY created_at DESC
  `)

  stmts.getReadingById = db.prepare(`
    SELECT * FROM readings WHERE id = ?
  `)

  stmts.insertStudent = db.prepare(`
    INSERT INTO students (id, display_name, avatar, grade, settings_json)
    VALUES (?, ?, ?, ?, ?)
  `)

  stmts.getStudentById = db.prepare(`
    SELECT * FROM students WHERE id = ?
  `)

  stmts.listStudents = db.prepare(`
    SELECT * FROM students ORDER BY created_at ASC, id ASC
  `)

  stmts.insertSession = db.prepare(`
    INSERT INTO practice_sessions (id, student_id, kind, skill_id, local_date, tz)
    VALUES (?, ?, ?, ?, ?, ?)
  `)

  stmts.getSessionById = db.prepare(`
    SELECT * FROM practice_sessions WHERE id = ?
  `)

  stmts.finishSession = db.prepare(`
    UPDATE practice_sessions
    SET finished_at = unixepoch(), finish_result_json = ?
    WHERE id = ? AND finished_at IS NULL AND finish_result_json IS NULL
  `)

  stmts.insertSessionItem = db.prepare(`
    INSERT INTO session_items (session_id, problem_id, seed)
    VALUES (?, ?, ?)
  `)

  stmts.getSessionItem = db.prepare(`
    SELECT * FROM session_items
    WHERE session_id = ? AND problem_id = ? AND seed = ?
  `)

  stmts.incrementSessionItemTries = db.prepare(`
    UPDATE session_items SET tries = tries + 1
    WHERE session_id = ? AND problem_id = ? AND seed = ?
  `)

  stmts.incrementSessionItemHints = db.prepare(`
    UPDATE session_items SET hints_used = hints_used + 1
    WHERE session_id = ? AND problem_id = ? AND seed = ?
  `)

  stmts.markSessionItemRevealed = db.prepare(`
    UPDATE session_items SET revealed = 1
    WHERE session_id = ? AND problem_id = ? AND seed = ?
  `)

  stmts.markSessionItemDone = db.prepare(`
    UPDATE session_items SET done = 1
    WHERE session_id = ? AND problem_id = ? AND seed = ?
  `)

  stmts.insertAttempt = db.prepare(`
    INSERT INTO attempts (id, session_id, student_id, subject, grade, skill_id, problem_id,
      content_version, seed, difficulty, shown_json, response_json, answer_json, correct,
      tries, hints_used, revealed, stars, rubric_json, duration_ms, local_date)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `)

  stmts.getAttemptsBySession = db.prepare(`
    SELECT * FROM attempts WHERE session_id = ? ORDER BY created_at DESC
  `)

  stmts.getAttemptsByStudentDay = db.prepare(`
    SELECT * FROM attempts WHERE student_id = ? AND local_date = ? ORDER BY created_at DESC
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
  const { id, student_id: sid, passage, questions, lesson_key_point, domain, score, max_score: mscore, percentage, answers_json } = data
  return stmts.insertReading.run(
    id, sid, passage || '',
    JSON.stringify(questions || []),
    lesson_key_point || '',
    domain || 'random',
    score, mscore, percentage,
    answers_json || '{}'
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
    answers: JSON.parse(r.answers_json || '{}'),
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

function parseStudent(row) {
  return { ...row, settings: JSON.parse(row.settings_json) }
}

function parseAttempt(row) {
  return {
    ...row,
    shown: JSON.parse(row.shown_json),
    response: JSON.parse(row.response_json),
    answer: JSON.parse(row.answer_json),
    rubric: row.rubric_json === null ? null : JSON.parse(row.rubric_json),
  }
}

export function insertStudent(data) {
  ensureStatements()
  const { id, display_name, avatar, grade, settings } = data
  return stmts.insertStudent.run(id, display_name, avatar, grade, JSON.stringify(settings || {}))
}

export function getStudentById(id) {
  ensureStatements()
  const row = stmts.getStudentById.get(id)
  return row ? parseStudent(row) : null
}

export function listStudents() {
  ensureStatements()
  return stmts.listStudents.all().map(parseStudent)
}

export function insertSession(data) {
  ensureStatements()
  const { id, student_id, kind, skill_id, local_date, tz } = data
  return stmts.insertSession.run(id, student_id, kind, skill_id || null, local_date, tz)
}

export function getSessionById(id) {
  ensureStatements()
  return stmts.getSessionById.get(id) || null
}

export function finishSession(id, result) {
  ensureStatements()
  const db = getDatabase()
  return db.transaction((sessionId, sessionResult) => {
    stmts.finishSession.run(JSON.stringify(sessionResult), sessionId)
    const session = stmts.getSessionById.get(sessionId)
    return session?.finish_result_json ? JSON.parse(session.finish_result_json) : null
  })(id, result)
}

export function insertSessionItem({ session_id, problem_id, seed }) {
  ensureStatements()
  return stmts.insertSessionItem.run(session_id, problem_id, seed)
}

export function getSessionItem(sessionId, problemId, seed) {
  ensureStatements()
  return stmts.getSessionItem.get(sessionId, problemId, seed) || null
}

export function incrementSessionItemTries(sessionId, problemId, seed) {
  ensureStatements()
  return stmts.incrementSessionItemTries.run(sessionId, problemId, seed)
}

export function incrementSessionItemHints(sessionId, problemId, seed) {
  ensureStatements()
  return stmts.incrementSessionItemHints.run(sessionId, problemId, seed)
}

export function markSessionItemRevealed(sessionId, problemId, seed) {
  ensureStatements()
  return stmts.markSessionItemRevealed.run(sessionId, problemId, seed)
}

export function markSessionItemDone(sessionId, problemId, seed) {
  ensureStatements()
  return stmts.markSessionItemDone.run(sessionId, problemId, seed)
}

export function insertAttempt(data) {
  ensureStatements()
  const {
    id, session_id, student_id, subject, grade, skill_id, problem_id, content_version,
    seed, difficulty, shown, response, answer, correct, tries, hints_used, revealed, stars,
    rubric, duration_ms, local_date,
  } = data
  return stmts.insertAttempt.run(
    id, session_id, student_id, subject, grade, skill_id, problem_id, content_version,
    seed, difficulty, JSON.stringify(shown), JSON.stringify(response), JSON.stringify(answer),
    correct ? 1 : 0, tries, hints_used, revealed, stars,
    rubric == null ? null : JSON.stringify(rubric), duration_ms, local_date,
  )
}

export function getAttemptsBySession(sessionId) {
  ensureStatements()
  return stmts.getAttemptsBySession.all(sessionId).map(parseAttempt)
}

export function getAttemptsByStudentDay(studentId, localDate) {
  ensureStatements()
  return stmts.getAttemptsByStudentDay.all(studentId, localDate).map(parseAttempt)
}

export function getAttemptsByStudent(studentId) {
  return getDatabase().prepare(`
    SELECT * FROM attempts WHERE student_id = ? ORDER BY local_date DESC, created_at DESC
  `).all(studentId).map(parseAttempt)
}

export function getOwnedDecorations(studentId) {
  return getDatabase().prepare(`
    SELECT decoration_id AS id, purchase_cost AS price
    FROM student_decorations WHERE student_id = ? ORDER BY purchased_at, decoration_id
  `).all(studentId)
}

export function getSunshineBalance(studentId) {
  const result = getDatabase().prepare(`
    SELECT
      COALESCE((SELECT SUM(stars) FROM attempts WHERE student_id = ? AND correct = 1 AND revealed = 0), 0)
      - COALESCE((SELECT SUM(purchase_cost) FROM student_decorations WHERE student_id = ?), 0) AS balance
  `).get(studentId, studentId)
  return result.balance
}

export function purchaseDecoration({ studentId, decorationId, price }) {
  if (!Number.isSafeInteger(price) || price <= 0) throw new TypeError('price must be a positive integer')
  const db = getDatabase()
  return db.transaction(() => {
    if (!db.prepare('SELECT 1 FROM students WHERE id = ?').get(studentId)) return 'student-not-found'
    if (db.prepare('SELECT 1 FROM student_decorations WHERE student_id = ? AND decoration_id = ?').get(studentId, decorationId)) return 'already-owned'
    const balance = getSunshineBalance(studentId)
    if (balance < price) return 'insufficient-sunshine'
    db.prepare(`
      INSERT INTO student_decorations (student_id, decoration_id, purchase_cost) VALUES (?, ?, ?)
    `).run(studentId, decorationId, price)
    return 'purchased'
  })()
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
    answers: JSON.parse(r.answers_json || '{}'),
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
  stmts.insertStudent = null
  stmts.getStudentById = null
  stmts.listStudents = null
  stmts.insertSession = null
  stmts.getSessionById = null
  stmts.finishSession = null
  stmts.insertSessionItem = null
  stmts.getSessionItem = null
  stmts.incrementSessionItemTries = null
  stmts.incrementSessionItemHints = null
  stmts.markSessionItemRevealed = null
  stmts.markSessionItemDone = null
  stmts.insertAttempt = null
  stmts.getAttemptsBySession = null
  stmts.getAttemptsByStudentDay = null

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
  stmts.insertStudent = null
  stmts.getStudentById = null
  stmts.listStudents = null
  stmts.insertSession = null
  stmts.getSessionById = null
  stmts.finishSession = null
  stmts.insertSessionItem = null
  stmts.getSessionItem = null
  stmts.incrementSessionItemTries = null
  stmts.incrementSessionItemHints = null
  stmts.markSessionItemRevealed = null
  stmts.markSessionItemDone = null
  stmts.insertAttempt = null
  stmts.getAttemptsBySession = null
  stmts.getAttemptsByStudentDay = null

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
    stmts.insertStudent = null
    stmts.getStudentById = null
    stmts.listStudents = null
    stmts.insertSession = null
    stmts.getSessionById = null
    stmts.finishSession = null
    stmts.insertSessionItem = null
    stmts.getSessionItem = null
    stmts.incrementSessionItemTries = null
    stmts.incrementSessionItemHints = null
    stmts.markSessionItemRevealed = null
    stmts.markSessionItemDone = null
    stmts.insertAttempt = null
    stmts.getAttemptsBySession = null
    stmts.getAttemptsByStudentDay = null
  }
}

export { getDatabase as _getDatabase, getDatabase }
