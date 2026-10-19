import { findDecoration } from '../../../lib/decorations.js'
import { purchaseDecoration } from '../../../lib/db.js'

const allowedFields = new Set(['studentId', 'decorationId'])

function invalidBody(body) {
  return !body || typeof body !== 'object' || Array.isArray(body)
    || Object.keys(body).some((key) => !allowedFields.has(key))
    || typeof body.studentId !== 'string' || !body.studentId
    || typeof body.decorationId !== 'string' || !body.decorationId
}

export async function POST(request) {
  let body
  try {
    body = await request.json()
  } catch {
    return Response.json({ error: 'Request body must be valid JSON' }, { status: 400 })
  }
  if (invalidBody(body)) return Response.json({ error: 'studentId and decorationId are required' }, { status: 400 })
  const decoration = findDecoration(body.decorationId)
  if (!decoration) return Response.json({ error: 'Decoration not found' }, { status: 404 })

  const result = purchaseDecoration({
    studentId: body.studentId,
    decorationId: decoration.id,
    price: decoration.price,
  })
  if (result === 'student-not-found') return Response.json({ error: 'Student not found' }, { status: 404 })
  if (result === 'already-owned') return Response.json({ error: 'Decoration already owned' }, { status: 409 })
  if (result === 'insufficient-sunshine') return Response.json({ error: 'Not enough Sunshine' }, { status: 409 })
  return Response.json({ purchased: decoration }, { status: 201 })
}
