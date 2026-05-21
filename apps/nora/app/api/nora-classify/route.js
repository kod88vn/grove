import { callOllama } from '@/app/api/chat/lib/ollama'
import { DEFAULT_MODEL } from '@/app/api/chat/lib/constants'

const CLASSIFIER_TIMEOUT_MS = Number(process.env.NORA_CLASSIFY_TIMEOUT_MS || 8000)

const SYSTEM_PROMPT = `You classify a user message into ONE of four routes for a family AI assistant. Reply with strict JSON only — no prose, no code fences.

Schema: {"route":"<route>","intent":"<intent>","confidence":"low|medium|high","reason":"<short>"}

Routes:
- local_tool — ONLY when the user is asking for the current local clock time or date on this device (e.g. "what time is it", "current time", "what is today's date"). intent="local_time". Do NOT use this for planning questions that merely mention time, travel time, or deadlines.
- factual_tool — current events, news, weather, live status, stock/price updates, latest versions, people, current status, or anything that requires fresh or potentially changing information. intent="factual" (or "weather" for weather questions).
- reasoning — multi-step planning, comparisons, analysis with tradeoffs, recommendations across options, or strategy questions. intent="reasoning".
- fast_chat — casual conversation, creative writing, jokes, rewrites, opinions, explanations of general knowledge that are not tied to current/fresh data, or emotional/social chat. intent="chat".

Examples:
- "who is the sitting president" => factual_tool
- "what's the latest version of React" => factual_tool
- "how's the weather tomorrow" => factual_tool
- "what time is it right now" => local_tool
- "rewrite this sentence to be friendlier" => fast_chat
- "what are the pros and cons of electric vs hybrid cars" => reasoning

When uncertain between fast_chat and factual_tool, choose factual_tool. Only choose fast_chat when the user is clearly asking for casual conversation, rewriting, or static general knowledge that does not depend on current information.`

// DEFAULT_MODEL_NORA: falls back to nora's global DEFAULT_MODEL (typically an Ollama model
// name like "llama3"). This mirrors the chat route's behaviour.
const DEFAULT_MODEL_NORA = process.env.OLLAMA_CLASSIFIER_MODEL || DEFAULT_MODEL

export async function POST(request) {
  const { message, model } = await request.json()

  if (!message || typeof message !== 'string') {
    return Response.json(
      { error: 'Missing or invalid message' },
      { status: 400 }
    )
  }

  const modelName = model || DEFAULT_MODEL_NORA
  const timeoutMs = CLASSIFIER_TIMEOUT_MS

  try {
    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), timeoutMs)

    try {
      const res = await callOllama({
        model: modelName,
        stream: false,
        format: 'json',
        options: { temperature: 0, num_predict: 120 },
        messages: [
          { role: 'system', content: SYSTEM_PROMPT },
          { role: 'user', content: message },
        ],
      })

      if (!res.ok) {
        throw new Error(`ollama_status_${res.status}`)
      }

      const body = await res.json()
      const content = body && body.message && body.message.content

      if (!content) {
        throw new Error('ollama_empty_content')
      }

      const classification = JSON.parse(content)
      return Response.json(classification)
    } finally {
      clearTimeout(timer)
    }
  } catch (err) {
    console.error('[nora-classify] Ollama classification failed:', err?.message ?? err)
    return Response.json(
      { error: 'Classification failed', detail: err?.message ?? String(err) },
      { status: 502 }
    )
  }
}