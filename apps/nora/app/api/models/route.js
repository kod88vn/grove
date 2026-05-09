const OLLAMA_TAGS_URL = `${process.env.OLLAMA_URL || 'http://grove:11434'}/api/tags`
const DEFAULT_MODEL = process.env.DEFAULT_MODEL || process.env.NEXT_PUBLIC_DEFAULT_MODEL || 'qwen3.5:9b'

function normalizeModels(payload) {
  const raw = Array.isArray(payload?.models) ? payload.models : []
  const names = raw
    .map((model) => model?.name)
    .filter((name) => typeof name === 'string' && name.trim().length > 0)

  const unique = [...new Set(names)]
  const ordered = unique.filter((name) => name !== DEFAULT_MODEL)

  return [DEFAULT_MODEL, ...ordered]
}

export async function GET() {
  try {
    const res = await fetch(OLLAMA_TAGS_URL, {
      method: 'GET',
      headers: { Accept: 'application/json' },
      cache: 'no-store',
    })

    if (!res.ok) {
      return Response.json(
        { models: [DEFAULT_MODEL], error: 'Failed to fetch models from Ollama tags.' },
        { status: 200 }
      )
    }

    const payload = await res.json()
    const models = normalizeModels(payload)

    return Response.json({ models }, { status: 200 })
  } catch {
    return Response.json(
      { models: [DEFAULT_MODEL], error: 'Unable to reach Ollama tags endpoint.' },
      { status: 200 }
    )
  }
}