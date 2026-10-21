// Shared intent classifier for the 4-route scheme.
// Used by both /api/nora-classify/route.js and orchestratorClient.js to eliminate
// the parallel-but-inconsistent dual classifier system.
//
// Routes: fast_chat, factual_tool, reasoning, local_tool
// Uses the correct parameters: temperature: 0, max_tokens: 80, response_format: json_object

import { DEFAULT_MODEL } from './constants'
import { callAI } from './callAI'
import { hasFactualQuerySignals, isObviouslyFactual } from './intent'

const SYSTEM_PROMPT = `You classify a user message into ONE of four routes for a family AI assistant. Reply with strict JSON only — no prose, no code fences.

Schema: {"route":"<route>","intent":"<intent>","confidence":"low|medium|high","reason":"<short>"}

Routes:
- local_tool — ONLY when the user is asking for the current local clock time or date on this device (e.g. "what time is it", "current time", "what is today's date"). intent="local_time". Do NOT use this for planning questions that merely mention time, travel time, or deadlines.
- factual_tool — current events, news, weather, live status, stock/price updates, latest versions, people, current status, or anything that requires fresh or potentially changing information. intent="factual" (or "weather" for weather questions).
- reasoning — multi-step planning, comparisons, analysis with tradeoffs, recommendations across options, or strategy questions. intent="reasoning".
- fast_chat — casual conversation, creative writing, jokes, rewrites, opinions, explanations of general knowledge that are not tied to current/fresh data, or emotional/social chat. intent="chat".

Examples:
- "who is the sitting president" => {"route":"factual_tool","intent":"factual","confidence":"high","reason":"current office holder"}
- "what's the latest version of React" => {"route":"factual_tool","intent":"factual","confidence":"high","reason":"needs current version"}
- "how's the weather tomorrow" => {"route":"factual_tool","intent":"weather","confidence":"high","reason":"weather forecast"}
- "what time is it right now" => {"route":"local_tool","intent":"local_time","confidence":"high","reason":"local clock time"}
- "rewrite this sentence to be friendlier" => {"route":"fast_chat","intent":"chat","confidence":"high","reason":"creative writing"}
- "what are the pros and cons of electric vs hybrid cars" => {"route":"reasoning","intent":"reasoning","confidence":"high","reason":"comparison analysis"}
- "hi there" => {"route":"fast_chat","intent":"chat","confidence":"high","reason":"casual greeting"}
- "explain quantum computing" => {"route":"fast_chat","intent":"chat","confidence":"high","reason":"general knowledge explanation"}
- "how are you doing" => {"route":"fast_chat","intent":"chat","confidence":"high","reason":"casual greeting"}`;

const CLASSIFY_TIMEOUT_MS = Number(process.env.NORA_CLASSIFY_TIMEOUT_MS || 8000)

/**
 * Classify a message using the nora-classify route's exact parameters.
 * This is the SINGLE authoritative classifier — both the API endpoint and
 * orchestratorClient.js use this function.
 * 
 * @param {string} message - The user's message
 * @returns {Promise<{route: string, intent: string, confidence: string, reason: string}>}
 */
export async function classifyRoute(message) {
  if (!message || !String(message).trim()) {
    return { route: 'fast_chat', intent: 'chat', confidence: 'low', reason: 'empty_input' }
  }

  const trimmedMessage = String(message).trim()

  // Fast-path for obviously factual queries — bypass the LLM call entirely.
  // Catches person-status ("what happened to X"), mortality, legal/career status,
  // and breaking news patterns that the LLM classifier sometimes misroutes to fast_chat.
  const factualPre = isObviouslyFactual(trimmedMessage)
  if (factualPre.match) {
    return { route: 'factual_tool', intent: 'factual', confidence: 'high', reason: factualPre.reason }
  }

  try {
    // Use the same parameters as /api/nora-classify/route.js:
    // temperature: 0, max_tokens: 80, response_format: json_object
    const res = await callAI({
      model: DEFAULT_MODEL,
      stream: false,
      options: { temperature: 0, num_predict: 80, think: false },
      messages: [
        { role: 'system', content: SYSTEM_PROMPT },
        { role: 'user', content: trimmedMessage },
      ],
    })

    if (!res.ok) {
      // Fail-safe: use hasFactualQuerySignals to determine appropriate route
      const shouldSearch = hasFactualQuerySignals(trimmedMessage)
      console.error(
        '[classifyRoute] LLM request failed with status', res.status || 'unknown',
        `— fallback to ${shouldSearch ? 'factual_tool' : 'fast_chat'} (hasFactualQuerySignals)`,
        '| message:', trimmedMessage.slice(0, 100)
      )
      return { route: shouldSearch ? 'factual_tool' : 'fast_chat', intent: shouldSearch ? 'factual' : 'chat', confidence: 'low', reason: `llm_unavailable_status_${res.status || 'unknown'}` }
    }

    // callLMStudio normalizes non-streaming responses into the Ollama-style
    // envelope { message: { content?, thinking? }, done, model } — not the
    // raw OpenAI `choices` shape.
    const json = await res.json()
    const message = json?.message || {}
    const content = message.content || message.thinking || ''

    if (!content) {
      // Empty response: use hasFactualQuerySignals for safe default
      const shouldSearch = hasFactualQuerySignals(trimmedMessage)
      return { route: shouldSearch ? 'factual_tool' : 'fast_chat', intent: shouldSearch ? 'factual' : 'chat', confidence: 'low', reason: 'empty_response' }
    }

    // Try to extract JSON from the response
    let parsed = null
    const jsonMatch = content.match(/\{[\s\S]*\}/)

    if (jsonMatch) {
      let rawJson = jsonMatch[0]
      rawJson = rawJson.replace(/(?<!["\w])(\w+)(?=\s*:)/g, '"$1"')
      rawJson = rawJson.replace(/,\s*}/g, '}')
      try {
        parsed = JSON.parse(rawJson)
      } catch {
        // Parse failed — fall through to defaults
      }
    }

    if (parsed && typeof parsed.route === 'string') {
      return {
        route: parsed.route,
        intent: typeof parsed.intent === 'string' ? parsed.intent : 'chat',
        confidence: ['low', 'medium', 'high'].includes(parsed.confidence) ? parsed.confidence : 'low',
        reason: typeof parsed.reason === 'string' && parsed.reason.trim() ? parsed.reason.trim() : 'llm_classifier',
      }
    }

    // No valid JSON — use hasFactualQuerySignals for safe default instead of blind fast_chat
    const shouldSearch = hasFactualQuerySignals(trimmedMessage)
    console.error('[classifyRoute] parse_failure — fallback to', shouldSearch ? 'factual_tool' : 'fast_chat')
    return { route: shouldSearch ? 'factual_tool' : 'fast_chat', intent: shouldSearch ? 'factual' : 'chat', confidence: 'low', reason: 'parse_failure' }
  } catch (err) {
      // On any error, use hasFactualQuerySignals for safe default
      const shouldSearch = hasFactualQuerySignals(trimmedMessage)
      console.error('[classifyRoute] classifier error:', err?.message || String(err), `— fallback to ${shouldSearch ? 'factual_tool' : 'fast_chat'}`)
      return { route: shouldSearch ? 'factual_tool' : 'fast_chat', intent: shouldSearch ? 'factual' : 'chat', confidence: 'low', reason: 'exception' }
    }
}

/**
 * Convert a classifyRoute result to the requiresSearch format used by orchestratorClient.js.
 * Maps: factual_tool → requiresSearch=true, local_tool/factual_tool → requiresSearch=true,
 * fast_chat/reasoning → requiresSearch=false.
 */
export function routeToRequiresSearch(routeResult) {
  return {
    requiresSearch: (routeResult.route === 'factual_tool' || routeResult.route === 'local_tool'),
    reason: `${routeResult.route}_via_classifyRoute`,
    searchHints: [],
    confidence: routeResult.confidence,
  }
}

/**
 * Convert a classifyRoute result to an execution plan.
 */
export function routeToPlan(routeResult) {
  const result = {
    plan: {
      route: routeResult.route,
      confidence: routeResult.confidence,
      reason: routeResult.reason,
      useModel: true,
      skipToolPlanning: routeResult.route === 'fast_chat',
      promptProfile: routeResult.route === 'factual_tool' ? 'factual' : 'fast',
      requireVerification: routeResult.route === 'factual_tool',
    },
  }

  // local_tool: compute the time now and attach execution payload so chatStream.js
  // short-circuit fires (it checks orchestration.execution.ok + .payload.localTime).
  if (routeResult.route === 'local_tool') {
    const now = new Date()
    result.execution = {
      ok: true,
      payload: {
        localTime: now.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', timeZoneName: 'short' }),
        iso: now.toISOString(),
      },
    }
  }

  return result
}
