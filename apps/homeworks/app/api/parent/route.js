import { getProgressStats, getReadingHistory } from '../../../lib/progress'

export async function GET(request) {
  try {
    const stats = getProgressStats('default')

    // Aggregate parent-friendly data
    const allSubmissions = [
      ...(stats.english?.recentSubmissions || []),
      ...(stats.math?.recentSubmissions || []),
    ].sort((a, b) => new Date(b.date) - new Date(a.date))

    const recentReadings = (stats.readingHistory || []).slice(0, 20)

    return Response.json({
      studentId: stats.studentId,
      allSubmissions: allSubmissions.slice(0, 20),
      englishSummary: stats.english,
      mathSummary: stats.math,
      readingHistory: recentReadings,
      totalSubmissions: allSubmissions.length,
    })
  } catch (error) {
    return Response.json(
      { error: error instanceof Error ? error.message : 'Failed to fetch parent data' },
      { status: 502 }
    )
  }
}

export async function POST(request) {
  // This endpoint could be extended to allow parent notifications or notes
  return Response.json({ message: 'Parent API active' })
}