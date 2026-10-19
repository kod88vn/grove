import { getProblem, getSkill, listProblems } from '@grove/curriculum'

const MAX_SEED = 2147483647
const DAY_MS = 86400000

export function dailySeed({ grade, localDate }) {
  let hash = 2166136261
  for (const character of `${grade}:${localDate}`) {
    hash = Math.imul(hash ^ character.charCodeAt(0), 16777619) >>> 0
  }
  return hash % (MAX_SEED + 1)
}

export function dailyChallenge({ grade, localDate }) {
  const problems = listProblems({ grade }).sort((left, right) => left.id.localeCompare(right.id))
  if (problems.length === 0) return null
  const seed = dailySeed({ grade, localDate })
  const problem = getProblem(problems[seed % problems.length].id)
  return problem ? { problem, seed } : null
}

function dateNumber(value) {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value)
  if (!match) throw new TypeError('date must be YYYY-MM-DD')
  const [, year, month, day] = match.map(Number)
  const date = new Date(Date.UTC(year, month - 1, day))
  if (date.getUTCFullYear() !== year || date.getUTCMonth() !== month - 1 || date.getUTCDate() !== day) {
    throw new TypeError('date must be a valid calendar day')
  }
  return Math.floor(date.getTime() / DAY_MS)
}

function dateText(day) {
  return new Date(day * DAY_MS).toISOString().slice(0, 10)
}

function mondayOf(day) {
  return day - ((new Date(day * DAY_MS).getUTCDay() + 6) % 7)
}

function wateredDaysFor(attempts, studentId) {
  return new Set(attempts
    .filter((row) => row.student_id === studentId && row.correct === 1 && row.revealed !== 1)
    .map((row) => row.local_date))
}

export function wateringSummary({ attempts, studentId, today }) {
  const watered = wateredDaysFor(attempts, studentId)
  const todayNumber = dateNumber(today)
  const monday = mondayOf(todayNumber)
  const wateredDays = [...watered].filter((day) => {
    const number = dateNumber(day)
    return number >= monday && number <= monday + 6
  }).length
  const rainDaysUsed = Math.min(2, todayNumber - monday + 1 - [...watered].filter((day) => {
    const number = dateNumber(day)
    return number >= monday && number <= todayNumber
  }).length)

  let streak = 0
  let hasWateredAnchor = false
  let cursor = todayNumber
  while (cursor >= todayNumber - 365) {
    const weekStart = mondayOf(cursor)
    const weekEnd = Math.min(weekStart + 6, todayNumber)
    let missed = 0
    for (let day = weekStart; day <= weekEnd; day += 1) {
      if (!watered.has(dateText(day))) missed += 1
    }
    if (missed > 2) {
      while (cursor >= weekStart && watered.has(dateText(cursor))) {
        hasWateredAnchor = true
        streak += 1
        cursor -= 1
      }
      break
    }
    if ([...watered].some((day) => {
      const number = dateNumber(day)
      return number >= weekStart && number <= weekEnd
    })) hasWateredAnchor = true
    streak += cursor - weekStart + 1
    cursor = weekStart - 1
  }
  return { wateredDays, rainDaysUsed, streak: hasWateredAnchor ? streak : 0, weeklyGoalMet: wateredDays >= 5 }
}

export function rewardSummary({ attempts, studentId }) {
  const stars = attempts
    .filter((row) => row.student_id === studentId && row.correct === 1 && row.revealed !== 1)
    .reduce((total, row) => total + row.stars, 0)
  return { stars, sunshine: stars }
}

export function questList({ problems, grade, topic, difficulty, status, studentId, attempts, sessionItems = [] }) {
  const childAttempts = attempts.filter((row) => row.student_id === studentId)
  const attempted = new Set([
    ...childAttempts.map((row) => row.problem_id),
    ...sessionItems.filter((row) => row.tries > 0).map((row) => row.problem_id),
  ])
  const solved = new Set(childAttempts.filter((row) => row.correct === 1).map((row) => row.problem_id))
  for (const item of sessionItems) if (item.done === 1) solved.add(item.problem_id)
  return problems.filter((problem) => {
    const skillId = problem.skillId ?? problem.skill
    if (problem.grade !== grade || (topic && skillId !== topic)) return false
    if (difficulty !== undefined && problem.difficulty !== difficulty) return false
    if (status === 'untried' && attempted.has(problem.id)) return false
    if (status === 'attempted' && (!attempted.has(problem.id) || solved.has(problem.id))) return false
    if (status === 'solved' && !solved.has(problem.id)) return false
    return true
  })
}

export function gardenSummary({ skills, attempts, studentId }) {
  const bySkill = new Map()
  for (const row of attempts.filter((attempt) => attempt.student_id === studentId)) {
    const rows = bySkill.get(row.skill_id) ?? []
    rows.push(row)
    bySkill.set(row.skill_id, rows)
  }
  return skills.map((skill) => ({
    skillId: skill.id,
    name: skill.name ?? getSkill(skill.id)?.name ?? skill.id,
    stage: gardenStage(bySkill.get(skill.id) ?? []),
  }))
}

function gardenStage(attempts) {
  if (attempts.length === 0) return 'seed'
  const practice = attempts
    .filter((attempt) => attempt.revealed !== 1 && attempt.revealed !== true)
    .sort((left, right) => right.local_date.localeCompare(left.local_date) || (right.created_at ?? 0) - (left.created_at ?? 0))
  if (practice.length === 0) return 'seed'
  const recent = practice.slice(0, 10)
  return recent.length >= 10 && recent.filter(isCorrect).length / 10 >= 0.6 ? 'sapling' : 'sprout'
}

function isCorrect(attempt) {
  return attempt.correct === 1 || attempt.correct === true
}