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
    return Response.json(
      { error: error.message || 'Failed to generate exercise' },
      { status: 500 }
    )
  }
}
