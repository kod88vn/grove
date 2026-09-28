import { randomUUID } from 'node:crypto'

import { getStudentById, insertSession } from '../../../lib/db.js'
import { isValidTimeZone } from '../../../lib/localDay.js'

function isLeapYear(year) {
  return (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0
}

function daysInMonth(year, month) {
  return [31, isLeapYear(year) ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31][month - 1]
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

  if (typeof body.studentId !== 'string' || body.studentId.trim().length === 0) {
    return Response.json({ error: 'studentId must be a non-empty string' }, { status: 400 })
  }

  if (!getStudentById(body.studentId)) {
    return Response.json({ error: 'studentId must identify an existing student' }, { status: 400 })
  }

  const kinds = ['daily', 'skill', 'review', 'path', 'free']
  if (!kinds.includes(body.kind)) {
    return Response.json({ error: 'kind must be one of daily, skill, review, path, free' }, { status: 400 })
  }

  const dateMatch = typeof body.localDate === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(body.localDate)
  if (!dateMatch) {
    return Response.json({ error: 'localDate must be a valid YYYY-MM-DD date' }, { status: 400 })
  }

  const [, year, month, day] = body.localDate.match(/^(\d{4})-(\d{2})-(\d{2})$/)
  if (Number(month) < 1 || Number(month) > 12 || Number(day) < 1 || Number(day) > 31) {
    return Response.json({ error: 'localDate must be a valid YYYY-MM-DD date' }, { status: 400 })
  }

  if (Number(day) > daysInMonth(Number(year), Number(month))) {
    return Response.json({ error: 'localDate must be a valid YYYY-MM-DD date' }, { status: 400 })
  }

  if (!isValidTimeZone(body.tz) || /^[+-]/.test(body.tz)) {
    return Response.json({ error: 'tz must be a valid time zone' }, { status: 400 })
  }

  if (Object.prototype.hasOwnProperty.call(body, 'skillId') &&
    (typeof body.skillId !== 'string' || body.skillId.trim().length === 0)) {
    return Response.json({ error: 'skillId must be a non-empty string when provided' }, { status: 400 })
  }

  const sessionId = randomUUID()
  insertSession({
    id: sessionId,
    student_id: body.studentId,
    kind: body.kind,
    skill_id: body.skillId ?? null,
    local_date: body.localDate,
    tz: body.tz,
  })

  return Response.json({ sessionId }, { status: 201 })
}
