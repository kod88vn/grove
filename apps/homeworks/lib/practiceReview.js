import { getAttemptsBySession, getDatabase } from './db.js'
import { getProblem, render, toInstance } from '@grove/curriculum'

function itemKey(problemId, seed) {
  return `${problemId}:${seed}`
}

function getPracticeSessions({ studentId, localDate } = {}) {
  const clauses = []
  const values = []
  if (studentId) {
    clauses.push('student_id = ?')
    values.push(studentId)
  }
  if (localDate) {
    clauses.push('local_date = ?')
    values.push(localDate)
  }
  const where = clauses.length ? `WHERE ${clauses.join(' AND ')}` : ''
  return getDatabase().prepare(`
    SELECT * FROM practice_sessions ${where} ORDER BY local_date DESC, started_at DESC
  `).all(...values)
}

function getSessionItemsBySession(sessionId) {
  return getDatabase().prepare(`
    SELECT * FROM session_items WHERE session_id = ? ORDER BY rowid ASC
  `).all(sessionId)
}

function reviewItem(session, item, attempts) {
  const attempt = attempts.get(itemKey(item.problem_id, item.seed))
  if (attempt) {
    return {
      sessionId: session.id,
      problemId: item.problem_id,
      seed: item.seed,
      solved: true,
      tries: attempt.tries,
      hintsUsed: attempt.hints_used,
      stars: attempt.stars,
      shown: attempt.shown,
      response: attempt.response,
      answer: attempt.answer,
    }
  }

  const rendered = render(getProblem(item.problem_id), item.seed)
  return {
    sessionId: session.id,
    problemId: item.problem_id,
    seed: item.seed,
    solved: false,
    tries: item.tries,
    hintsUsed: item.hints_used,
    stars: 0,
    shown: { ...toInstance(rendered), visual: rendered.visual },
    response: null,
    answer: rendered.answer,
  }
}

function reviewSession(session) {
  const attempts = new Map(
    getAttemptsBySession(session.id).map((attempt) => [itemKey(attempt.problem_id, attempt.seed), attempt])
  )
  return getSessionItemsBySession(session.id).map((item) => reviewItem(session, item, attempts))
}

function sessionsForReview(options) {
  const sessions = getPracticeSessions(options)
  if (options?.localDate) return sessions
  const cutoff = (Date.now() - 30 * 86400 * 1000) / 1000
  return sessions.filter((session) => session.started_at >= cutoff)
}

export function getPracticeForDay(localDate, studentId) {
  return sessionsForReview({ localDate, studentId }).flatMap(reviewSession)
}

export function getAllPractice(studentId) {
  return sessionsForReview({ studentId }).map((session) => ({
    date: session.local_date,
    practice: reviewSession(session),
  }))
}
