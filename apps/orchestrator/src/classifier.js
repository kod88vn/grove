import { getSkillDefinition } from './skillRegistry.js'

// Intent classification is model-driven. The deterministic path here only
// produces a SAFE DEFAULT when no model classifier is wired or the model
// call fails. Keyword matching and skill triggerPatterns are intentionally
// not consulted here — they were brittle and produced destructive false
// positives (e.g. "time" → local clock for "best time to visit DC").

const VALID_ROUTES = new Set(['local_tool', 'reasoning', 'factual_tool', 'fast_chat'])
const VALID_CONFIDENCE = new Set(['low', 'medium', 'high'])

// factual_tool is the safest fallback: it triggers research rather than
// skipping tools (local_tool) or skipping verification (fast_chat).
const SAFE_DEFAULT = Object.freeze({
  route: 'factual_tool',
  intent: 'factual',
  confidence: 'low',
  reason: 'no_classifier',
})

export function classifyIntent(message) {
  const input = String(message || '').trim()
  if (!input) {
    return { route: 'fast_chat', intent: 'chat', confidence: 'low', reason: 'empty_message' }
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
    const normalizedIntent = normalizeModelIntent(modelIntent) || fallback

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
