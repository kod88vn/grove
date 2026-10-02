import {
  getSessionById,
  getStudentById,
  getSessionItem,
  getDatabase,
  insertSessionItem,
} from '../../../../../lib/db.js'
import { getProblem, render, toInstance } from '@grove/curriculum'
import { dailyChallenge } from '../../../../../lib/kidExperience.js'

const MAX_SEED = 2147483647

function hashSeed(value) {
  let hash = 2166136261
  for (const character of value) {
    hash ^= character.charCodeAt(0)
    hash = Math.imul(hash, 16777619) >>> 0
  }
  return hash % (MAX_SEED + 1)
}

function addDailyItem({ id, session, student, problem }) {
  const challenge = dailyChallenge({ grade: student.grade, localDate: session.local_date })
  if (!challenge || session.skill_id !== challenge.problem.skill || problem.id !== challenge.problem.id) {
    return Response.json({ error: 'Problem does not match the canonical Daily Seed' }, { status: 400 })
  }
  if (!getSessionItem(id, problem.id, challenge.seed)) {
    insertSessionItem({ session_id: id, problem_id: problem.id, seed: challenge.seed })
  }
  return Response.json({ seed: challenge.seed, instance: toInstance(render(problem, challenge.seed)) }, { status: 201 })
}

function existingOpenItem(id, problem) {
  const item = getDatabase().prepare(`
    SELECT seed FROM session_items
    WHERE session_id = ? AND problem_id = ? AND done = 0
    ORDER BY rowid DESC LIMIT 1
  `).get(id, problem.id)
  return item ? { seed: item.seed, instance: toInstance(render(problem, item.seed)) } : null
}

export async function POST(request, { params }) {
  const { id } = await params
  const session = getSessionById(id)
  if (!session) return Response.json({ error: 'Session not found' }, { status: 404 })
  if (session.finished_at !== null) {
    return Response.json({ error: 'Session is already finished' }, { status: 409 })
  }

  let body
  try {
    body = await request.json()
  } catch {
    return Response.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  const isPlainObject = body !== null && typeof body === 'object' &&
    !Array.isArray(body) && Object.getPrototypeOf(body) === Object.prototype
  if (!isPlainObject) {
    return Response.json({ error: 'Body must be a plain object' }, { status: 400 })
  }

  if (Object.prototype.hasOwnProperty.call(body, 'seed') ||
    Object.prototype.hasOwnProperty.call(body, 'tries')) {
    return Response.json({ error: 'seed and tries must not be provided' }, { status: 400 })
  }

  if (typeof body.problemId !== 'string' || body.problemId.trim().length === 0) {
    return Response.json({ error: 'problemId must be a non-empty string' }, { status: 400 })
  }

  const problem = getProblem(body.problemId)
  if (!problem) return Response.json({ error: 'Problem not found' }, { status: 400 })

  const student = getStudentById(session.student_id)
  if (!student) return Response.json({ error: 'Session student not found' }, { status: 400 })

  if (session.kind === 'daily') return addDailyItem({ id, session, student, problem })

  const open = existingOpenItem(id, problem)
  if (open) return Response.json(open, { status: 201 })

  const base = `${student.grade}:${session.local_date}:${body.problemId}`
  let attempt = 0
  let seed = hashSeed(base)
  while (getSessionItem(id, body.problemId, seed)) {
    attempt += 1
    seed = hashSeed(`${base}:${attempt}`)
  }

  insertSessionItem({ session_id: id, problem_id: body.problemId, seed })
  const instance = toInstance(render(problem, seed))
  return Response.json({ seed, instance }, { status: 201 })
}