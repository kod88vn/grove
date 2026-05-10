import { callOllama } from '@/app/api/chat/lib/ollama'
import { DEFAULT_MODEL } from '@/app/api/chat/lib/constants'

const PROMPTS = {
  english: {
    reading: `Generate a short reading passage (150-200 words) appropriate for a Grade 5 student. The passage should be interesting and cover topics relevant to their age. After the passage, create 4-5 comprehension questions that mix:
1. Multiple choice questions (3 options)
2. Short answer questions requiring 1-2 sentences
3. One creative question (e.g., "What would you do if...")

Format as JSON with keys: passage, questions (array with: id, type ('multiple-choice' or 'short-answer'), question, options (for MC), correctAnswer)`,
    writing: `Generate a Grade 5 appropriate writing exercise. Include:
1. A writing prompt (2-3 sentences)
2. Key points they should address (3-4 bullet points)
3. Example structure/outline

Format as JSON with keys: prompt, keyPoints, outline, wordCountTarget (suggest 150-250 words)`,
  },
  math: {
    mixed: `Generate a Grade 5 Math problem set with 3 problems mixing operations. For each problem:
1. The problem statement
2. Required step-by-step solution showing each operation
3. Space for student work

Include: 1 multi-step addition/subtraction, 1 multiplication, 1 division problem
All numbers should result in whole numbers or simple decimals.

Format as JSON with: problems (array with: id, problem, operations (array showing steps like "addition", "multiplication"), expectedAnswer, difficulty ('easy'|'medium'|'hard'))`,
  },
}

function extractJson(text) {
  const stripped = String(text || '').replace(/```(?:json)?\s*/gi, '').replace(/```/g, '').trim()
  const match = stripped.match(/\{[\s\S]*\}/)
  if (!match) return null
  try {
    return JSON.parse(match[0])
  } catch {
    return null
  }
}

export async function POST(request) {
  let body
  try {
    body = await request.json()
  } catch {
    return Response.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  const { subject, type } = body || {}
  const prompt = PROMPTS[subject]?.[type]

  if (!prompt) {
    return Response.json({ error: `Unknown subject/type: ${subject}/${type}` }, { status: 400 })
  }

  const res = await callOllama({
    model: DEFAULT_MODEL,
    messages: [
      {
        role: 'system',
        content:
          'You are an expert Grade 5 teacher. Generate educational exercises that are engaging, age-appropriate, and properly structured. Always respond with valid JSON only, no explanations.',
      },
      { role: 'user', content: prompt },
    ],
    stream: false,
  })

  if (!res.ok) {
    return Response.json({ error: `Ollama error: ${res.status}` }, { status: 502 })
  }

  const json = await res.json()
  const content = json.message?.content?.trim()
  if (!content) {
    return Response.json({ error: 'Empty response from Ollama' }, { status: 502 })
  }

  const exercise = extractJson(content)
  if (!exercise) {
    return Response.json({ error: 'Invalid JSON from Ollama' }, { status: 502 })
  }

  return Response.json(exercise)
}
