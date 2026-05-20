import {
  insertSubmission,
  insertReading,
  getAllSubmissions,
  getAllReadings,
} from './db.js'

// Record a graded submission to SQLite
export function recordSubmission(studentId, subject, type, exerciseData, score, maxScore, details) {
  const id = `${subject}-${Date.now()}`
  const percentage = maxScore ? Math.round((score / maxScore) * 100) : 0

  // Normalize exerciseData: could be a string (exerciseId), an object, or undefined
  const exercise = typeof exerciseData === 'string' ? { id: exerciseData, raw: null } : (exerciseData || {})

  // Extract student's actual answers from details, default to empty array
  const studentAnswers = (details && details.studentAnswers) || []

  insertSubmission({
    id,
    student_id: studentId || 'public',
    subject,
    type,
    exercise,
    answers: studentAnswers,
    score,
    max_score: maxScore,
    percentage,
    feedback: (details && details.overallFeedback) || '',
    details,
  })

  return { id, percentage }
}

// Record a reading session to SQLite
export function recordReading(studentId, passage, questions, lessonKeyPoint, domain, score, maxScore) {
  const id = `reading-${Date.now()}`
  const percentage = maxScore ? Math.round((score / maxScore) * 100) : null

  insertReading({
    id,
    student_id: studentId || 'public',
    passage,
    questions,
    lesson_key_point: lessonKeyPoint,
    domain: domain || 'random',
    score,
    max_score: maxScore,
    percentage,
  })

  return id
}

// Get all submissions for a given date range (ms timestamps)
export function getSubmissions(startDateMs, endDateMs) {
  return getAllSubmissions(startDateMs, endDateMs)
}

// Get all readings for a given date range (ms timestamps)
export function getReadings(startDateMs, endDateMs) {
  return getAllReadings(startDateMs, endDateMs)
}

// Get submissions for a specific day (date string like "2026-05-19")
export function getSubmissionsForDay(dayStr) {
  const date = new Date(dayStr + 'T00:00:00Z')
  const start = date.getTime()
  const end = start + 86400 * 1000
  return getAllSubmissions(start, end)
}

// Get readings for a specific day
export function getReadingsForDay(dayStr) {
  const date = new Date(dayStr + 'T00:00:00Z')
  const start = date.getTime()
  const end = start + 86400 * 1000
  return getAllReadings(start, end)
}

// Get all submissions (no date filter) - for review page
export function getAll() {
  const now = Date.now()
  // Default: last 30 days
  const thirtyDaysAgo = now - 30 * 86400 * 1000
  return getAllSubmissions(thirtyDaysAgo, now)
}

// Get all readings (no date filter) - for review page
export function getAllReadingsUnbounded() {
  const now = Date.now()
  const thirtyDaysAgo = now - 30 * 86400 * 1000
  return getAllReadings(thirtyDaysAgo, now)
}

// Get list of unique days with submissions
export function getActiveDays() {
  const now = new Date()
  const days = []
  for (let i = 0; i < 30; i++) {
    const d = new Date(now)
    d.setDate(d.getDate() - i)
    days.push(d.toISOString().split('T')[0])
  }
  return days
}