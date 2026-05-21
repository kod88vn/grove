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

export async function POST(request) {
  let message
  try {
    const body = await request.json()
    message = body?.message
  } catch {
    return Response.json({ error: 'invalid_request' }, { status: 400 })
  }

  if (!message) {
    return Response.json({ error: 'message_required' }, { status: 400 })
  }

  const ollamaHost = String(process.env.OLLAMA_HOST || 'http://grove:11434').trim().replace(/\/+$/, '')
  const model = process.env.OLLAMA_CLASSIFIER_MODEL || DEFAULT_MODEL

  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), CLASSIFIER_TIMEOUT_MS)

  try {
    const res = await fetch(`${ollamaHost}/api/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model,
        stream: false,
        format: 'json',
        options: { temperature: 0, num_predict: 80 },
        messages: [
          { role: 'system', content: SYSTEM_PROMPT },
          { role: 'user', content: String(message) },
        ],
      }),
      signal: controller.signal,
    })

    if (!res.ok) {
      return Response.json({ error: `ollama_status_${res.status}` }, { status: 502 })
    }

    const json = await res.json()
    const content = json?.message?.content
    if (!content) {
      return Response.json({ error: 'ollama_empty_content' }, { status: 502 })
    }

    const classification = JSON.parse(content)
    return Response.json(classification)
  } catch (err) {
    if (err.name === 'AbortError') {
      return Response.json({ error: 'classifier_timeout' }, { status: 504 })
    }
    return Response.json({ error: 'classifier_error' }, { status: 502 })
  } finally {
    clearTimeout(timer)
  }
}
