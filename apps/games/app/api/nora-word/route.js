const LEVEL_DESCRIPTIONS = {
  elementary: 'a simple, everyday word suitable for children aged 6-10. Use common nouns like animals, food, or everyday objects. Maximum 8 letters.',
  middleschool: 'a moderately challenging word suitable for students aged 11-14. Use academic vocabulary from science, geography, or general knowledge. 6-12 letters.',
  highschool: 'a challenging word suitable for students aged 15-18. Use advanced academic or scientific vocabulary. 8-15 letters.',
}

function extractJson(text) {
  // Strip markdown code fences if present
  const stripped = text.replace(/```(?:json)?\s*/gi, '').replace(/```/g, '').trim()
  // Find first {...} block
  const match = stripped.match(/\{[\s\S]*?\}/)
  if (!match) return null
  try {
    return JSON.parse(match[0])
  } catch {
    return null
  }
}

export async function POST(request) {
  let level = 'elementary'
  try {
    const body = await request.json()
    if (body?.level && LEVEL_DESCRIPTIONS[body.level]) {
      level = body.level
    }
  } catch {
    // default level is fine
  }

  const prompt = `Give me one hangman word for the following difficulty level: ${LEVEL_DESCRIPTIONS[level]}
Respond ONLY with a raw JSON object, no explanation, no markdown:
{ "word": "EXAMPLE", "hint": "A short descriptive clue (max 10 words).", "mascot": "🎯" }
The word must be a single word, uppercase letters only, no spaces or hyphens.`

  try {
    const res = await fetch('http://grove:11434/api/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: 'llama3.2',
        stream: false,
        options: { num_predict: 80, temperature: 0.9 },
        messages: [
          { role: 'system', content: 'You are a word game assistant. Respond only with the requested JSON.' },
          { role: 'user', content: prompt },
        ],
      }),
      signal: AbortSignal.timeout(6000),
    })

    if (!res.ok) {
      return Response.json({ error: 'ollama_unavailable' }, { status: 502 })
    }

    const json = await res.json()
    const content = json?.message?.content ?? ''
    const parsed = extractJson(content)

    if (!parsed?.word || !/^[A-Z]{2,20}$/.test(parsed.word)) {
      return Response.json({ error: 'invalid_response' }, { status: 502 })
    }

    return Response.json({
      word: parsed.word,
      hint: String(parsed.hint || '').trim().slice(0, 120) || 'Can you guess this word?',
      mascot: String(parsed.mascot || '🎯').slice(0, 8),
    })
  } catch {
    return Response.json({ error: 'request_failed' }, { status: 502 })
  }
}
