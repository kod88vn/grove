import { getSubmissionsForDay, getReadingsForDay } from '../../../lib/progress.js'
import { isValidTimeZone, localDateOf } from '../../../lib/localDay.js'

export async function GET(request) {
  const { searchParams } = new URL(request.url)
  const day = searchParams.get('day')
  // Days are the viewer's calendar days; without a zone they are UTC days.
  const tz = searchParams.get('tz') ?? 'UTC'
  if (!isValidTimeZone(tz)) {
    return Response.json({ error: `Unknown time zone: ${tz}` }, { status: 400 })
  }

  try {
    if (day) {
      const submissions = getSubmissionsForDay(day, tz)
      const readings = getReadingsForDay(day, tz)
      return Response.json({ submissions, readings })
    }

    // Default: last 30 days grouped by day
    const { getAll, getAllReadingsUnbounded } = await import('../../../lib/progress.js')
    const submissions = getAll()
    const readings = getAllReadingsUnbounded()

    // Group by day
    const byDay = {}
    for (const s of submissions) {
      const d = localDateOf(s.date, tz)
      if (!byDay[d]) byDay[d] = { date: d, submissions: [], readings: [] }
      byDay[d].submissions.push(s)
    }
    for (const r of readings) {
      const d = localDateOf(r.date, tz)
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