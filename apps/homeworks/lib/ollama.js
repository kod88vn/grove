const OLLAMA_BASE_URL = process.env.OLLAMA_HOST || 'http://grove:11434'
const DEFAULT_MODEL = process.env.OLLAMA_MODEL || 'llama2'

export async function callOllama(payload) {
  try {
    const res = await fetch(`${OLLAMA_BASE_URL}/api/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    })
    
    if (!res.ok) {
      const errorDetails = await res.text().catch(() => 'No details')
      const message = res.status === 404
        ? `Ollama not found at ${OLLAMA_BASE_URL}. Ensure Ollama is running and OLLAMA_BASE_URL is set correctly.`
        : `Ollama API error: ${res.status}`
      throw new Error(message)
    }
    
    return res
  } catch (error) {
    if (error instanceof TypeError && error.message.includes('fetch')) {
      throw new Error(
        `Cannot reach Ollama at ${OLLAMA_BASE_URL}. ` +
        `Make sure Ollama is running. ` +
        `For local dev, set: OLLAMA_BASE_URL=http://localhost:11434`
      )
    }
    throw error
  }
}

export async function generateExercise(type, subject) {
  const prompts = {
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

  const prompt = prompts[subject]?.[type]
  if (!prompt) {
    throw new Error(`Unknown subject/type: ${subject}/${type}`)
  }

  const res = await callOllama({
    model: DEFAULT_MODEL,
    messages: [
      {
        role: 'system',
        content: 'You are an expert Grade 5 teacher. Generate educational exercises that are engaging, age-appropriate, and properly structured. Always respond with valid JSON only, no explanations.',
      },
      {
        role: 'user',
        content: prompt,
      },
    ],
    stream: false,
  })

  const json = await res.json()
  const content = json.message?.content?.trim()
  if (!content) {
    throw new Error('Empty response from Ollama')
  }

  try {
    return JSON.parse(content)
  } catch {
    throw new Error(`Invalid JSON from Ollama: ${content}`)
  }
}

export async function gradeSubmission(type, subject, exercise, studentAnswers) {
  const gradingPrompts = {
    english: {
      reading: `You are a Grade 5 teacher grading reading comprehension. 
      
Exercise: ${JSON.stringify(exercise)}
Student Answers: ${JSON.stringify(studentAnswers)}

Grade each answer and provide:
1. Score for each answer (points)
2. Feedback explaining what was good/needs improvement
3. Overall score and encouraging comment

Format as JSON: { answers: [{id, score, feedback}], totalScore, maxScore, overallFeedback }`,
      writing: `You are a Grade 5 teacher grading writing.

Prompt: ${exercise.prompt}
Student Writing: "${studentAnswers.text}"
Word Count: ${studentAnswers.wordCount || 'not provided'}

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
}`,
    },
    math: {
      mixed: `You are a Grade 5 math teacher grading work.

Problem Set: ${JSON.stringify(exercise)}
Student Work: ${JSON.stringify(studentAnswers)}

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
}`,
    },
  }

  const prompt = gradingPrompts[subject]?.[type]
  if (!prompt) {
    throw new Error(`Unknown subject/type for grading: ${subject}/${type}`)
  }

  const res = await callOllama({
    model: DEFAULT_MODEL,
    messages: [
      {
        role: 'system',
        content: 'You are a supportive Grade 5 teacher. Grade student work fairly and provide constructive, encouraging feedback. Always respond with valid JSON only, no other text.',
      },
      {
        role: 'user',
        content: prompt,
      },
    ],
    stream: false,
  })

  const json = await res.json()
  const content = json.message?.content?.trim()
  if (!content) {
    throw new Error('Empty response from grading service')
  }

  try {
    return JSON.parse(content)
  } catch {
    throw new Error(`Invalid JSON from grading: ${content}`)
  }
}
