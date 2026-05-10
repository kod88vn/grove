import { gradeSubmission } from '../../../lib/ollama'
import { recordSubmission } from '../../../lib/progress'

export async function POST(request) {
  const body = await request.json()
  const { subject, type, exercise, answers } = body

  if (!subject || !type || !exercise || !answers) {
    return Response.json(
      { error: 'Missing required fields' },
      { status: 400 }
    )
  }

  try {
    // Grade the submission
    const gradeResult = await gradeSubmission(type, subject, exercise, answers)

    // Calculate total score
    let score = 0
    let maxScore = 0

    if (subject === 'english') {
      if (type === 'reading') {
        // Sum scores from individual answers
        score = gradeResult.answers?.reduce((sum, a) => sum + (a.score || 0), 0) || 0
        maxScore = gradeResult.maxScore || 5
      } else if (type === 'writing') {
        // Sum criteria scores
        score = gradeResult.criteria?.reduce((sum, c) => sum + (c.score || 0), 0) || 0
        maxScore = gradeResult.maxScore || 20
      }
    } else if (subject === 'math') {
      score = gradeResult.totalCorrect || 0
      maxScore = gradeResult.totalProblems || 3
    }

    // Record progress
    const progress = recordSubmission(
      'default', // studentId
      subject,
      type,
      `${subject}-${Date.now()}`,
      score,
      maxScore,
      gradeResult
    )

    return Response.json({
      subject,
      type,
      gradeResult,
      score,
      maxScore,
      percentage: Math.round((score / maxScore) * 100),
      progress,
      feedback: gradeResult.overallFeedback || gradeResult.comment || 'Good work!',
    })
  } catch (error) {
    console.error('Grading error:', error)
    return Response.json(
      { error: error.message || 'Failed to grade submission' },
      { status: 500 }
    )
  }
}
