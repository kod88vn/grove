import { getSkillDefinition } from './skillRegistry.js'

// Intent classification is model-driven. The deterministic path here only
// produces a SAFE DEFAULT when no model classifier is wired or the model
// call fails. Keyword matching and skill triggerPatterns are intentionally
// not consulted here — they were brittle and produced destructive false
// positives (e.g. "time" → local clock for "best time to visit DC").

const VALID_ROUTES = new Set(['local_tool', 'reasoning', 'factual_tool', 'fast_chat'])
const VALID_CONFIDENCE = new Set(['low', 'medium', 'high'])

// Model classification is preferred using the small classifier model from
// OLLAMA_CLASSIFIER_MODEL. If the classifier is unavailable or emits fast_chat
// for a query clearly asking for current/fresh information, promote it to factual_tool.
const SAFE_DEFAULT = Object.freeze({
  route: 'fast_chat',
  intent: 'chat',
  confidence: 'low',
  reason: 'no_classifier',
})

function isCurrentInfoQuery(message) {
  if (!message) return false
  const normalized = String(message).toLowerCase()
  const currentTitleQuestion = /\bwho is the (current|sitting|incumbent|acting|present)\b/.test(normalized)
  const titleKeyword = /\b(president|prime minister|governor|mayor|ceo|chief executive|chancellor|king|queen|pope|chair|chairperson|secretary|minister|leader)\b/.test(normalized)
  if (currentTitleQuestion && titleKeyword) return true

  const versionQuestion = /\b(what(?:'s| is) the (?:latest|current|newest) (?:version|release)|current version|latest release|newest release|version of)\b/.test(normalized)
  if (versionQuestion) return true

  const liveDataQuestion = /\b(what(?:'s| is) the weather|how(?:'s| is) the weather|weather (?:today|tomorrow|tonight|right now)|temperature (?:today|now)|forecast|stock price|stock market|share price|sports score|live score|breaking news|current news|latest news)\b/.test(normalized)
  if (liveDataQuestion) return true

  const currentCue = /\b(currently|right now|as of now|as of today|today|tonight|tomorrow|latest|newest)\b/.test(normalized)
  const factualCue = /\b(who|what|when|where|which|is|are|did|does|do|has|have)\b/.test(normalized)
  const nounCue = /\b(version|release|president|prime minister|weather|temperature|forecast|news|price|score|status|update|result|headline)\b/.test(normalized)
  return currentCue && factualCue && nounCue
}

export function classifyIntent(message) {
  const input = String(message || '').trim()
  if (!input) {
    return { route: 'fast_chat', intent: 'chat', confidence: 'low', reason: 'empty_message' }
  }

  if (isCurrentInfoQuery(input)) {
    return {
      route: 'factual_tool',
      intent: 'factual',
      confidence: 'low',
      reason: 'fallback_factual_current_info',
    }
  }

  return { ...SAFE_DEFAULT }
}

function normalizeModelIntent(raw) {
  if (!raw || typeof raw !== 'object') return null
  if (!VALID_ROUTES.has(raw.route)) return null

  const normalized = {
    route: raw.route,
    confidence: VALID_CONFIDENCE.has(raw.confidence) ? raw.confidence : 'medium',
    reason: raw.reason ? `model_classifier:${raw.reason}` : 'model_classifier',
  }

  if (raw.route === 'local_tool') {
    normalized.intent = 'local_time'
    normalized.toolName = 'get_current_time'
    return normalized
  }

  if (raw.route === 'reasoning') {
    normalized.intent = 'reasoning'
    return normalized
  }

  if (raw.route === 'factual_tool') {
    normalized.intent = raw.intent === 'weather' ? 'weather' : 'factual'
    return normalized
  }

  normalized.intent = 'chat'
  return normalized
}

export async function classifyIntentWithModel(message, options = {}) {
  const input = String(message || '').trim()
  const fallback = classifyIntent(input)
  const classifyWithModel = options.classifyWithModel
  const classificationCache = options.classificationCache
  const cacheContext = options.cacheContext || {}

  if (!input || typeof classifyWithModel !== 'function') {
    return fallback
  }

  if (classificationCache && typeof classificationCache.get === 'function') {
    const cachedIntent = classificationCache.get({
      message: input,
      surface: cacheContext.surface,
    })
    if (cachedIntent) {
      return {
        ...cachedIntent,
        reason: cachedIntent.reason || 'classification_cache_hit',
      }
    }
  }

  const classifierSkill = getSkillDefinition('intent_classifier')

  try {
    const modelIntent = await classifyWithModel({
      message: input,
      skill: classifierSkill,
    })
    let normalizedIntent = normalizeModelIntent(modelIntent) || fallback

    if ((normalizedIntent.route === 'fast_chat' || normalizedIntent.route === 'reasoning') && isCurrentInfoQuery(input)) {
      normalizedIntent = {
        route: 'factual_tool',
        intent: 'factual',
        confidence: normalizedIntent.confidence || 'low',
        reason: 'fallback_factual_current_info',
      }
    }

    if (classificationCache && typeof classificationCache.rememberFromClassification === 'function') {
      classificationCache.rememberFromClassification({
        message: input,
        surface: cacheContext.surface,
        intent: normalizedIntent,
      })
    }

    return normalizedIntent
  } catch {
    return fallback
  }
}
