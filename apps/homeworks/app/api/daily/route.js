import { render, toInstance } from '@grove/curriculum'
import { dailyChallenge } from '../../../lib/kidExperience.js'

function validDate(value) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value ?? '')) return false
  const date = new Date(`${value}T00:00:00.000Z`)
  return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value
}

export async function GET(request) {
  const params = new URL(request.url).searchParams
  for (const key of params.keys()) {
    if (!['grade', 'date'].includes(key)) return Response.json({ error: `Unsupported parameter: ${key}` }, { status: 400 })
  }
  const gradeText = params.get('grade')
  const grade = Number(gradeText)
  const localDate = params.get('date')
  if (!/^\d+$/.test(gradeText ?? '') || !Number.isInteger(grade) || grade < 1 || grade > 12) {
    return Response.json({ error: 'grade must be an integer from 1 to 12' }, { status: 400 })
  }
  if (!validDate(localDate)) return Response.json({ error: 'date must be a valid YYYY-MM-DD date' }, { status: 400 })

  const challenge = dailyChallenge({ grade, localDate })
  if (!challenge) return Response.json({ error: 'No registered problems for this grade' }, { status: 404 })
  const { problem, seed } = challenge
  return Response.json({ problemId: problem.id, seed, instance: toInstance(render(problem, seed)) })
}