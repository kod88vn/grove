import { DEFAULT_MODEL } from '../chat/lib/constants.js'

const OLLAMA_TAGS_URL = 'http://grove:11434/api/tags'

function normalizeOllamaModels(payload) {
  const raw = Array.isArray(payload?.models) ? payload.models : []
  const names = raw
    .map((model) => model?.name)
    .filter((name) => typeof name === 'string' && name.trim().length > 0)

  const unique = [...new Set(names)]
  const ordered = unique.filter((name) => name !== DEFAULT_MODEL)

  return [DEFAULT_MODEL, ...ordered]
}

function normalizeLmStudioModels(payload) {
  // LM Studio /v1/models returns { data: [{ id: 'model-name', ... }, ...] }
  const raw = Array.isArray(payload?.data) ? payload.data : []
  const names = raw
    .map((m) => m?.id || m?.name)
    .filter((n) => typeof n === 'string' && n.trim().length > 0)

  const unique = [...new Set(names)]
  const ordered = unique.filter((name) => name !== DEFAULT_MODEL)

  return [DEFAULT_MODEL, ...ordered]
}

export async function GET() {
  const provider = (process.env.AI_PROVIDER || '').toLowerCase()

  if (provider === 'lmstudio') {
    const base = (process.env.LMSTUDIO_BASE_URL || 'http://grove:1234/v1').replace(/\/+$/, '')
    const modelsUrl = `${base}/models`
    try {
      const res = await fetch(modelsUrl, { method: 'GET', headers: { Accept: 'application/json' }, cache: 'no-store' })
      if (!res.ok) {
        return Response.json({ models: [DEFAULT_MODEL], error: 'Failed to fetch models from LM Studio.' }, { status: 200 })
      }
      const payload = await res.json()
      const models = normalizeLmStudioModels(payload)
      return Response.json({ models }, { status: 200 })
    } catch (err) {
      return Response.json({ models: [DEFAULT_MODEL], error: 'Unable to reach LM Studio models endpoint.' }, { status: 200 })
    }
  }

  // Fallback: Ollama tags endpoint
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
    const models = normalizeOllamaModels(payload)

    return Response.json({ models }, { status: 200 })
  } catch {
    return Response.json(
      { models: [DEFAULT_MODEL], error: 'Unable to reach Ollama tags endpoint.' },
      { status: 200 }
    )
  }
}