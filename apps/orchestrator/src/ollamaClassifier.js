// Single-call Ollama classifier. Used by the orchestrator to decide which
// route a user message should follow before any tool/research kicks in.
//
// Contract: returns { route, intent, confidence, reason } compatible with
// classifier.normalizeModelIntent. On any error or timeout the caller will
// fall back to classifier.classifyIntent (safe default = factual_tool/low).

const DEFAULT_MODEL = process.env.OLLAMA_CLASSIFIER_MODEL || 'qwen2.5:1.5b'
const DEFAULT_HOST = process.env.OLLAMA_HOST || 'http://grove:11434'
const DEFAULT_TIMEOUT_MS = Number(process.env.OLLAMA_CLASSIFIER_TIMEOUT_MS || 3000)

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

export function createOllamaClassifier(options = {}) {
  const host = options.host || DEFAULT_HOST
  const model = options.model || DEFAULT_MODEL
  const timeoutMs = Number(options.timeoutMs || DEFAULT_TIMEOUT_MS)
  const fetchImpl = options.fetch || globalThis.fetch

  return async function classifyWithOllama({ message }) {
    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), timeoutMs)
    try {
      const res = await fetchImpl(`${host}/api/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model,
          stream: false,
          format: 'json',
          options: { temperature: 0, num_predict: 80 },
          messages: [
            { role: 'system', content: SYSTEM_PROMPT },
            { role: 'user', content: String(message || '') },
          ],
        }),
        signal: controller.signal,
      })
      if (!res.ok) throw new Error(`ollama_status_${res.status}`)
      const body = await res.json()
      const content = body && body.message && body.message.content
      if (!content) throw new Error('ollama_empty_content')
      return JSON.parse(content)
    } finally {
      clearTimeout(timer)
    }
  }
}
