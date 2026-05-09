import { callOllama } from '@/app/api/chat/lib/ollama'
import { DEFAULT_MODEL } from '@/app/api/chat/lib/constants'
import { generateCrossword } from '@grove/games/src/crosswordGenerator.js'

const LEVEL_PROMPTS = {
  elementary: 'simple concrete vocabulary suitable for children aged 6–10',
  middleschool: 'curriculum-adjacent vocabulary suitable for students aged 11–14',
  highschool: 'advanced academic vocabulary suitable for students aged 15–18',
}

const LEVEL_CONFIG = {
  elementary: { entryCount: 8, requestCount: 24, minWordLen: 3, maxWordLen: 8 },
  middleschool: { entryCount: 12, requestCount: 30, minWordLen: 4, maxWordLen: 10 },
  highschool: { entryCount: 16, requestCount: 36, minWordLen: 4, maxWordLen: 12 },
}

const ANSWER_RE = /^[A-Z]+$/

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

function sanitizePool(rawPairs, config) {
  if (!Array.isArray(rawPairs)) return []
  const seen = new Set()
  const pool = []
  for (const pair of rawPairs) {
    if (!pair || typeof pair !== 'object') continue
    const answer = String(pair.answer ?? pair.word ?? '').toUpperCase().replace(/[^A-Z]/g, '')
    const clue = String(pair.clue ?? pair.hint ?? '').trim()
    if (!answer || !clue) continue
    if (!ANSWER_RE.test(answer)) continue
    if (answer.length < config.minWordLen || answer.length > config.maxWordLen) continue
    if (seen.has(answer)) continue
    seen.add(answer)
    pool.push({ answer, clue })
  }
  return pool
}

export async function POST(request) {
  let level = 'elementary'
  try {
    const body = await request.json()
    if (body?.level && LEVEL_PROMPTS[body.level]) {
      level = body.level
    }
  } catch {
    // Default level is fine.
  }

  const description = LEVEL_PROMPTS[level]
  const config = LEVEL_CONFIG[level]
  const seed = Math.floor(Math.random() * 1_000_000)

  const prompt =
    `Generate a list of ${config.requestCount} crossword word/clue pairs using ${description}.\n` +
    `Each answer must be a single English word in ALL CAPS, ${config.minWordLen}–${config.maxWordLen} letters, A–Z only (no spaces, hyphens, or punctuation).\n` +
    'Each clue must be short (under 60 characters) and unambiguous.\n' +
    'Use a wide variety of topics and starting letters. Avoid duplicates and avoid trivial defaults like CAT, DOG, APPLE.\n' +
    'Respond with ONLY raw JSON, no markdown, no explanation:\n' +
    '{"pairs":[{"answer":"PLANET","clue":"Orbits a star"},{"answer":"RIVER","clue":"Flows to the sea"}]}\n' +
    `Variation token (use to vary output, do not echo): ${seed}\n` +
    'Generate the list now:'

  let pool = []
  for (let attempt = 0; attempt < 3 && pool.length < config.entryCount * 2; attempt += 1) {
    let res
    try {
      res = await callOllama({
        model: DEFAULT_MODEL,
        stream: false,
        think: false,
        options: { num_predict: 1500, temperature: 0.8, top_p: 0.95, seed: seed + attempt },
        messages: [
          { role: 'system', content: 'You are a crossword word-bank assistant. Respond only with the requested JSON.' },
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
    const candidate = extractJson(content)
    const sanitized = sanitizePool(candidate?.pairs, config)
    const seenAnswers = new Set(pool.map((p) => p.answer))
    for (const pair of sanitized) {
      if (!seenAnswers.has(pair.answer)) {
        seenAnswers.add(pair.answer)
        pool.push(pair)
      }
    }
  }

  if (pool.length < 4) {
    return Response.json({ error: 'bad_puzzle' }, { status: 502 })
  }

  const generated = generateCrossword(level, Math.random(), {
    pool,
    targetEntries: config.entryCount,
  })

  if (!generated.entries || generated.entries.length < 4) {
    return Response.json({ error: 'bad_puzzle' }, { status: 502 })
  }

  const entries = generated.entries.map((e) => ({
    id: e.id,
    clue: e.clue,
    answer: String(e.answer).toUpperCase(),
    row: e.row,
    col: e.col,
    direction: e.direction,
  }))

  let maxRow = 0
  let maxCol = 0
  for (const e of entries) {
    const endRow = e.direction === 'down' ? e.row + e.answer.length - 1 : e.row
    const endCol = e.direction === 'across' ? e.col + e.answer.length - 1 : e.col
    maxRow = Math.max(maxRow, endRow)
    maxCol = Math.max(maxCol, endCol)
  }

  return Response.json({
    puzzle: {
      title: generated.title ?? 'Crossword',
      level,
      entries,
      dimensions: {
        rows: maxRow + 1,
        cols: maxCol + 1,
      },
    },
  })
}
