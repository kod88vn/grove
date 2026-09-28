import {
  getSessionItem,
  incrementSessionItemHints,
} from '../../../lib/db.js'
import { getProblem, hint, render } from '@grove/curriculum'

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

  const row = getSessionItem(body.sessionId, body.problemId, body.seed)
  if (!row) {
    return Response.json({ error: 'Session item is not bound' }, { status: 409 })
  }

  const rendered = render(getProblem(body.problemId), body.seed)
  const nextHint = hint(rendered, row.hints_used)
  if (nextHint === null) {
    return Response.json({ error: 'No hints remain' }, { status: 409 })
  }

  incrementSessionItemHints(body.sessionId, body.problemId, body.seed)
  return Response.json({ hint: nextHint, hintsUsed: row.hints_used + 1 })
}
