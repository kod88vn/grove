// In-memory progress storage
// In production, this would be a database
const progressStore = new Map()

function getOrCreateProgress(studentId = 'default') {
  if (!progressStore.has(studentId)) {
    progressStore.set(studentId, {
      studentId,
      createdAt: new Date(),
      english: {
        completed: [],
        total: 0,
        averageScore: 0,
      },
      math: {
        completed: [],
        total: 0,
        averageScore: 0,
      },
      readingHistory: [], // stores full past readings with passage + score
    })
  }
  return progressStore.get(studentId)
}

export function getProgress(studentId = 'default') {
  return getOrCreateProgress(studentId)
}

export function recordSubmission(studentId = 'default', subject, type, exerciseId, score, maxScore, details) {
  const progress = getOrCreateProgress(studentId)
  const subjectData = progress[subject]

  if (!subjectData) {
    throw new Error(`Unknown subject: ${subject}`)
  }

  subjectData.completed.push({
    id: `${subject}-${Date.now()}`,
    exerciseId,
    type,
    date: new Date().toISOString(),
    score,
    maxScore,
    percentage: Math.round((score / maxScore) * 100),
    details,
  })

  // Update total and average
  subjectData.total = subjectData.completed.length
  const totalScore = subjectData.completed.reduce((sum, item) => sum + item.percentage, 0)
  subjectData.averageScore = Math.round(totalScore / subjectData.total)

  return subjectData
}

// Store a full reading session (passage + lesson + score) in reading history
export function recordReading(studentId = 'default', passage, questions, lessonKeyPoint, domain, score, maxScore) {
  const progress = getOrCreateProgress(studentId)

  progress.readingHistory.push({
    id: `reading-${Date.now()}`,
    passage,
    questions,
    lessonKeyPoint,
    domain: domain || 'random',
    date: new Date().toISOString(),
    score,
    maxScore,
    percentage: maxScore ? Math.round((score / maxScore) * 100) : null,
  })

  // Keep last 50 readings
  if (progress.readingHistory.length > 50) {
    progress.readingHistory = progress.readingHistory.slice(-50)
  }

  return progress.readingHistory
}

// Load a specific reading from history by ID
export function getReadingById(studentId, readingId) {
  const progress = getOrCreateProgress(studentId)
  return progress.readingHistory.find((r) => r.id === readingId) || null
}

// Get all reading history
export function getReadingHistory(studentId = 'default') {
  const progress = getOrCreateProgress(studentId)
  return progress.readingHistory.slice().reverse() // newest first
}

export function getProgressStats(studentId = 'default') {
  const progress = getOrCreateProgress(studentId)
  return {
    studentId,
    english: {
      completed: progress.english.completed.length,
      averageScore: progress.english.averageScore,
      recentSubmissions: progress.english.completed.slice(-5).reverse(),
    },
    math: {
      completed: progress.math.completed.length,
      averageScore: progress.math.averageScore,
      recentSubmissions: progress.math.completed.slice(-5).reverse(),
    },
    readingHistory: getReadingHistory(studentId),
  }
}