// In-memory progress storage
// In production, this would be a database
const progressStore = new Map()

export function getProgress(studentId = 'default') {
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
    })
  }
  return progressStore.get(studentId)
}

export function recordSubmission(studentId = 'default', subject, type, exerciseId, score, maxScore, details) {
  const progress = getProgress(studentId)
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

export function getProgressStats(studentId = 'default') {
  const progress = getProgress(studentId)
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
  }
}
