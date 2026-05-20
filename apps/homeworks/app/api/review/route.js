import { getSubmissionsForDay, getReadingsForDay } from '../../../lib/progress.js'

export async function GET(request) {
  const { searchParams } = new URL(request.url)
  const day = searchParams.get('day')

  try {
    if (day) {
      const submissions = getSubmissionsForDay(day)
      const readings = getReadingsForDay(day)
      return Response.json({ submissions, readings })
    }

    // Default: last 30 days grouped by day
    const { getAll, getAllReadingsUnbounded } = await import('../../../lib/progress.js')
    const submissions = getAll()
    const readings = getAllReadingsUnbounded()

    // Group by day
    const byDay = {}
    for (const s of submissions) {
      const d = s.date.split('T')[0]
      if (!byDay[d]) byDay[d] = { date: d, submissions: [], readings: [] }
      byDay[d].submissions.push(s)
    }
    for (const r of readings) {
      const d = r.date.split('T')[0]
      if (!byDay[d]) byDay[d] = { date: d, submissions: [], readings: [] }
      byDay[d].readings.push(r)
    }

    const days = Object.values(byDay).sort((a, b) => b.date.localeCompare(a.date))
    return Response.json({ days })
  } catch (error) {
    console.error('Review API error:', error)
    return Response.json(
      { error: error instanceof Error ? error.message : 'Failed to fetch review data' },
      { status: 502 }
    )
  }
}