export async function POST(request) {
  let level = 'elementary'
  try {
    const body = await request.json()
    if (body?.level && ['elementary', 'middleschool', 'highschool'].includes(body.level)) {
      level = body.level
    }
  } catch {
    // Default level is fine.
  }

  try {
    const noraUrl = process.env.PLT_NORA_URL || 'http://localhost:3001'
    // Per AGENTS.md: sibling apps must call Nora API routes, not internal /api/chat
    const res = await fetch(`${noraUrl}/api/nora-crossword`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ level }),
      signal: AbortSignal.timeout(30000),
    })

    if (!res.ok) {
      return Response.json({ error: 'ai_unavailable' }, { status: 503 })
    }

    const json = await res.json()
    if (!json?.puzzle) {
      return Response.json({ error: 'bad_response' }, { status: 502 })
    }

    // Nora's /api/nora-crossword already returns a normalized puzzle with proper numbering
    return Response.json({ puzzle: json.puzzle })
  } catch {
    return Response.json({ error: 'request_failed' }, { status: 502 })
  }
}