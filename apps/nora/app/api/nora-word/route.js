import { callOllama } from '@/app/api/chat/lib/ollama'
import { DEFAULT_MODEL } from '@/app/api/chat/lib/constants'

const LEVEL_PROMPTS = {
  elementary: 'everyday concrete vocabulary suitable for young children (ages 6–10)',
  middleschool: 'curriculum-adjacent general academic terms for middle schoolers (ages 11–14)',
  highschool: 'advanced STEM or humanities vocabulary for high schoolers (ages 15–18)',
}

const WORD_RE = /^[A-Z]{4,12}$/

function cleanResponseContent(content) {
  return String(content || '')
    .trim()
    .replace(/^```[a-z]*\n?/i, '')
    .replace(/\n?```$/, '')
    .trim()
}

function parseWordPayload(rawContent) {
  const cleaned = cleanResponseContent(rawContent)

  try {
    return JSON.parse(cleaned)
  } catch {
    // Some models still prepend text despite JSON-mode; extract the first object.
    const firstBrace = cleaned.indexOf('{')
    const lastBrace = cleaned.lastIndexOf('}')
    if (firstBrace >= 0 && lastBrace > firstBrace) {
      try {
        return JSON.parse(cleaned.slice(firstBrace, lastBrace + 1))
      } catch {
        return null
      }
    }
    return null
  }
}

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

  let lastError = 'ai_unavailable'

  for (let attempt = 0; attempt < 2; attempt += 1) {
    let res
    try {
      res = await callOllama({
        model: DEFAULT_MODEL,
        stream: false,
        format: 'json',
        options: {
          think: false,
          temperature: 0,
          num_predict: 80,
        },
        messages: [
          { role: 'system', content: 'You are a helpful word game assistant. Respond only with valid JSON.' },
          {
            role: 'user',
            content:
              attempt === 0
                ? prompt
                : `${prompt}\nIMPORTANT: Output a single JSON object only. No prose, no markdown, no code fence.`,
          },
        ],
      })
    } catch {
      lastError = 'ai_unavailable'
      continue
    }

    if (!res.ok) {
      lastError = 'ai_unavailable'
      continue
    }

    let json
    try {
      json = await res.json()
    } catch {
      lastError = 'bad_response'
      continue
    }

    const parsed = parseWordPayload(json.message?.content)
    if (!parsed || typeof parsed !== 'object') {
      lastError = 'bad_word'
      continue
    }

    const word = typeof parsed.word === 'string' ? parsed.word.trim().toUpperCase() : ''
    if (!WORD_RE.test(word)) {
      lastError = 'bad_word'
      continue
    }

    return Response.json({
      word,
      hint: parsed.hint ?? '',
      mascot: parsed.mascot ?? '🤔',
    })
  }

  const status = lastError === 'ai_unavailable' ? 503 : 502
  return Response.json({ error: lastError }, { status })
}
