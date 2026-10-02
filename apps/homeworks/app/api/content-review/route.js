import { recordDraftDecision } from '@/lib/contentReview'

export async function POST(request) {
  if (process.env.NODE_ENV === 'production') {
    return Response.json({ error: 'Not found' }, { status: 404 })
  }
  let body
  try {
    body = await request.json()
  } catch {
    return Response.json({ error: 'Invalid JSON body' }, { status: 400 })
  }
  try {
    const result = await recordDraftDecision(body || {})
    return Response.json({ reviewer: result.reviewer, decision: result.decision, id: result.id })
  } catch (error) {
    return Response.json({ error: error.message || 'Review decision failed' }, { status: 400 })
  }
}