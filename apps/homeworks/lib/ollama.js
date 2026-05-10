const NORA_URL = process.env.PLT_NORA_URL || 'http://localhost:3001'
// Nora's Next.js app has basePath: '/chat'
const NORA_BASE = `${NORA_URL}/chat`

async function callNora(path, body) {
  const res = await fetch(`${NORA_BASE}${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })

  if (!res.ok) {
    const detail = await res.text().catch(() => '')
    throw new Error(`Nora API error ${res.status}: ${detail}`)
  }

  return res.json()
}

export async function generateExercise(type, subject) {
  return callNora('/api/nora-homework/exercise', { subject, type })
}

export async function gradeSubmission(type, subject, exercise, answers) {
  return callNora('/api/nora-homework/grade', { subject, type, exercise, answers })
}
