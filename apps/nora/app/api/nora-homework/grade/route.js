import { callAI } from '@/app/api/chat/lib/callAI'
import { DEFAULT_MODEL } from '@/app/api/chat/lib/constants'

const HOMEWORKS_MODEL = process.env.HOMEWORKS_OLLAMA_MODEL || DEFAULT_MODEL
const MAX_OLLAMA_ATTEMPTS = 3

const ENGLISH_READING_GRADE_SCHEMA = {
  type: 'object',
  properties: {
    answers: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          id: { type: 'integer' },
          score: { type: 'number' },
          feedback: { type: 'string' },
        },
        required: ['id', 'score', 'feedback'],
      },
    },
    totalScore: { type: 'number' },
    maxScore: { type: 'number' },
    overallFeedback: { type: 'string' },
  },
  required: ['answers', 'totalScore', 'maxScore', 'overallFeedback'],
  additionalProperties: false,
}

const ENGLISH_WRITING_GRADE_SCHEMA = {
  type: 'object',
  properties: {
    criteria: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          name: { type: 'string' },
          score: { type: 'number' },
          maxScore: { type: 'number' },
          feedback: { type: 'string' },
        },
        required: ['name', 'score', 'maxScore', 'feedback'],
      },
    },
    totalScore: { type: 'number' },
    maxScore: { type: 'number' },
    comment: { type: 'string' },
  },
  required: ['criteria', 'totalScore', 'maxScore', 'comment'],
  additionalProperties: false,
}

const MATH_MIXED_GRADE_SCHEMA = {
  type: 'object',
  properties: {
    problems: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          id: { type: 'integer' },
          answer: { type: 'string' },
          correct: { type: 'boolean' },
          workShown: { type: 'boolean' },
          feedback: { type: 'string' },
        },
        required: ['id', 'answer', 'correct', 'workShown', 'feedback'],
      },
    },
    totalCorrect: { type: 'number' },
    totalProblems: { type: 'number' },
    score: { type: 'number' },
    comment: { type: 'string' },
  },
  required: ['problems', 'totalCorrect', 'totalProblems', 'score', 'comment'],
  additionalProperties: false,
}

function getGradeSchema(subject, type) {
  if (subject === 'english' && type === 'reading') return ENGLISH_READING_GRADE_SCHEMA
  if (subject === 'english' && type === 'writing') return ENGLISH_WRITING_GRADE_SCHEMA
  if (subject === 'math' && type === 'mixed') return MATH_MIXED_GRADE_SCHEMA
  return null
}

function buildPrompt(subject, type, exercise, answers) {
  if (subject === 'english' && type === 'reading') {
    const lessonContext = exercise.lessonKeyPoint ? `\n\nThe educational lesson in this passage is: ${exercise.lessonKeyPoint}. When grading, give extra credit to students who demonstrate they understood this concept.` : ''
    return `You are a Grade 5 teacher grading reading comprehension for an educational passage.

Exercise: ${JSON.stringify(exercise)}
Student Answers: ${JSON.stringify(answers)}${lessonContext}

Grade each answer and provide:
1. Score for each answer (points) — 1 point for correct/acceptable, 0 for incorrect
2. Feedback explaining what was good and what needs improvement
3. Overall score and encouraging comment

Special grading notes:
- For literal comprehension questions: accept any answer that correctly identifies what was stated in the text
- For concept/lesson questions: reward answers that show understanding of the educational concept, even if phrased differently than the model answer
- For inference questions: accept reasonable inferences grounded in the passage content

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

function parseModelJson(json) {
  const content = json?.message?.content
  if (content && typeof content === 'object') {
    return content
  }

  const trimmed = typeof content === 'string' ? content.trim() : ''
  if (!trimmed) {
    return null
  }

  return extractJson(trimmed)
}

async function gradeWithOllama(prompt, format) {
  let lastError = null

  for (let attempt = 1; attempt <= MAX_OLLAMA_ATTEMPTS; attempt += 1) {
    try {
      const res = await callAI({
        model: HOMEWORKS_MODEL,
        messages: [
          {
            role: 'system',
            content:
              'You are a supportive Grade 5 teacher. Grade student work fairly and provide constructive, encouraging feedback. Return only JSON that matches the provided schema exactly. No markdown, no prose.',
          },
          { role: 'user', content: prompt },
        ],
        stream: false,
        think: false,
        format,
      })

      if (!res.ok) {
        throw new Error(`AI error: ${res.status}`)
      }

      const json = await res.json()
      const parsed = parseModelJson(json)
      if (!parsed) {
        throw new Error('Empty response from AI')
      }

      return parsed
    } catch (error) {
      lastError = error
      if (attempt === MAX_OLLAMA_ATTEMPTS) {
        break
      }
    }
  }

  throw lastError || new Error('Failed to grade with AI')
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
  const format = getGradeSchema(subject, type)

  if (!prompt || !format) {
    return Response.json({ error: `Unknown subject/type: ${subject}/${type}` }, { status: 400 })
  }

  try {
    const result = await gradeWithOllama(prompt, format)
    return Response.json(result)
  } catch (error) {
    return Response.json(
      { error: error instanceof Error ? error.message : 'Failed to grade submission' },
      { status: 502 }
    )
  }
}
