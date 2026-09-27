import { randomUUID } from 'node:crypto'

import { getStudentById, insertStudent, listStudents } from '../../../lib/db.js'

export async function GET() {
  return Response.json({ students: listStudents() })
}

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

  if (Object.prototype.hasOwnProperty.call(body, 'id')) {
    return Response.json({ error: 'id must not be provided' }, { status: 400 })
  }

  if (typeof body.displayName !== 'string' || body.displayName.trim().length === 0) {
    return Response.json({ error: 'displayName must be a non-empty string' }, { status: 400 })
  }

  if (typeof body.avatar !== 'string' || body.avatar.length === 0) {
    return Response.json({ error: 'avatar must be a non-empty string' }, { status: 400 })
  }

  if (!Number.isInteger(body.grade) || body.grade < 1 || body.grade > 12) {
    return Response.json({ error: 'grade must be an integer between 1 and 12' }, { status: 400 })
  }

  const id = randomUUID()
  insertStudent({
    id,
    display_name: body.displayName.trim(),
    avatar: body.avatar,
    grade: body.grade,
    settings: {},
  })

  return Response.json({ student: getStudentById(id) }, { status: 201 })
}
