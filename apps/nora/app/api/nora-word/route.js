import { callOllama } from '@/app/api/chat/lib/ollama'
import { DEFAULT_MODEL } from '@/app/api/chat/lib/constants'

const LEVEL_PROMPTS = {
  elementary: 'everyday concrete vocabulary suitable for young children (ages 6–10)',
  middleschool: 'curriculum-adjacent general academic terms for middle schoolers (ages 11–14)',
  highschool: 'advanced STEM or humanities vocabulary for high schoolers (ages 15–18)',
}

const WORD_RE = /^[A-Z]{4,12}$/

export async function POST(request) {
  let level
  try {
    const body = await request.json()
    level = body?.level
  } catch {
    return Response.json({ error: 'invalid_request' }, { status: 400 })
  }

  const description = LEVEL_PROMPTS[level] ?? LEVEL_PROMPTS.elementary

  const prompt =
    `Give me one hangman word using ${description}.\n` +
    `Respond with ONLY valid JSON, no extra text, no markdown:\n` +
    `{"word":"ELEPHANT","hint":"Largest land animal","mascot":"🐘"}\n` +
    `The word must be a single English word in ALL CAPS, 4–12 letters, no spaces or punctuation.`

  let res
  try {
    res = await callOllama({
      model: DEFAULT_MODEL,
      stream: false,
      options: { think: false, num_predict: 80 },
      messages: [
        { role: 'system', content: 'You are a helpful word game assistant. Respond only with valid JSON.' },
        { role: 'user', content: prompt },
      ],
    })
  } catch {
    return Response.json({ error: 'ai_unavailable' }, { status: 503 })
  }

  if (!res.ok) {
    return Response.json({ error: 'ai_unavailable' }, { status: 503 })
  }

  let json
  try {
    json = await res.json()
  } catch {
    return Response.json({ error: 'bad_response' }, { status: 502 })
  }

  const content = json.message?.content?.trim() ?? ''

  // Strip possible markdown code fences
  const cleaned = content.replace(/^```[a-z]*\n?/i, '').replace(/\n?```$/, '').trim()

  let parsed
  try {
    parsed = JSON.parse(cleaned)
  } catch {
    return Response.json({ error: 'bad_word' }, { status: 502 })
  }

  const word = typeof parsed.word === 'string' ? parsed.word.trim().toUpperCase() : ''
  if (!WORD_RE.test(word)) {
    return Response.json({ error: 'bad_word' }, { status: 502 })
  }

  return Response.json({
    word,
    hint: parsed.hint ?? '',
    mascot: parsed.mascot ?? '🤔',
  })
}
