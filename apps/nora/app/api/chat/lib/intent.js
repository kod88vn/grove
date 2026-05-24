// Intent detection: LLM-based semantic classification of user messages.
// NO keyword matching — all intent decisions are made by calling Ollama with
// a prompt that instructs the model to use semantic understanding.
// Used by the planner (planTools.js) and orchestrator client to decide which
// verification path to take.

import { callOllama } from './ollama'

const CLASSIFIER_SYSTEM_PROMPT = `You are Nora's intent classifier. Analyze the user message and determine whether it requires web search/tool verification before answering, or can be answered from general knowledge.

Reply with strict JSON only — no prose, no code fences.

Schema: {"requiresSearch":boolean,"reason":"<short explanation>","searchHints":["<query hints if needed>"],"confidence":"low|medium|high"}

Classification rules:
- requiresSearch=true when the message asks about current events, news, weather, live status, stock/price updates, latest software versions, recent sports scores, breaking news, or any fact that could have changed since the model's training data cutoff.
- requiresSearch=true for ANY coding or technical question about a specific library, framework, API, CLI tool, or language feature — these need current documentation.
- requiresSearch=true for factual claims involving specific dates, numbers, statistics, rankings, prices, or anyone's current status/role.
- requiresSearch=false for casual conversation, creative writing, jokes, general knowledge explanations that are timeless, opinions, rewrites, or emotional/chat messages.
- When in doubt between search and no-search, choose requiresSearch=true.

Examples:
- "what's the latest version of React" => requiresSearch: true, reason: "needs current version info from web", confidence: high
- "how's the weather tomorrow" => requiresSearch: true, reason: "weather forecast requires live data", confidence: high
- "what time is it" => requiresSearch: false, reason: "local time does not require web search", confidence: high
- "rewrite this sentence to be friendlier" => requiresSearch: false, reason: "creative writing task", confidence: high
- "what are the pros and cons of electric vs hybrid cars" => requiresSearch: false, reason: "general analysis, no current data needed", confidence: medium
- "who is the sitting president" => requiresSearch: true, reason: "current office holder may have changed", confidence: high
- "explain quantum computing" => requiresSearch: false, reason: "general knowledge explanation", confidence: high
- "what is the current price of Bitcoin" => requiresSearch: true, reason: "current market data needed", confidence: high
- "how are you doing" => requiresSearch: false, reason: "casual greeting", confidence: high`;

/**
 * Classify a user message using an LLM to determine if web search is needed.
 * This is the ONLY intent classification function — no keyword matching is used.
 *
 * @param {string} model - Ollama model to use for classification
 * @param {string} userMessage - The user's message text
 * @returns {Promise<{requiresSearch: boolean, reason: string, searchHints: string[], confidence: string}>}
 */
export async function classifyIntent(model, userMessage) {
  if (!userMessage || !String(userMessage).trim()) {
    return { requiresSearch: false, reason: 'empty_input', searchHints: [], confidence: 'low' }
  }

  if (process.env.NODE_ENV === 'test') {
    return { requiresSearch: false, reason: 'disabled_in_test', searchHints: [], confidence: 'low' }
  }

  try {
    const res = await callOllama({
      model,
      stream: false,
      options: { num_predict: 120, think: false },
      messages: [
        { role: 'system', content: CLASSIFIER_SYSTEM_PROMPT },
        { role: 'user', content: String(userMessage) },
      ],
    })

    if (!res.ok) {
      return { requiresSearch: false, reason: 'classifier_request_failed', searchHints: [], confidence: 'low' }
    }

    const json = await res.json()
    const content = json?.message?.content
    if (!content) {
      return { requiresSearch: false, reason: 'classifier_empty_response', searchHints: [], confidence: 'low' }
    }

    // Extract JSON from response (handle potential code fences or extra text)
    const jsonMatch = content.match(/\{[\s\S]*\}/)
    if (!jsonMatch) {
      return { requiresSearch: false, reason: 'classifier_parse_failed', searchHints: [], confidence: 'low' }
    }

    const parsed = JSON.parse(jsonMatch[0])

    return {
      requiresSearch: Boolean(parsed.requiresSearch),
      reason: typeof parsed.reason === 'string' && parsed.reason.trim() ? parsed.reason.trim() : 'llm_classifier',
      searchHints: Array.isArray(parsed.searchHints)
        ? parsed.searchHints.map((v) => String(v || '').trim()).filter(Boolean).slice(0, 4)
        : [],
      confidence: ['low', 'medium', 'high'].includes(parsed.confidence) ? parsed.confidence : 'low',
    }
  } catch {
    return { requiresSearch: false, reason: 'classifier_exception', searchHints: [], confidence: 'low' }
  }
}