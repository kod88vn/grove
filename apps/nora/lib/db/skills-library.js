import { randomUUID } from 'crypto'
import defaultDb from './db.js'

/**
 * Save a completed problem to the student's skills library.
 */
export function saveToSkillsLibrary(
  studentId,
  subject,
  skillCategory,
  skillName,
  skillLabel,
  problemText,
  problemJson,
  answerJson,
  score,
  maxScore,
  db = defaultDb
) {
  const id = randomUUID()
  db.prepare(`
    INSERT INTO skills_library
      (id, student_id, subject, skill_category, skill_name, skill_label, problem_text, problem_json, answer_json, score, max_score)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    id,
    studentId,
    subject,
    skillCategory,
    skillName,
    skillLabel,
    problemText,
    JSON.stringify(problemJson),
    JSON.stringify(answerJson),
    score,
    maxScore
  )
  return id
}

/**
 * Get all library entries for a student, with optional filtering by skill.
 */
export function getLibraryByStudent(studentId, skillCategory = null, skillName = null, db = defaultDb) {
  let query = `
    SELECT id, subject, skill_category, skill_name, skill_label, problem_text, 
           score, max_score, created_at
    FROM skills_library
    WHERE student_id = ?
  `
  const params = [studentId]

  if (skillCategory) {
    query += ` AND skill_category = ?`
    params.push(skillCategory)
  }

  if (skillName) {
    query += ` AND skill_name = ?`
    params.push(skillName)
  }

  query += ` ORDER BY created_at DESC LIMIT 100`

  return db.prepare(query).all(...params)
}

/**
 * Get all distinct skills a student has attempted (for library sidebar).
 */
export function getSkillsSummary(studentId, db = defaultDb) {
  return db.prepare(`
    SELECT 
      skill_category,
      skill_name,
      skill_label,
      COUNT(*) as attempts,
      ROUND(AVG(score / max_score) * 100, 1) as averageScore,
      MAX(created_at) as lastAttempted
    FROM skills_library
    WHERE student_id = ?
    GROUP BY skill_category, skill_name
    ORDER BY skill_category, skill_name
  `).all(studentId)
}

/**
 * Get a single problem from library by id (for detailed view).
 */
export function getLibraryProblem(id, studentId, db = defaultDb) {
  const row = db.prepare(`
    SELECT * FROM skills_library WHERE id = ? AND student_id = ?
  `).get(id, studentId)

  if (!row) return null

  return {
    ...row,
    problem_json: JSON.parse(row.problem_json),
    answer_json: JSON.parse(row.answer_json),
  }
}

/**
 * Delete a library entry.
 */
export function deleteLibraryEntry(id, studentId, db = defaultDb) {
  db.prepare(`
    DELETE FROM skills_library WHERE id = ? AND student_id = ?
  `).run(id, studentId)
}

/**
 * Get library stats for a student (total problems, categories covered, etc.).
 */
export function getLibraryStats(studentId, db = defaultDb) {
  const totalProblems = db.prepare(`
    SELECT COUNT(*) as count FROM skills_library WHERE student_id = ?
  `).get(studentId)?.count || 0

  const skillsAttempted = db.prepare(`
    SELECT COUNT(DISTINCT CONCAT(skill_category, ':', skill_name)) as count
    FROM skills_library WHERE student_id = ?
  `).get(studentId)?.count || 0

  const averageScore = db.prepare(`
    SELECT ROUND(AVG(score / max_score) * 100, 1) as avg FROM skills_library WHERE student_id = ?
  `).get(studentId)?.avg || 0

  return {
    totalProblems,
    skillsAttempted,
    averageScore,
  }
}
