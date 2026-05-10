import { callOllama } from '@/app/api/chat/lib/ollama'
import { DEFAULT_MODEL } from '@/app/api/chat/lib/constants'

function buildPrompt(subject, type, exercise, answers) {
  if (subject === 'english' && type === 'reading') {
    return `You are a Grade 5 teacher grading reading comprehension. 
      
Exercise: ${JSON.stringify(exercise)}
Student Answers: ${JSON.stringify(answers)}

Grade each answer and provide:
1. Score for each answer (points)
2. Feedback explaining what was good/needs improvement
3. Overall score and encouraging comment

Format as JSON: { answers: [{id, score, feedback}], totalScore, maxScore, overallFeedback }`
  }

  if (subject === 'english' && type === 'writing') {
    return `You are a Grade 5 teacher grading writing.

Prompt: ${exercise.prompt}
Student Writing: "${answers.text}"
Word Count: ${answers.wordCount || 'not provided'}

Grade on:
1. Ideas & Content (ideas clearly stated, relevant)
2. Organization (logical flow, beginning/middle/end)
3. Sentence Structure (variety, clarity)
4. Grammar & Spelling (appropriate for Grade 5)
5. Following Instructions (addressed prompt points)

Format as JSON: { 
  criteria: [{name, score, maxScore, feedback}], 
  totalScore, 
  maxScore, 
  comment 
}`
  }

  if (subject === 'math' && type === 'mixed') {
    return `You are a Grade 5 math teacher grading work.

Problem Set: ${JSON.stringify(exercise)}
Student Work: ${JSON.stringify(answers)}

For each problem, check:
1. Final answer correctness
2. Showing work/steps
3. Mathematical reasoning

Format as JSON: { 
  problems: [{id, answer, correct, workShown, feedback}], 
  totalCorrect, 
  totalProblems, 
  score, 
  comment 
}`
  }

  return null
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

  const { subject, type, exercise, answers } = body || {}
  const prompt = buildPrompt(subject, type, exercise, answers)

  if (!prompt) {
    return Response.json({ error: `Unknown subject/type: ${subject}/${type}` }, { status: 400 })
  }

  const res = await callOllama({
    model: DEFAULT_MODEL,
    messages: [
      {
        role: 'system',
        content:
          'You are a supportive Grade 5 teacher. Grade student work fairly and provide constructive, encouraging feedback. Always respond with valid JSON only, no other text.',
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

  const result = extractJson(content)
  if (!result) {
    return Response.json({ error: 'Invalid JSON from Ollama' }, { status: 502 })
  }

  return Response.json(result)
}
