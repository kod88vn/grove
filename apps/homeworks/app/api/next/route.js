/**
 * P4.4 — GET /homeworks/api/next.
 *
 * The kid's mastery view in one call: what to play right now (`next`), the full
 * queue of spaced reviews whose day has arrived (`reviews`), the grade's study
 * paths annotated for the client (`paths` — each chain skill's stage, lock
 * state and boss readiness via the mastery engine's describePath), and the
 * derived `skill_state` rows (`skillStates`) so the client can render stages
 * without a second round trip.
 *
 * `date` is the viewer's calendar date (plan §6.5: due dates are local days, so
 * the caller must say which local day it is asking about).
 */
import { listPaths, listProblems } from '@grove/curriculum'
import { getStudentById } from '../../../lib/db.js'
import { describePath, dueReviews, getSkillStates, nextForStudent, pickProblem } from '../../../lib/mastery.js'

function isCalendarDate(value) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value ?? '')) return false
  const date = new Date(`${value}T00:00:00.000Z`)
  return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value
}

export async function GET(request) {
  const params = new URL(request.url).searchParams
  for (const key of params.keys()) {
    if (!['studentId', 'date', 'grade'].includes(key)) return Response.json({ error: `Unsupported parameter: ${key}` }, { status: 400 })
  }
  const studentId = params.get('studentId')
  if (!studentId) return Response.json({ error: 'studentId is required' }, { status: 400 })
  const student = getStudentById(studentId)
  if (!student) return Response.json({ error: 'Student not found' }, { status: 404 })
  const date = params.get('date')
  if (!isCalendarDate(date)) return Response.json({ error: 'date must be a valid YYYY-MM-DD date' }, { status: 400 })
  let grade = student.grade
  const gradeText = params.get('grade')
  if (gradeText !== null) {
    const parsed = Number(gradeText)
    if (!/^\d+$/.test(gradeText) || !Number.isInteger(parsed) || parsed < 1 || parsed > 12) {
      return Response.json({ error: 'grade must be an integer from 1 to 12' }, { status: 400 })
    }
    grade = parsed
  }

  const problems = listProblems({ grade })
  const templatesBySkill = new Map()
  for (const problem of problems) {
    const list = templatesBySkill.get(problem.skill) ?? []
    list.push(problem)
    templatesBySkill.set(problem.skill, list)
  }

  // The queue mirrors nextForStudent's own choice: the same pickProblem mapping
  // (bosses excluded — they are path goals, not routine reviews), so `next`
  // is always the first entry of `reviews` when a review is due.
  const bossIds = new Set(problems.filter((problem) => problem.boss).map((problem) => problem.id))
  const reviews = dueReviews(studentId, date)
    .map((state) => {
      const practice = (templatesBySkill.get(state.skillId) ?? []).filter((problem) => !bossIds.has(problem.id))
      const problem = pickProblem(practice, state.level)
      if (!problem) return null
      return {
        skillId: state.skillId,
        problemId: problem.id,
        title: problem.title,
        difficulty: problem.difficulty,
        box: state.box,
        dueDate: state.dueDate,
      }
    })
    .filter(Boolean)

  const states = getSkillStates(studentId)
  const stateBySkill = new Map(states.map((state) => [state.skillId, state]))
  const stageOf = (skillId) => stateBySkill.get(skillId)?.stage ?? 'seed'
  const paths = listPaths(grade).map((path) => describePath({ path, stageOf }))

  const skillStates = states.map((state) => ({
    skillId: state.skillId,
    stage: state.stage,
    level: state.level,
    box: state.box,
    dueDate: state.dueDate,
    attempts: state.attempts,
    correct: state.correct,
  }))

  return Response.json({
    next: nextForStudent({ studentId, date, grade }),
    reviews,
    paths,
    skillStates,
  })
}
