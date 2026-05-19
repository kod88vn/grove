import { getReadingHistory, recordReading } from '../../../lib/progress'

export async function GET(request) {
  const { searchParams } = new URL(request.url)
  const studentId = searchParams.get('studentId') || 'default'

  try {
    const history = getReadingHistory(studentId)
    return Response.json({ history, total: history.length })
  } catch (error) {
    return Response.json(
      { error: error instanceof Error ? error.message : 'Failed to fetch reading history' },
      { status: 502 }
    )
  }
}

export async function POST(request) {
  let body
  try {
    body = await request.json()
  } catch {
    return Response.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  const { studentId, passage, questions, lessonKeyPoint, domain, score, maxScore } = body || {}

  try {
    const history = recordReading(studentId || 'default', passage, questions, lessonKeyPoint, domain, score, maxScore)
    return Response.json({ history: history.slice(-1)[0], total: history.length })
  } catch (error) {
    return Response.json(
      { error: error instanceof Error ? error.message : 'Failed to save reading' },
      { status: 502 }
    )
  }
}