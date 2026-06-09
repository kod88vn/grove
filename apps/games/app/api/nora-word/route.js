const VALID_LEVELS = ['elementary', 'middleschool', 'highschool']

export async function POST(request) {
  let level = 'elementary'
  try {
    const body = await request.json()
    if (body?.level && VALID_LEVELS.includes(body.level)) {
      level = body.level
    }
  } catch {
    // default level is fine
  }

  try {
    const noraUrl = process.env.PLT_NORA_URL || 'http://localhost:3001'
    // Per AGENTS.md: sibling apps must call Nora API routes, not internal /api/chat
    const res = await fetch(`${noraUrl}/api/nora-word`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ level }),
      signal: AbortSignal.timeout(10000),
    })

    if (!res.ok) {
      return Response.json({ error: 'ai_unavailable' }, { status: 503 })
    }

    const json = await res.json()
    if (!json?.word || !/^[A-Z]{2,20}$/.test(json.word)) {
      return Response.json({ error: 'invalid_response' }, { status: 502 })
    }

    return Response.json({
      word: json.word,
      hint: String(json.hint || '').trim().slice(0, 120) || 'Can you guess this word?',
      mascot: String(json.mascot || '\uD83C\uDFAF').slice(0, 8),
    })
  } catch {
    return Response.json({ error: 'request_failed' }, { status: 502 })
  }
}