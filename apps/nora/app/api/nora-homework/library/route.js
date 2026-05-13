import { saveToSkillsLibrary, getLibraryByStudent, getSkillsSummary, getLibraryStats } from '@/lib/db/skills-library'
import { MATH_SKILLS_CATALOG } from '@/lib/skills-catalog'

/**
 * POST /api/nora-homework/library
 * Save a completed problem to the student's skills library
 */
export async function POST(request) {
  try {
    const {
      studentId = 'default',
      subject,
      skillCategory,
      skillName,
      skillLabel,
      problemText,
      problemJson,
      answerJson,
      score,
      maxScore,
    } = await request.json()

    if (!subject || !skillCategory || !skillName || !skillLabel) {
      return Response.json(
        { error: 'Missing required skill fields' },
        { status: 400 }
      )
    }

    if (typeof score !== 'number' || typeof maxScore !== 'number') {
      return Response.json(
        { error: 'Score must be numeric' },
        { status: 400 }
      )
    }

    const id = saveToSkillsLibrary(
      studentId,
      subject,
      skillCategory,
      skillName,
      skillLabel,
      problemText || '',
      problemJson || {},
      answerJson || {},
      score,
      maxScore
    )

    return Response.json({ id, success: true }, { status: 201 })
  } catch (error) {
    console.error('Error saving to library:', error)
    return Response.json(
      { error: 'Failed to save to library' },
      { status: 500 }
    )
  }
}

/**
 * GET /api/nora-homework/library?studentId=...&skillCategory=...&skillName=...&view=...
 * Retrieve library entries for a student
 */
export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url)
    const studentId = searchParams.get('studentId') || 'default'
    const skillCategory = searchParams.get('skillCategory')
    const skillName = searchParams.get('skillName')
    const view = searchParams.get('view') || 'items' // 'items', 'summary', 'stats', or 'catalog'

    if (view === 'catalog') {
      const categories = Object.entries(MATH_SKILLS_CATALOG).map(([key, value]) => ({
        key,
        category: value.category,
        categoryId: value.categoryId,
        skills: value.skills,
      }))
      return Response.json({ categories }, { status: 200 })
    }

    if (view === 'summary') {
      const summary = getSkillsSummary(studentId)
      return Response.json({ summary }, { status: 200 })
    }

    if (view === 'stats') {
      const stats = getLibraryStats(studentId)
      return Response.json({ stats }, { status: 200 })
    }

    const items = getLibraryByStudent(studentId, skillCategory, skillName)
    return Response.json({ items }, { status: 200 })
  } catch (error) {
    console.error('Error retrieving library:', error)
    return Response.json(
      { error: 'Failed to retrieve library' },
      { status: 500 }
    )
  }
}
