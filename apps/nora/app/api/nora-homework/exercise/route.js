import { callOllama } from '@/app/api/chat/lib/ollama'
import { DEFAULT_MODEL } from '@/app/api/chat/lib/constants'

const HOMEWORKS_MODEL = process.env.HOMEWORKS_OLLAMA_MODEL || DEFAULT_MODEL
const MAX_OLLAMA_ATTEMPTS = 3
const TOPIC_HISTORY_WINDOW = 10

const READING_THEMES = [
  'storytelling adventure',
  'mini research discovery',
  'problem solving challenge',
  'mystery investigation',
  'creative invention journey',
  'teamwork mission',
  'biography spotlight',
  'cause and effect exploration',
  'compare and contrast scenario',
  'historical moment retelling',
  'debate and discussion moment',
  'act of courage',
  'service and leadership',
  'investigative journalism for kids',
  'festival or celebration planning',
]

const READING_DOMAINS = [
  'history',
  'science',
  'nature',
  'music',
  'math in daily life',
  'community helpers',
  'engineering',
  'geography',
  'art and design',
  'sports and health',
  'technology and coding',
  'environmental care',
  'space exploration',
  'food and nutrition',
  'architecture',
  'transportation systems',
  'marine life',
]

const READING_TONES = [
  'curious and wonder-filled',
  'warm and encouraging',
  'playful and energetic',
  'suspenseful but safe',
  'thoughtful and reflective',
  'optimistic and inspiring',
  'humorous and light',
  'focused and determined',
  'calm and reflective',
  'brave and resilient',
]

const READING_STYLES = [
  'narrative story',
  'journal entry',
  'news report',
  'interview transcript',
  'field notes',
  'letter to a friend',
  'magazine feature',
  'day-in-the-life account',
  'dialogue scene',
  'step-by-step explainer',
]

const READING_SETTINGS = [
  'school campus',
  'museum',
  'community center',
  'small town park',
  'music studio',
  'science fair',
  'library',
  'sports field',
  'nature trail',
  'local workshop',
  'train station',
  'farm',
  'aquarium',
  'city hall',
  'planetarium',
]

const READING_PERSPECTIVES = [
  'first-person student narrator',
  'third-person close narration',
  'first-person team narrator using we',
  'third-person observer voice',
]

const READING_HOOKS = [
  'A surprising clue appears before class starts.',
  'A small mistake leads to a big discovery.',
  'A challenge timer starts counting down.',
  'A visitor asks the class for help.',
  'An unusual object is found in a familiar place.',
  'A question no one can answer sparks an investigation.',
  'A rehearsal goes wrong in an unexpected way.',
  'A simple map reveals a hidden pattern.',
]

const recentReadingTopics = []

function pickRandom(items) {
  return items[Math.floor(Math.random() * items.length)]
}

function buildTopicKey(topic) {
  return `${topic.theme}|${topic.domain}|${topic.style}|${topic.setting}`
}

function buildCandidateProfiles() {
  const candidates = []
  const seen = new Set()

  while (candidates.length < 10 && seen.size < 200) {
    const candidate = {
      theme: pickRandom(READING_THEMES),
      domain: pickRandom(READING_DOMAINS),
      tone: pickRandom(READING_TONES),
      style: pickRandom(READING_STYLES),
      setting: pickRandom(READING_SETTINGS),
      perspective: pickRandom(READING_PERSPECTIVES),
      hook: pickRandom(READING_HOOKS),
    }

    const key = buildTopicKey(candidate)
    if (!seen.has(key) && !recentReadingTopics.includes(key)) {
      seen.add(key)
      candidates.push(candidate)
    }
  }

  if (candidates.length === 0) {
    candidates.push({
      theme: pickRandom(READING_THEMES),
      domain: pickRandom(READING_DOMAINS),
      tone: pickRandom(READING_TONES),
      style: pickRandom(READING_STYLES),
      setting: pickRandom(READING_SETTINGS),
      perspective: pickRandom(READING_PERSPECTIVES),
      hook: pickRandom(READING_HOOKS),
    })
  }

  return candidates
}

function profileScore(candidate) {
  let score = 0

  if (candidate.theme.includes('research') && candidate.style.includes('report')) score += 2
  if (candidate.theme.includes('mystery') && candidate.tone.includes('suspenseful')) score += 2
  if (candidate.domain.includes('history') && candidate.style.includes('news')) score += 1
  if (candidate.domain.includes('science') && candidate.setting.includes('lab')) score += 1
  if (candidate.domain.includes('music') && candidate.setting.includes('music')) score += 1
  if (candidate.theme.includes('team') && candidate.perspective.includes('we')) score += 1
  if (candidate.theme.includes('discovery') && candidate.hook.includes('discovery')) score += 1

  return score
}

function selectReadingTopic(candidates) {
  return candidates
    .map((candidate) => ({ candidate, score: profileScore(candidate) }))
    .sort((a, b) => b.score - a.score)[0].candidate
}

function buildReadingPassagePrompt(profile) {
  return `Write one Grade 5 reading passage and return JSON only.

Use this profile:
Theme: ${profile.theme}
Domain: ${profile.domain}
Tone: ${profile.tone}
Style: ${profile.style}
Setting: ${profile.setting}
Perspective: ${profile.perspective}
Hook: ${profile.hook}

Rules:
- 110-140 words
- age-appropriate and engaging
- concrete details, no generic filler
- no title, no markdown

Return exactly: {"passage":"..."}`
}

const PASSAGE_SCHEMA = {
  type: 'object',
  properties: {
    passage: { type: 'string' },
  },
  required: ['passage'],
  additionalProperties: false,
}

const QUESTIONS_SCHEMA = {
  type: 'object',
  properties: {
    questions: {
      type: 'array',
      minItems: 3,
      maxItems: 3,
      items: {
        type: 'object',
        properties: {
          id: { type: 'integer' },
          type: { type: 'string', enum: ['multiple-choice', 'short-answer'] },
          question: { type: 'string' },
          options: {
            type: 'array',
            items: { type: 'string' },
          },
          correctAnswer: { type: 'string' },
        },
        required: ['id', 'type', 'question', 'correctAnswer'],
      },
    },
  },
  required: ['questions'],
  additionalProperties: false,
}

const WRITING_SCHEMA = {
  type: 'object',
  properties: {
    prompt: { type: 'string' },
    keyPoints: { type: 'array', items: { type: 'string' } },
    outline: { type: 'array', items: { type: 'string' } },
    wordCountTarget: { type: 'string' },
  },
  required: ['prompt', 'keyPoints', 'outline', 'wordCountTarget'],
  additionalProperties: false,
}

const MATH_MIXED_SCHEMA = {
  type: 'object',
  properties: {
    problems: {
      type: 'array',
      minItems: 10,
      maxItems: 10,
      items: {
        type: 'object',
        properties: {
          id: { type: 'integer' },
          problem: { type: 'string' },
          problemType: { type: 'string', enum: ['column-method', 'standard'] },
          operands: { type: 'array', items: { type: 'string' } },
          operator: { type: 'string' },
          operations: { type: 'array', items: { type: 'string' } },
          expectedAnswer: { type: 'string' },
          difficulty: { type: 'string', enum: ['easy', 'medium', 'hard'] },
        },
        required: [
          'id',
          'problem',
          'problemType',
          'operands',
          'operator',
          'operations',
          'expectedAnswer',
          'difficulty',
        ],
      },
    },
  },
  required: ['problems'],
  additionalProperties: false,
}

const PROMPTS = {
  english: {
    readingQuestions: `Given the passage below, create exactly 3 Grade 5 comprehension questions:
1) one multiple-choice with exactly 3 options,
2) one short-answer,
3) one creative short-answer.

Return JSON only:
{"questions":[{"id":1,"type":"multiple-choice","question":"...","options":["...","...","..."],"correctAnswer":"..."},{"id":2,"type":"short-answer","question":"...","correctAnswer":"..."},{"id":3,"type":"short-answer","question":"...","correctAnswer":"..."}]}`,
    writing: `Generate a Grade 5 appropriate writing exercise. Include:
1. A writing prompt (2-3 sentences)
2. Key points they should address (3-4 bullet points)
3. Example structure/outline

Format as JSON with keys: prompt, keyPoints, outline, wordCountTarget (suggest 150-250 words)`,
  },
  math: {
    mixed: `Generate a Grade 5 Math quiz with exactly 10 problems. Keep text short and compact.

Requirements:
- Exactly 10 problems total.
- At least 5 must be "column-method" addition/subtraction with 2-4 digit whole numbers.
- Remaining problems must be "standard" multiplication/division facts.
- For "column-method":
  - operands: two number strings, e.g. ["324","251"]
  - operator: "+" or "-"
- For "standard":
  - operands: []
  - operator: ""
- operations: 1-2 simple words, e.g. ["addition"].
- difficulty: easy | medium | hard.

Return JSON only:
{"problems":[{"id":1,"problem":"324 + 251 = ?","problemType":"column-method","operands":["324","251"],"operator":"+","operations":["addition"],"expectedAnswer":"575","difficulty":"easy"},{"id":2,"problem":"8 x 7 = ?","problemType":"standard","operands":[],"operator":"","operations":["multiplication"],"expectedAnswer":"56","difficulty":"medium"}]}`,
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

async function askJson(messages, numPredict = 300, format = 'json', temperature = 0.3) {
  let lastError = null

  for (let attempt = 1; attempt <= MAX_OLLAMA_ATTEMPTS; attempt += 1) {
    try {
      const res = await callOllama({
        model: HOMEWORKS_MODEL,
        messages,
        stream: false,
        think: false,
        format,
        options: {
          num_predict: numPredict,
          temperature,
        },
      })

      if (!res.ok) {
        throw new Error(`Ollama error: ${res.status}`)
      }

      const json = await res.json()
      const parsed = parseModelJson(json)
      if (!parsed) {
        throw new Error('Empty response from Ollama')
      }

      return parsed
    } catch (error) {
      lastError = error
      if (attempt === MAX_OLLAMA_ATTEMPTS) {
        break
      }
    }
  }

  throw lastError || new Error('Failed to generate JSON from Ollama')
}

export async function POST(request) {
  let body
  try {
    body = await request.json()
  } catch {
    return Response.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  const { subject, type } = body || {}
  if (!PROMPTS[subject]?.[type] && !(subject === 'english' && type === 'reading')) {
    return Response.json({ error: `Unknown subject/type: ${subject}/${type}` }, { status: 400 })
  }

  try {
    if (subject === 'english' && type === 'reading') {
      const candidateProfiles = buildCandidateProfiles()
      const selectedTopic = selectReadingTopic(candidateProfiles)
      const topicKey = buildTopicKey(selectedTopic)
      recentReadingTopics.push(topicKey)
      if (recentReadingTopics.length > TOPIC_HISTORY_WINDOW) {
        recentReadingTopics.shift()
      }

      const passageJson = await askJson(
        [
          {
            role: 'system',
            content:
              'You are an expert Grade 5 teacher. Return only JSON that matches the provided schema exactly. No markdown, no prose.',
          },
          { role: 'user', content: buildReadingPassagePrompt(selectedTopic) },
        ],
        320,
        PASSAGE_SCHEMA,
        0.55
      )

      const passage = String(passageJson.passage || '').trim()
      if (!passage) {
        return Response.json({ error: 'Failed to generate passage' }, { status: 502 })
      }

      const questionsJson = await askJson(
        [
          {
            role: 'system',
            content:
              'You are an expert Grade 5 teacher. Return only JSON that matches the provided schema exactly. No markdown, no prose.',
          },
          {
            role: 'user',
            content: `${PROMPTS.english.readingQuestions}\n\nPassage:\n${passage}`,
          },
        ],
        260,
        QUESTIONS_SCHEMA
      )

      const questions = Array.isArray(questionsJson.questions) ? questionsJson.questions : []
      if (questions.length === 0) {
        return Response.json({ error: 'Failed to generate questions' }, { status: 502 })
      }

      return Response.json({ passage, questions })
    }

    const prompt = PROMPTS[subject][type]
    const exercise = await askJson(
      [
        {
          role: 'system',
          content:
            'You are an expert Grade 5 teacher. Return only JSON that matches the provided schema exactly. No markdown, no prose.',
        },
        { role: 'user', content: prompt },
      ],
      subject === 'math' ? 1600 : 360,
      subject === 'english' && type === 'writing' ? WRITING_SCHEMA : MATH_MIXED_SCHEMA
    )

    return Response.json(exercise)
  } catch (error) {
    return Response.json(
      { error: error instanceof Error ? error.message : 'Failed to generate exercise' },
      { status: 502 }
    )
  }
}
