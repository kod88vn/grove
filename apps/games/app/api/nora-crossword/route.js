import { normalizeCrosswordPuzzle } from '../../../src/index.js'

const LEVEL_DESCRIPTIONS = {
  elementary: 'simple concrete vocabulary suitable for children aged 6-10',
  middleschool: 'curriculum-adjacent vocabulary suitable for students aged 11-14',
  highschool: 'advanced academic vocabulary suitable for students aged 15-18',
}

const LEVEL_CONFIG = {
  elementary: { gridSize: 7, entryCount: 8, minIntersectionsPerEntry: 2 },
  middleschool: { gridSize: 11, entryCount: 12, minIntersectionsPerEntry: 2 },
  highschool: { gridSize: 15, entryCount: 16, minIntersectionsPerEntry: 2 },
}

function extractJson(text) {
  const stripped = String(text || '').replace(/```(?:json)?\s*/gi, '').replace(/```/g, '').trim()
  const match = stripped.match(/\{[\s\S]*\}/)
  if (!match) {
    return null
  }

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

function hasExpectedShape(puzzle, config) {
  if (puzzle.entries.length !== config.entryCount) {
    return false
  }

  const across = puzzle.entries.filter((entry) => entry.direction === 'across').length
  const down = puzzle.entries.filter((entry) => entry.direction === 'down').length
  if (across !== config.entryCount / 2 || down !== config.entryCount / 2) {
    return false
  }

  const cellOwners = new Map()
  const touches = Array.from({ length: puzzle.entries.length }, () => new Set())

  for (let i = 0; i < puzzle.entries.length; i += 1) {
    const entry = puzzle.entries[i]
    for (const cell of getEntryCells(entry)) {
      if (cell.row < 0 || cell.col < 0 || cell.row >= config.gridSize || cell.col >= config.gridSize) {
        return false
      }

      const key = `${cell.row},${cell.col}`
      const owners = cellOwners.get(key) ?? []
      owners.push(i)
      cellOwners.set(key, owners)
    }
  }

  for (const owners of cellOwners.values()) {
    if (owners.length < 2) {
      continue
    }
    for (const owner of owners) {
      for (const other of owners) {
        if (owner !== other) {
          touches[owner].add(other)
        }
      }
    }
  }

  return touches.every((set) => set.size >= config.minIntersectionsPerEntry)
}

export async function POST(request) {
  let level = 'elementary'
  try {
    const body = await request.json()
    if (body?.level && LEVEL_DESCRIPTIONS[body.level]) {
      level = body.level
    }
  } catch {
    // Default level is fine.
  }

  const config = LEVEL_CONFIG[level]
  const entryCount = config.entryCount
  const gridSize = config.gridSize

  const prompt =
    `Create one ${gridSize}x${gridSize} crossword using ${LEVEL_DESCRIPTIONS[level]}.\n` +
    'Respond ONLY with raw JSON, no explanation, no markdown.\n' +
    `The crossword must contain exactly ${entryCount} entries: ${entryCount / 2} across and ${entryCount / 2} down.\n` +
    'All answers must be uppercase letters only, 3-10 characters.\n' +
    'Every entry must intersect with at least 2 other entries and all intersections must match exactly.\n' +
    'All entries must be connected in one crossword (no isolated words).\n' +
    'Use this exact shape:\n' +
    '{"title":"...","entries":[{"id":"1A","clue":"...","answer":"WORD","row":0,"col":0,"direction":"across"}]}'

  for (let attempt = 0; attempt < 3; attempt += 1) {
    try {
      const res = await fetch('http://grove:11434/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: 'llama3.2',
          stream: false,
          options: { num_predict: 500, temperature: 0.2 },
          messages: [
            { role: 'system', content: 'You are a crossword assistant. Respond only with the requested JSON.' },
            { role: 'user', content: prompt },
          ],
        }),
        signal: AbortSignal.timeout(7000),
      })

      if (!res.ok) {
        return Response.json({ error: 'ollama_unavailable' }, { status: 502 })
      }

      const json = await res.json()
      const parsed = extractJson(json?.message?.content)
      if (!parsed) {
        continue
      }

      let puzzle
      try {
        puzzle = normalizeCrosswordPuzzle(
          {
            title: parsed.title,
            level,
            entries: parsed.entries,
          },
          level,
        )
      } catch {
        continue
      }

      if (!hasExpectedShape(puzzle, config)) {
        continue
      }

      return Response.json({ puzzle })
    } catch {
      return Response.json({ error: 'request_failed' }, { status: 502 })
    }
  }

  return Response.json({ error: 'invalid_puzzle' }, { status: 502 })
}