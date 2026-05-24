// Intent detection: deprecated keyword-based classification.
//
// ⚠️ DEPRECATED — All intent classification decisions (whether to web-search
// or treat as fast-chat) are now made exclusively by the LLM-based
// classifyIntent() function in this same file.
//
// The keyword/pattern matching functions below are kept for:
// 1. Query expansion helpers (building better search queries) — NOT classification
// 2. Backwards compatibility for existing unit tests
// 3. Guidance text in verification.js (determining what kind of citation guidance
//    to inject into the model prompt) — NOT whether to search or not.
//
// The LLM classifier is in classifyIntent() — it calls Ollama with a prompt that
// instructs the model to use semantic understanding, not keyword matching.

const CURRENT_TITLE_KEYWORDS = [
  'president',
  'prime minister',
  'premier',
  'chancellor',
  'ceo',
  'chair',
  'chairperson',
  'governor',
  'mayor',
  'pope',
  'king',
  'queen',
  'leader',
  'secretary',
  'minister',
]

const VERIFICATION_KEYWORDS = [
  'event',
  'incident',
  'accident',
  'attack',
  'election',
  'vote',
  'protest',
  'war',
  'ceasefire',
  'earthquake',
  'flood',
  'hurricane',
  'wildfire',
  'outbreak',
  'pandemic',
  'statistic',
  'statistics',
  'total',
  'number of',
  'how many',
  'how much',
  'percent',
  'percentage',
  'rate',
  'price',
  'cost',
  'revenue',
  'profit',
  'market cap',
  'ranking',
  'ranked',
  'poll',
  'survey',
  'dead',
  'died',
  'death',
  'killed',
  'murdered',
  'assassinated',
  'alive',
  'passed away',
  'cause of death',
  'obituary',
  'arrested',
  'charged',
  'convicted',
  'sentenced',
]

function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

function matchesVerificationKeyword(text) {
  return VERIFICATION_KEYWORDS.some((keyword) => {
    const pattern = new RegExp(`\\b${escapeRegExp(keyword)}\\b`)
    return pattern.test(text)
  })
}

/**
 * @deprecated Use classifyIntent() instead. This function is keyword-based and
 * no longer drives verification decisions in planTools or chatStream.
 */
export function isCurrentTitleQuestion(text) {
  if (!text) return false
  const normalized = String(text).toLowerCase()
  const hasCurrentCue = /\b(current|currently|right now|as of now|holds? office|in office)\b/.test(normalized)
  const hasPersonQuestionCue = /\b(who|which)\b/.test(normalized)
  const hasTitleCue = CURRENT_TITLE_KEYWORDS.some((keyword) => normalized.includes(keyword))
  return hasCurrentCue && hasPersonQuestionCue && hasTitleCue
}

// Returns true for questions that need a specific value read from a page,
// not just URL-level confirmation that a source exists.
/**
 * @deprecated Use classifyIntent() instead. This function is keyword-based and
 * no longer drives verification decisions in planTools or chatStream.
 */
export function requiresPreciseValue(text) {
  if (!text) return false
  const normalized = String(text).toLowerCase()
  return (
    /\bexact\b/.test(normalized) ||
    /\b(latest|current|newest|stable)\s+(version|release|build)\b/.test(normalized) ||
    /\bversion\s+number\b/.test(normalized) ||
    /\bwhat\s+(version|release)\b/.test(normalized) ||
    /\bcurrent\s+price\b/.test(normalized) ||
    /\bexact\s+(price|cost|number|count|figure|stat|statistic)\b/.test(normalized)
  )
}

/**
 * @deprecated Use classifyIntent() instead. This function is keyword-based and
 * no longer drives verification decisions in planTools or chatStream.
 */
export function isMarketRecommendationQuestion(text) {
  if (!text) return false
  const normalized = String(text).toLowerCase()
  const hasRecommendationCue = /\b(best|bang\s+for\s+the\s+buck|best\s+value|value\s+for\s+money|worth\s+it|recommend|go-?to|buy)\b/.test(normalized)
  const hasCategoryCue = /\b(gpu|graphics\s+card|video\s+card|cpu|llm|ai\s+model|local\s+model|inference)\b/.test(normalized)
  return hasRecommendationCue && hasCategoryCue
}

/**
 * @deprecated Use classifyIntent() instead. This function is keyword-based and
 * no longer drives verification decisions in planTools or chatStream.
 */
export function isSensitivePersonStatusClaim(text) {
  if (!text) return false
  const normalized = String(text).toLowerCase()
  return (
    /\bwhat happened to\b/.test(normalized) ||
    /\b(dead|died|death|killed|murdered|assassinated|alive|passed away|cause of death)\b/.test(normalized)
  )
}

/**
 * @deprecated Use classifyIntent() instead. This function is keyword-based and
 * no longer drives verification decisions in planTools or chatStream.
 */
export function requiresLiveData(text) {
  if (!text) return false
  const normalized = String(text).toLowerCase()
  return /\b(weather|forecast|temperature|rain|snow|humidity|wind|storm|sunny|cloudy|hot|cold|today|tomorrow|tonight|this week|stock price|stock market|share price|sports score|game score|live score|breaking news|right now|currently|as of today)\b/.test(normalized)
}

/**
 * @deprecated Use classifyIntent() instead. This function is keyword-based and
 * no longer drives verification decisions in planTools or chatStream. The ONLY
 * classification function that determines whether web search is needed is
 * classifyIntent() below, which uses Ollama for semantic understanding.
 */
export function requiresFactVerification(text) {
  if (!text) return false
  const normalized = String(text).toLowerCase()

  if (/\[[^\]]+\]/.test(normalized)) {
    return false
  }

  if (isCurrentTitleQuestion(normalized)) {
    return true
  }

  if (requiresPreciseValue(normalized)) {
    return true
  }

  if (/\bwhat happened to\b/.test(normalized)) {
    return true
  }

  if (matchesVerificationKeyword(normalized)) {
    return true
  }

  if (isMarketRecommendationQuestion(normalized)) {
    return true
  }

  // Also verify when user asks factual/date/number-like questions.
  const hasFactualQuestionCue = /\b(who|what|when|where|which|did|is|are|was|were|how many|how much)\b/.test(normalized)
  const hasNumericCue = /\b(19|20)\d{2}\b|\b\d+(?:[.,]\d+)?\s*(?:%|percent|million|billion|trillion|k|m|bn)?\b/.test(normalized)

  return hasFactualQuestionCue && hasNumericCue
}

// ============================================================================
// LLM-BASED CLASSIFICATION (THE ONLY AUTHENTICATIVE PATH)
// ============================================================================

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
 * Used by planTools.js and orchestratorClient.js for routing decisions.
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

import { callOllama } from './ollama'