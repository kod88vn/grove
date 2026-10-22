import { listProblems, listSkills } from '@grove/curriculum'
import { finishSession as markSessionFinished, getAttemptsBySession, getAttemptsByStudent, getSessionById, getStudentById } from '../../../../../lib/db.js'
import { gardenSummary } from '../../../../../lib/kidExperience.js'

const stageOrder = { seed: 0, sprout: 1, sapling: 2 }

function growthForSession({ skills, attempts, sessionId, studentId }) {
  const prior = attempts.filter((attempt) => attempt.session_id !== sessionId)
  const after = attempts
  const beforeStages = gardenSummary({ skills, attempts: prior, studentId })
  const afterStages = gardenSummary({ skills, attempts: after, studentId })
  return afterStages.flatMap((grown) => {
    const before = beforeStages.find((stage) => stage.skillId === grown.skillId)
    if (stageOrder[grown.stage] <= stageOrder[before.stage]) return []
    return [{ skillId: grown.skillId, name: grown.name, from: before.stage, to: grown.stage }]
  })
}

function nextSuggestion({ grade, attempts, studentId }) {
  const skills = listSkills({ grade })
  const problems = listProblems({ grade })
  const priorSkills = new Set(attempts.filter((attempt) => attempt.student_id === studentId && attempt.correct === 1).map((attempt) => attempt.skill_id))
  const skill = skills
    .filter((entry) => problems.some((problem) => problem.skill === entry.id && !problem.boss))
    .sort((left, right) => Number(priorSkills.has(left.id)) - Number(priorSkills.has(right.id)) || left.id.localeCompare(right.id))[0]
  if (!skill) return null
  const problem = problems.find((entry) => entry.skill === skill.id && !entry.boss)
  return problem ? { id: skill.id, label: skill.label || skill.name, problemId: problem.id } : null
}

export async function POST(_request, { params }) {
  const { id } = await params
  const session = getSessionById(id)
  if (!session) return Response.json({ error: 'Session not found' }, { status: 404 })
  if (session.finished_at !== null) {
    if (!session.finish_result_json) {
      return Response.json({ error: 'Saved session result is unavailable' }, { status: 500 })
    }
    return Response.json(JSON.parse(session.finish_result_json))
  }

  const student = getStudentById(session.student_id)
  if (!student) return Response.json({ error: 'Session student not found' }, { status: 400 })
  const attempts = getAttemptsByStudent(session.student_id)
  const sessionAttempts = getAttemptsBySession(id)
  const grew = growthForSession({
    skills: listSkills({ grade: student.grade }), attempts, sessionId: id, studentId: session.student_id,
  })
  const stars = sessionAttempts.reduce((total, attempt) => total + attempt.stars, 0)
  const next = nextSuggestion({ grade: student.grade, attempts, studentId: session.student_id })
  const result = { finished: true, stars, grew, next }
  const savedResult = markSessionFinished(id, result)
  if (!savedResult) {
    return Response.json({ error: 'Saved session result is unavailable' }, { status: 500 })
  }
  return Response.json(savedResult)
}