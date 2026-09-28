import {
  getSessionById,
  getStudentById,
  getSessionItem,
  insertSessionItem,
} from '../../../../../lib/db.js'
import { getProblem, render, toInstance } from '@grove/curriculum'

const MAX_SEED = 2147483647

function hashSeed(value) {
  let hash = 2166136261
  for (const character of value) {
    hash ^= character.charCodeAt(0)
    hash = Math.imul(hash, 16777619) >>> 0
  }
  return hash % (MAX_SEED + 1)
}

export async function POST(request, { params }) {
  const { id } = await params
  const session = getSessionById(id)
  if (!session) return Response.json({ error: 'Session not found' }, { status: 404 })

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