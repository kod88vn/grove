import { getReadingById } from '../../../../lib/progress'

export async function GET(request, { params }) {
  const resolvedParams = await params
  const { searchParams } = new URL(request.url)
  const studentId = searchParams.get('studentId') || 'default'

  try {
    const reading = getReadingById(studentId, resolvedParams.id)
    if (!reading) {
      return Response.json({ error: 'Reading not found' }, { status: 404 })
    }
    return Response.json(reading)
  } catch (error) {
    return Response.json(
      { error: error instanceof Error ? error.message : 'Failed to fetch reading' },
      { status: 502 }
    )
  }
}