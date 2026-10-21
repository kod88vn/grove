import { getProblem, listProblems, listSkills } from '@grove/curriculum'
import { getAttemptsByStudent, getDatabase, getOwnedDecorations, getStudentById, getSunshineBalance } from '../../../lib/db.js'
import { DECORATIONS } from '../../../lib/decorations.js'
import { gardenSummary, questList, rewardSummary, wateringSummary } from '../../../lib/kidExperience.js'
import { getSkillStates } from '../../../lib/mastery.js'

function isCalendarDate(value) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value ?? '')) return false
  const date = new Date(`${value}T00:00:00.000Z`)
  return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value
}

function findContinueSession(studentId) {
  const item = getDatabase().prepare(`
    SELECT sessions.id AS session_id, sessions.skill_id, items.problem_id
    FROM practice_sessions AS sessions
    JOIN session_items AS items ON items.session_id = sessions.id
    WHERE sessions.student_id = ? AND sessions.finished_at IS NULL AND items.done = 0
    ORDER BY sessions.started_at DESC, items.rowid DESC
    LIMIT 1
  `).get(studentId)
  if (!item) return null
  const problem = getProblem(item.problem_id)
  if (!problem || (item.skill_id && item.skill_id !== problem.skill)) return null
  return { sessionId: item.session_id, skillId: item.skill_id || problem.skill, problemId: problem.id }
}

export async function GET(request) {
  const params = new URL(request.url).searchParams
  for (const key of params.keys()) {
    if (!['studentId', 'date'].includes(key)) return Response.json({ error: `Unsupported parameter: ${key}` }, { status: 400 })
  }
  const studentId = params.get('studentId')
  const date = params.get('date')
  if (!studentId) return Response.json({ error: 'studentId is required' }, { status: 400 })
  const student = getStudentById(studentId)
  if (!student) return Response.json({ error: 'Student not found' }, { status: 404 })
  if (!isCalendarDate(date)) return Response.json({ error: 'date must be a valid YYYY-MM-DD calendar date' }, { status: 400 })

  const attempts = getAttemptsByStudent(studentId)
  const sessionItems = getDatabase().prepare(`
    SELECT items.problem_id, items.tries, items.done
    FROM session_items AS items
    JOIN practice_sessions AS sessions ON sessions.id = items.session_id
    WHERE sessions.student_id = ?
  `).all(studentId)
  const rewards = { ...rewardSummary({ attempts, studentId }), sunshine: getSunshineBalance(studentId) }
  const watering = wateringSummary({ attempts, studentId, today: date })
  const skills = listSkills({ grade: student.grade })
  const problems = listProblems({ grade: student.grade })
  const statuses = Object.fromEntries(problems.map((problem) => [problem.id, 'untried']))
  for (const item of sessionItems) {
    if (item.tries > 0) statuses[item.problem_id] = item.done === 1 ? 'solved' : 'attempted'
  }
  for (const attempt of attempts) if (attempt.correct === 1) statuses[attempt.problem_id] = 'solved'
  const solvedAttempts = attempts.filter((attempt) => attempt.correct === 1 && attempt.revealed !== 1)
  const solvedSkills = new Set(solvedAttempts.map((attempt) => attempt.skill_id))
  const badges = []
  if (solvedAttempts.length) badges.push({ id: 'first-solve', label: 'First Quest', earned: true })
  if (rewards.stars >= 5) badges.push({ id: 'five-stars', label: 'Five Stars', earned: true })
  if (watering.weeklyGoalMet) badges.push({ id: 'watering-week', label: 'Watering Week', earned: true })
  const suggestions = skills.filter((skill) => problems.some((problem) => problem.skill === skill.id))
    .sort((left, right) => Number(solvedSkills.has(left.id)) - Number(solvedSkills.has(right.id)))
    .slice(0, 2)

  // P4.5: for tried skills the mastery fold (U05) owns the stage — ladder and
  // Leitner-derived, so a tree/fruiting is real. Untried skills keep the
  // presentation heuristic, which agrees with the fold up to sapling.
  const states = new Map(getSkillStates(studentId).map((state) => [state.skillId, state]))
  const garden = gardenSummary({ skills, attempts, studentId }).map((entry) => {
    const state = states.get(entry.skillId)
    return state ? { ...entry, stage: state.stage, level: state.level, box: state.box, dueDate: state.dueDate, attempts: state.attempts, correct: state.correct } : entry
  })

  return Response.json({
    student: { id: student.id, displayName: student.display_name, avatar: student.avatar, grade: student.grade },
    rewards,
    decorations: {
      catalog: DECORATIONS,
      owned: getOwnedDecorations(studentId).map(({ id }) => DECORATIONS.find((item) => item.id === id)).filter(Boolean),
    },
    watering,
    badges,
    garden,
    suggestions,
    problems,
    statuses,
    continueSession: findContinueSession(studentId),
    questCount: questList({ problems, grade: student.grade, studentId, attempts, sessionItems }).length,
  })
}