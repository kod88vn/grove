const NORA_URL = process.env.PLT_NORA_URL || 'http://localhost:3000'
// Nora's Next.js app has basePath: '/chat'
const NORA_BASE = `${NORA_URL}/chat`
const NORA_TIMEOUT_MS = Number(process.env.HOMEWORKS_NORA_TIMEOUT_MS || 60000)

async function callNora(path, body) {
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), NORA_TIMEOUT_MS)

  let res
  try {
    res = await fetch(`${NORA_BASE}${path}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
      signal: controller.signal,
    })
  } catch (error) {
    if (error && error.name === 'AbortError') {
      throw new Error(`Nora API timeout after ${NORA_TIMEOUT_MS}ms`) 
    }
    throw error
  } finally {
    clearTimeout(timeout)
  }

  if (!res.ok) {
    const detail = await res.text().catch(() => '')
    throw new Error(`Nora API error ${res.status}: ${detail}`)
  }

  return res.json()
}

export async function generateExercise(type, subject, options = {}) {
  const { skillCategory, selectedDomain } = options
  return callNora('/api/nora-homework/exercise', {
    subject,
    type,
    ...(skillCategory ? { skillCategory } : {}),
    ...(selectedDomain ? { selectedDomain } : {}),
  })
}

export async function gradeSubmission(type, subject, exercise, answers) {
  return callNora('/api/nora-homework/grade', { subject, type, exercise, answers })
}