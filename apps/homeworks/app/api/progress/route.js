import { getProgressStats } from '../../../lib/progress'

export async function GET(request) {
  try {
    const stats = getProgressStats('default')
    return Response.json(stats)
  } catch (error) {
    console.error('Progress stats error:', error)
    return Response.json(
      { error: error.message || 'Failed to get progress' },
      { status: 500 }
    )
  }
}
