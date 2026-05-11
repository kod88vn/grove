import { generateExercise } from '../../../lib/ollama'

export async function GET(request) {
  const { searchParams } = new URL(request.url)
  const subject = searchParams.get('subject') // 'english' or 'math'
  const type = searchParams.get('type') // e.g., 'reading', 'mixed'

  if (!subject || !type) {
    return Response.json(
      { error: 'Missing subject or type parameter' },
      { status: 400 }
    )
  }

  try {
    const exercise = await generateExercise(type, subject)
    return Response.json({
      subject,
      type,
      exercise,
      generatedAt: new Date().toISOString(),
    })
  } catch (error) {
    console.error('Exercise generation error:', error)
    const message = error instanceof Error ? error.message : 'Failed to generate exercise'
    const isTimeout = message.includes('timeout')
    const upstreamStatusMatch = message.match(/Nora API error\s+(\d{3})/)
    const upstreamStatus = upstreamStatusMatch ? Number(upstreamStatusMatch[1]) : 0

    let status = 500
    if (isTimeout) {
      status = 504
    } else if (upstreamStatus >= 400 && upstreamStatus <= 599) {
      status = upstreamStatus
    }

    return Response.json(
      { error: message },
      { status }
    )
  }
}
