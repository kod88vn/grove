import { callAI } from '@/app/api/chat/lib/callAI'
import { DEFAULT_MODEL } from '@/app/api/chat/lib/constants'

const LEVEL_PROMPTS = {
  elementary: 'everyday concrete vocabulary suitable for young children (ages 6–10)',
  middleschool: 'curriculum-adjacent general academic terms for middle schoolers (ages 11–14)',
  highschool: 'advanced STEM or humanities vocabulary for high schoolers (ages 15–18)',
}

const WORD_RE = /^[A-Z]{3,12}$/

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

  // Random seed/letter hint to prevent the model from returning the same
  // deterministic word on every call.
  const seed = Math.floor(Math.random() * 1_000_000)
  const startLetter = String.fromCharCode(65 + Math.floor(Math.random() * 26))

  const prompt =
    `Give me one hangman word using ${description}.\n` +
    `Pick a fresh, surprising word that starts with the letter "${startLetter}" if possible (otherwise any letter).\n` +
    `Avoid common defaults like CAT, DOG, APPLE, ELEPHANT.\n` +
    `The example below shows the required JSON shape only — do NOT use the example word or hint:\n` +
    `{"word":"ORCHID","hint":"A fragrant flower","mascot":"🌸"}\n` +
    `The word must be a single English word in ALL CAPS, 3–12 letters, no spaces or punctuation.\n` +
    `Variation token: ${seed}. Use it to steer your choice away from the word you would pick by default.`

  let lastError = 'ai_unavailable'

  for (let attempt = 0; attempt < 2; attempt += 1) {
    let res
    try {
      res = await callAI({
        model: DEFAULT_MODEL,
        stream: false,
        options: {
          temperature: 0.9,
          // 512 keeps headroom if the model thinks anyway; the JSON itself is short.
          num_predict: 512,
          // Must live in `options` — buildLmstudioPayload maps these to
          // enable_thinking / response_format for the OpenAI-compatible backend.
          think: false,
          response_format: { type: 'json_object' },
        },
        messages: [
          { role: 'system', content: 'You are a helpful word game assistant. Respond only with valid JSON.' },
          {
            role: 'user',
            content:
              attempt === 0
                ? prompt
                : `${prompt}\nYour previous output was not a valid word. Output a DIFFERENT valid word now, as a single JSON object with no prose, markdown, or code fence.`,
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
