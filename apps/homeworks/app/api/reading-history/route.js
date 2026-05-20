import { recordReading, getReadingsForDay } from '../../../lib/progress.js'

export async function GET(request) {
  const { searchParams } = new URL(request.url)
  const day = searchParams.get('day')

  try {
    if (day) {
      const history = getReadingsForDay(day)
      return Response.json({ history, total: history.length })
    }

    // Default: last 30 days of readings from SQLite
    const now = Date.now()
    const thirtyDaysAgo = now - 30 * 86400 * 1000
    const { getAllReadingsUnbounded } = await import('../../../lib/progress.js')
    const history = getAllReadingsUnbounded()
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

  const { passage, questions, lessonKeyPoint, domain, score, maxScore } = body || {}

  try {
    const id = recordReading(
      'public',
      passage, questions, lessonKeyPoint, domain, score, maxScore
    )
    return Response.json({ id })
  } catch (error) {
    return Response.json(
      { error: error instanceof Error ? error.message : 'Failed to save reading' },
      { status: 502 }
    )
  }
}