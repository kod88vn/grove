import { callOllama } from '@/app/api/chat/lib/ollama'
import { DEFAULT_MODEL } from '@/app/api/chat/lib/constants'

const LEVEL_PROMPTS = {
  elementary: 'simple concrete vocabulary suitable for children aged 6–10',
  middleschool: 'curriculum-adjacent vocabulary suitable for students aged 11–14',
  highschool: 'advanced academic vocabulary suitable for students aged 15–18',
}

const LEVEL_CONFIG = {
  elementary: { gridSize: 7, entryCount: 8, minIntersectionsPerEntry: 2, minFillRatio: 0.35 },
  middleschool: { gridSize: 11, entryCount: 12, minIntersectionsPerEntry: 2, minFillRatio: 0.28 },
  highschool: { gridSize: 15, entryCount: 16, minIntersectionsPerEntry: 2, minFillRatio: 0.2 },
}

const ANSWER_RE = /^[A-Z]{3,12}$/

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

function getEntryCells(entry) {
  return Array.from({ length: entry.answer.length }, (_, idx) => ({
    row: entry.row + (entry.direction === 'down' ? idx : 0),
    col: entry.col + (entry.direction === 'across' ? idx : 0),
    letter: entry.answer[idx],
  }))
}

function validatePuzzle(parsed, config) {
  if (!parsed || !Array.isArray(parsed.entries) || parsed.entries.length !== config.entryCount) return false

  const across = parsed.entries.filter((e) => e.direction === 'across').length
  const down = parsed.entries.filter((e) => e.direction === 'down').length
  if (across !== config.entryCount / 2 || down !== config.entryCount / 2) return false

  if (
    !parsed.entries.every(
      (e) =>
        e.id &&
        e.clue &&
        (e.direction === 'across' || e.direction === 'down') &&
        ANSWER_RE.test(String(e.answer ?? '').toUpperCase()) &&
        Number.isInteger(e.row) &&
        Number.isInteger(e.col),
    )
  ) {
    return false
  }

  const entries = parsed.entries.map((entry) => ({
    ...entry,
    answer: String(entry.answer).toUpperCase(),
  }))

  const cellMap = new Map()
  const touchCounts = new Map()
  const entryTouches = Array.from({ length: entries.length }, () => new Set())

  for (let i = 0; i < entries.length; i += 1) {
    const entry = entries[i]
    for (const cell of getEntryCells(entry)) {
      if (cell.row < 0 || cell.col < 0 || cell.row >= config.gridSize || cell.col >= config.gridSize) {
        return false
      }

      const key = `${cell.row},${cell.col}`
      const existing = cellMap.get(key)
      if (existing && existing.letter !== cell.letter) {
        return false
      }

      if (!existing) {
        cellMap.set(key, { letter: cell.letter, owners: [i] })
        touchCounts.set(key, 1)
      } else {
        if (!existing.owners.includes(i)) {
          existing.owners.push(i)
          touchCounts.set(key, (touchCounts.get(key) ?? 1) + 1)
        }
      }
    }
  }

  for (const { owners } of cellMap.values()) {
    if (owners.length < 2) {
      continue
    }
    for (const owner of owners) {
      for (const otherOwner of owners) {
        if (owner !== otherOwner) {
          entryTouches[owner].add(otherOwner)
        }
      }
    }
  }

  for (const touches of entryTouches) {
    if (touches.size < config.minIntersectionsPerEntry) {
      return false
    }
  }

  const visited = new Set([0])
  const queue = [0]
  while (queue.length) {
    const current = queue.shift()
    for (const neighbor of entryTouches[current]) {
      if (!visited.has(neighbor)) {
        visited.add(neighbor)
        queue.push(neighbor)
      }
    }
  }

  if (visited.size !== entries.length) {
    return false
  }

  const filledCells = touchCounts.size
  const minFilledCells = Math.ceil(config.gridSize * config.gridSize * config.minFillRatio)
  return filledCells >= minFilledCells
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
  const entryCount = config.entryCount
  const gridSize = config.gridSize

  const prompt =
    `Create one ${gridSize}x${gridSize} crossword puzzle using ${description}.\n` +
    'Respond ONLY with raw JSON, no explanation, no markdown.\n' +
    `Generate exactly ${entryCount} entries: ${entryCount / 2} across and ${entryCount / 2} down.\n` +
    '\n' +
    'CRITICAL REQUIREMENTS FOR PUZZLE QUALITY:\n' +
    `1. INTERSECTIONS: Every entry must intersect with at least ${config.minIntersectionsPerEntry} other entries.\n` +
    '2. GRID SPREAD: Distribute entries across the entire grid (not clustered in one corner).\n' +
    '3. LETTER MATCHING: Crossing letters MUST match exactly at every intersection.\n' +
    '4. CONTIGUITY: All entries must form one connected grid (no isolated islands).\n' +
    '5. WORD LENGTH: Each answer must be 3–12 characters, preferably 5–8 characters.\n' +
    `6. DENSITY: Fill at least ${Math.round(config.minFillRatio * 100)}% of the grid with letters (not mostly empty).\n` +
    '\n' +
    'STRATEGY FOR PLACEMENT:\n' +
    '- Start with a main horizontal entry near the top-left, at least 6 letters long.\n' +
    '- Add vertical entries that cross this main word, ensuring letters match.\n' +
    '- Build out horizontally and vertically in a balanced pattern.\n' +
    '- Ensure each entry touches at least 2 other entries.\n' +
    '\n' +
    'EXAMPLE SHAPE (replace with your generated content and exact required entry count):\n' +
    '{"title":"Sample","entries":[\n' +
    '  {"id":"1A","clue":"A thing","answer":"APPLE","row":0,"col":0,"direction":"across"},\n' +
    '  {"id":"1D","clue":"Egg container","answer":"NEST","row":0,"col":0,"direction":"down"},\n' +
    '  {"id":"2D","clue":"Writing fluid","answer":"INK","row":0,"col":2,"direction":"down"},\n' +
    '  {"id":"3A","clue":"Close","answer":"NEAR","row":2,"col":1,"direction":"across"}\n' +
    ']}\n' +
    '\n' +
    'Generate the puzzle now:'

  let parsed = null
  for (let attempt = 0; attempt < 3; attempt += 1) {
    let res
    try {
      res = await callOllama({
        model: DEFAULT_MODEL,
        stream: false,
        think: false,
        options: { num_predict: 1500, temperature: 0.2 },
        messages: [
          { role: 'system', content: 'You are a crossword assistant. Respond only with the requested JSON.' },
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
    if (candidate && validatePuzzle(candidate, config)) {
      parsed = candidate
      break
    }
  }

  if (!parsed) {
    return Response.json({ error: 'bad_puzzle' }, { status: 502 })
  }

  return Response.json({
    puzzle: {
      title: parsed.title ?? 'Crossword',
      level,
      entries: parsed.entries.map((e) => ({
        id: e.id,
        clue: e.clue,
        answer: String(e.answer).toUpperCase(),
        row: e.row,
        col: e.col,
        direction: e.direction,
      })),
    },
  })
}
