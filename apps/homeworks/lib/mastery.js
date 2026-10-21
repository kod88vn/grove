// Mastery engine (HOMEWORK_PLAN.md §6.5, Phase 4 / U05 M-MASTERY).
//
// `attempts` is the source of truth: one row per solved problem instance
// (correct = 1 always; `revealed` marks a give-up, `tries` the server count).
// `skill_state` is derived data — every function here recomputes it by folding
// the student's attempt stream in chronological order, so a rebuild is
// deterministic and idempotent (plan §6.4: "keep a rebuildSkillState for when
// the mastery rule changes").
//
// Rules, exactly as planned:
//   ladder   — level 1..3; 3 correct in a row → up; 2 wrong in a row → down.
//              A stored row contributes (tries − 1) wrongs then one correct;
//              a revealed solve contributes two wrongs and no correct.
//   stage    — seed: never tried · sprout: first stored attempt ·
//              sapling: ≥60% of the last 10 practice attempts ·
//              tree: ≥80% of the last 10, including ≥3 at level 3, across
//                    ≥2 local days · fruiting: tree + the most recent spaced
//                    review since re-entering tree was a pass.
//   Leitner  — reaching tree enters box 1 (due +1 day); a passed review moves
//              one box up (intervals 1/3/7/14/30; box 5 graduates, no more
//              reviews); a missed review drops one box (box 0 leaves the
//              system). A stage below tree also leaves the system.
//   next     — due reviews first, then the active path's next skill (or its
//              👑 boss once every path skill is a tree), then the
//              lowest-stage skill whose prerequisites are all ≥ sapling.
//              Bosses are path goals, never regular practice: they are
//              excluded from path-step and ready-skill problem picks.
//   path     — describePath annotates a study path for the client: each chain
//              skill's stage, whether its prerequisites are ≥ sapling (locked
//              skills are visible but not playable), the next playable chain
//              skill, and whether the boss is ready.
import { getSkill, listPaths, listProblems, listSkills } from '@grove/curriculum'
import { getDatabase } from './db.js'

export const LEITNER_INTERVALS = [null, 1, 3, 7, 14, 30]

export const STAGE_RANK = { seed: 0, sprout: 1, sapling: 2, tree: 3, fruiting: 4 }

// Calendar-day addition on 'YYYY-MM-DD' local dates. Date.UTC normalizes
// month/year overflow, so month boundaries and leap years fall out for free.
export function addDays(date, days) {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(date ?? '')
  if (!match) throw new TypeError('date must be a YYYY-MM-DD calendar date')
  const [year, month, day] = match.slice(1).map(Number)
  const stamp = new Date(Date.UTC(year, month - 1, day + days))
  const text = stamp.toISOString().slice(0, 10)
  if (text !== date && days === 0) throw new TypeError('date must be a valid calendar day')
  return text
}

function stageFromWindow(window) {
  if (window.length === 0) return 'seed'
  // The "last 10" needs 10 rows before it can say anything (plan §6.5: "sprout
  // after the first attempt" — up to the tenth attempt the stage is sprout,
  // matching the pre-U05 garden heuristic's `recent.length >= 10` rule).
  if (window.length < 10) return 'sprout'
  const wins = window.filter((entry) => !entry.revealed).length
  const atLevelThree = window.filter((entry) => entry.level === 3).length
  const days = new Set(window.map((entry) => entry.localDate)).size
  const ratio = wins / window.length
  if (ratio >= 0.8 && atLevelThree >= 3 && days >= 2) return 'tree'
  if (ratio >= 0.6) return 'sapling'
  return 'sprout'
}

// Pure fold over a chronological attempt stream. Each event:
//   { correct, revealed, tries, localDate, createdAt, review }
// `review` marks an attempt from a kind='review' session (the spaced system).
export function computeSkillState(events) {
  let level = 1
  let correctStreak = 0
  let wrongStreak = 0
  let box = 0
  let dueDate = null
  let inTree = false
  let lastReview = null
  let attempts = 0
  let correct = 0
  let updatedAt = null
  const practice = []

  for (const event of events) {
    const levelAtTime = level

    const wrongs = event.revealed ? 2 : Math.max(0, (event.tries ?? 1) - 1)
    for (let index = 0; index < wrongs; index += 1) {
      wrongStreak += 1
      correctStreak = 0
      if (wrongStreak >= 2) {
        level = Math.max(1, level - 1)
        wrongStreak = 0
      }
    }
    if (!event.revealed) {
      correctStreak += 1
      wrongStreak = 0
      if (correctStreak >= 3) {
        level = Math.min(3, level + 1)
        correctStreak = 0
      }
    }

    attempts += 1
    if (event.correct && !event.revealed) correct += 1
    updatedAt = event.createdAt

    if (!event.review) practice.push({ level: levelAtTime, revealed: event.revealed, localDate: event.localDate })

    const windowStage = stageFromWindow(practice.slice(-10))
    if (windowStage === 'tree' && !inTree) {
      inTree = true
      box = 1
      dueDate = addDays(event.localDate, 1)
      lastReview = null
    } else if (windowStage !== 'tree' && inTree) {
      inTree = false
      box = 0
      dueDate = null
      lastReview = null
    }

    if (event.review) {
      if (event.revealed) {
        lastReview = 'miss'
        if (box > 0) {
          box = Math.max(0, box - 1)
          dueDate = box > 0 ? addDays(event.localDate, LEITNER_INTERVALS[box]) : null
        }
      } else {
        lastReview = 'pass'
        box = box > 0 ? Math.min(5, box + 1) : 1
        dueDate = box >= 5 ? null : addDays(event.localDate, LEITNER_INTERVALS[box])
      }
    }
  }

  const windowStage = stageFromWindow(practice.slice(-10))
  const stage = inTree && lastReview === 'pass' ? 'fruiting' : windowStage
  if (box === 0) dueDate = null

  return { stage, level, box, dueDate, attempts, correct, updatedAt }
}

// --- database side ---------------------------------------------------------

function loadSkillEvents(studentId, skillId) {
  const rows = getDatabase().prepare(`
    SELECT a.tries, a.revealed, a.correct, a.local_date, a.created_at,
           (CASE WHEN s.kind = 'review' THEN 1 ELSE 0 END) AS review
    FROM attempts AS a
    LEFT JOIN practice_sessions AS s ON s.id = a.session_id
    WHERE a.student_id = ? AND a.skill_id = ?
    ORDER BY a.created_at, a.rowid
  `).all(studentId, skillId)
  return rows.map((row) => ({
    tries: row.tries,
    revealed: row.revealed === 1,
    correct: row.correct === 1,
    localDate: row.local_date,
    createdAt: row.created_at,
    review: row.review === 1,
  }))
}

function parseSkillState(row) {
  return {
    skillId: row.skill_id,
    stage: row.stage,
    level: row.level,
    box: row.box,
    dueDate: row.due_date,
    attempts: row.attempts,
    correct: row.correct,
    updatedAt: row.updated_at,
  }
}

function upsertSkillState(studentId, skillId, state) {
  getDatabase().prepare(`
    INSERT INTO skill_state (student_id, skill_id, stage, level, box, due_date, attempts, correct, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT (student_id, skill_id) DO UPDATE SET
      stage = excluded.stage,
      level = excluded.level,
      box = excluded.box,
      due_date = excluded.due_date,
      attempts = excluded.attempts,
      correct = excluded.correct,
      updated_at = excluded.updated_at
  `).run(studentId, skillId, state.stage, state.level, state.box, state.dueDate, state.attempts, state.correct, state.updatedAt ?? 0)
}

// Recompute one skill from its full attempt stream and store the result.
// Returns the state object, or null when the skill has no stored attempts.
export function refreshSkillState(studentId, skillId) {
  const events = loadSkillEvents(studentId, skillId)
  if (events.length === 0) {
    getDatabase().prepare('DELETE FROM skill_state WHERE student_id = ? AND skill_id = ?').run(studentId, skillId)
    return null
  }
  const state = computeSkillState(events)
  upsertSkillState(studentId, skillId, state)
  return { studentId, skillId, ...state }
}

// Recompute every skill the student has attempted and drop rows for skills
// whose attempts are gone. Plan §6.4: the rule-change escape hatch.
export function rebuildSkillState(studentId) {
  const db = getDatabase()
  return db.transaction(() => {
    const skillIds = db.prepare('SELECT DISTINCT skill_id FROM attempts WHERE student_id = ?').all(studentId).map((row) => row.skill_id)
    for (const skillId of skillIds) refreshSkillState(studentId, skillId)
    db.prepare('DELETE FROM skill_state WHERE student_id = ? AND skill_id NOT IN (SELECT DISTINCT skill_id FROM attempts WHERE student_id = ?)')
      .run(studentId, studentId)
    return getSkillStates(studentId)
  })()
}

export function getSkillStates(studentId) {
  return getDatabase()
    .prepare('SELECT * FROM skill_state WHERE student_id = ? ORDER BY skill_id')
    .all(studentId)
    .map(parseSkillState)
}

// Spaced reviews whose due date has arrived (string compare on YYYY-MM-DD
// local dates is calendar-ordered by construction).
export function dueReviews(studentId, date) {
  return getSkillStates(studentId)
    .filter((state) => state.box > 0 && state.dueDate !== null && state.dueDate <= date)
    .sort((left, right) => left.dueDate.localeCompare(right.dueDate) || left.skillId.localeCompare(right.skillId))
}

// --- "what's next" (plan §6.5) ---------------------------------------------

// Serve the template at the ladder level, falling back to the closest one.
export function pickProblem(templates, level) {
  if (templates.length === 0) return null
  const atLevel = templates.filter((template) => template.difficulty === level).sort((a, b) => a.id.localeCompare(b.id))
  if (atLevel.length > 0) return atLevel[0]
  return [...templates].sort(
    (a, b) => Math.abs(a.difficulty - level) - Math.abs(b.difficulty - level) || a.id.localeCompare(b.id),
  )[0]
}

// The kid's next problem: due reviews first, then the active path, then the
// lowest-stage skill whose prerequisites are all mastered enough (≥ sapling).
export function nextForStudent({ studentId, date, grade }) {
  const stateBySkill = new Map(getSkillStates(studentId).map((state) => [state.skillId, state]))
  const skills = listSkills({ grade })
  const problems = listProblems({ grade })
  const templatesBySkill = new Map()
  for (const problem of problems) {
    const list = templatesBySkill.get(problem.skill) ?? []
    list.push(problem)
    templatesBySkill.set(problem.skill, list)
  }
  const stageOf = (skillId) => stateBySkill.get(skillId)?.stage ?? 'seed'

  for (const state of dueReviews(studentId, date)) {
    const problem = pickProblem(templatesBySkill.get(state.skillId) ?? [], state.level)
    if (!problem) continue
    return {
      kind: 'review', skillId: state.skillId, problemId: problem.id, title: problem.title,
      difficulty: problem.difficulty, reason: 'review-due', dueDate: state.dueDate, box: state.box,
    }
  }

  // Bosses are path goals, not practice: a pre-tree kid is never served one,
  // whether the pick comes from a path step or a ready skill. (The all-tree
  // branch below serves the boss on purpose — that is the path's reward.)
  const bossIds = new Set(listPaths(grade).map((path) => path.bossProblemId).filter(Boolean))

  for (const path of listPaths(grade)) {
    const stages = path.skills.map((skillId) => stageOf(skillId))
    const inProgress = stages.some((stage) => STAGE_RANK[stage] >= STAGE_RANK.sprout)
    if (!inProgress) continue
    const nextSkillId = path.skills.find((_, index) => STAGE_RANK[stages[index]] < STAGE_RANK.tree)
    if (nextSkillId) {
      const practice = (templatesBySkill.get(nextSkillId) ?? []).filter((problem) => !bossIds.has(problem.id))
      const problem = pickProblem(practice, stateBySkill.get(nextSkillId)?.level ?? 1)
      if (!problem) continue
      return {
        kind: 'path', pathId: path.id, skillId: nextSkillId, problemId: problem.id, title: problem.title,
        difficulty: problem.difficulty, reason: 'path',
      }
    }
    const boss = problems.find((problem) => problem.id === path.bossProblemId)
    if (boss) {
      return {
        kind: 'path', pathId: path.id, skillId: path.terminal, problemId: boss.id, title: boss.title,
        difficulty: boss.difficulty, reason: 'path-boss',
      }
    }
  }

  const candidates = skills
    .filter((skill) => {
      if (STAGE_RANK[stageOf(skill.id)] >= STAGE_RANK.tree) return false
      return (skill.prerequisites ?? []).every((prerequisite) => STAGE_RANK[stageOf(prerequisite)] >= STAGE_RANK.sapling)
    })
    .sort((a, b) => STAGE_RANK[stageOf(a.id)] - STAGE_RANK[stageOf(b.id)] || a.id.localeCompare(b.id))
  for (const skill of candidates) {
    const practice = (templatesBySkill.get(skill.id) ?? []).filter((problem) => !bossIds.has(problem.id))
    const problem = pickProblem(practice, stateBySkill.get(skill.id)?.level ?? 1)
    if (problem) {
      return {
        kind: 'skill', skillId: skill.id, problemId: problem.id, title: problem.title,
        difficulty: problem.difficulty, reason: 'ready-skill',
      }
    }
  }

  return null
}

// --- study paths for the client (plan §6.7) ---------------------------------

// A path's chain as the kid sees it. `stageOf` maps a skill id to its stage
// (untried skills default to 'seed' — callers pass the fold's stage or 'seed').
//
// Locked is a *prerequisite* rule, not a stage rule: a chain skill whose
// prerequisites have not all reached at least sapling is visible but not
// playable, and `lockedBy` names the missing prerequisites so the UI can say
// "grow X first". The boss is ready exactly when every chain skill is a tree
// (or beyond) — the same rule nextForStudent applies when it serves one.
export function describePath({ path, stageOf }) {
  const stages = path.skills.map((skillId) => ({ skillId, stage: stageOf(skillId) ?? 'seed' }))
  const skills = stages.map(({ skillId, stage }) => {
    const skill = getSkill(skillId)
    const lockedBy = (skill?.prerequisites ?? [])
      .filter((prerequisite) => STAGE_RANK[stageOf(prerequisite) ?? 'seed'] < STAGE_RANK.sapling)
    return { skillId, stage, locked: lockedBy.length > 0, lockedBy }
  })
  const nextSkillId = skills.find((entry) => STAGE_RANK[entry.stage] < STAGE_RANK.tree)?.skillId ?? null
  return {
    id: path.id,
    name: path.name,
    icon: path.icon,
    subject: path.subject,
    terminal: path.terminal,
    bossProblemId: path.bossProblemId,
    bossReady: nextSkillId === null,
    nextSkillId,
    skills,
  }
}
