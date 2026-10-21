import { randomUUID } from 'node:crypto'
import {
  getSessionById,
  getSessionItem,
  incrementSessionItemTries,
  insertAttempt,
  markSessionItemDone,
} from '../../../lib/db.js'
import { check, getProblem, listProblems, render, toInstance } from '@grove/curriculum'
import { refreshSkillState } from '../../../lib/mastery.js'

export async function POST(request) {
  let body
  try {
    body = await request.json()
  } catch {
    return Response.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  const isPlainObject = body !== null && typeof body === 'object' && !Array.isArray(body)
  if (!isPlainObject) {
    return Response.json({ error: 'Body must be a plain object' }, { status: 400 })
  }

  if (typeof body.sessionId !== 'string' || body.sessionId.trim().length === 0) {
    return Response.json({ error: 'sessionId must be a non-empty string' }, { status: 400 })
  }

  if (typeof body.problemId !== 'string' || body.problemId.trim().length === 0) {
    return Response.json({ error: 'problemId must be a non-empty string' }, { status: 400 })
  }

  if (!Number.isInteger(body.seed) || body.seed < 0) {
    return Response.json({ error: 'seed must be a non-negative integer' }, { status: 400 })
  }

  if (!Object.prototype.hasOwnProperty.call(body, 'response')) {
    return Response.json({ error: 'response is required' }, { status: 400 })
  }

  if (body.durationMs !== undefined && (!Number.isInteger(body.durationMs) || body.durationMs < 0)) {
    return Response.json({ error: 'durationMs must be a non-negative integer' }, { status: 400 })
  }

  const session = getSessionById(body.sessionId)
  if (session && session.finished_at !== null) {
    return Response.json({ error: 'Session is already finished' }, { status: 409 })
  }

  const row = getSessionItem(body.sessionId, body.problemId, body.seed)
  if (!row) {
    return Response.json({ error: 'Session item is not bound' }, { status: 409 })
  }

  if (row.done === 1) {
    return Response.json({ error: 'Session item is already done' }, { status: 409 })
  }

  const rendered = render(getProblem(body.problemId), body.seed)
  const result = check(rendered.widget, rendered.answer, body.response)
  if (result.reason === 'invalid') {
    return Response.json({ error: 'Response is invalid' }, { status: 400 })
  }

  incrementSessionItemTries(body.sessionId, body.problemId, body.seed)
  const current = getSessionItem(body.sessionId, body.problemId, body.seed)
  const stars = !result.correct
    ? 0
    : current.tries === 1 && current.hints_used === 0
      ? 3
      : current.tries <= 2 && current.hints_used <= 1
        ? 2
        : 1

  if (result.correct) {
    const metadata = listProblems().find((problem) => problem.id === body.problemId)
    markSessionItemDone(body.sessionId, body.problemId, body.seed)
    insertAttempt({
      id: randomUUID(),
      session_id: body.sessionId,
      student_id: session.student_id,
      subject: metadata.subject,
      grade: metadata.grade,
      skill_id: metadata.skill,
      content_version: metadata.version,
      problem_id: body.problemId,
      seed: body.seed,
      difficulty: rendered.difficulty,
      shown: toInstance(rendered),
      response: body.response,
      answer: rendered.answer,
      correct: true,
      tries: current.tries,
      hints_used: current.hints_used,
      revealed: current.revealed,
      stars,
      rubric: null,
      duration_ms: body.durationMs ?? null,
      local_date: session.local_date,
    })

    return Response.json({
      correct: true,
      stars,
      feedback: 'Great work!',
      explanation: rendered.explanation,
      // P4.1: the fold re-derives the skill after the row is stored, so the
      // kid's new stage/box/next-due comes back with the answer they just gave.
      skillState: refreshSkillState(session.student_id, metadata.skill),
    })
  }

  // Wrong answers store no row, so the fold returns the state as-is (null when
  // the skill has nothing stored yet) — the kid sees their standing, not a 400.
  return Response.json({
    correct: false,
    stars,
    feedback: 'Keep going—you can try again!',
    skillState: refreshSkillState(session.student_id, rendered.skill),
  })
}
