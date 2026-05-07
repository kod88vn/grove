import { getSkillDefinition, listSkillDefinitions } from './skillRegistry.js'

const ROUTE_BY_SKILL = {
  local_time: { route: 'local_tool', confidence: 'high', reason: 'local_time_trigger', intent: 'local_time', toolName: 'get_current_time' },
  planning_reasoning: { route: 'reasoning', confidence: 'medium', reason: 'reasoning_trigger', intent: 'reasoning' },
  weather_widget: { route: 'factual_tool', confidence: 'high', reason: 'weather_trigger', intent: 'weather' },
  search_and_summarize: { route: 'factual_tool', confidence: 'high', reason: 'factual_trigger', intent: 'factual' },
  general_family_chat: { route: 'fast_chat', confidence: 'high', reason: 'chat_trigger', intent: 'chat' },
}

const PRIORITY_BY_SKILL = {
  local_time: 100,
  weather_widget: 90,
  planning_reasoning: 80,
  search_and_summarize: 60,
  general_family_chat: 20,
}

const VALID_ROUTES = new Set(['local_tool', 'reasoning', 'factual_tool', 'fast_chat'])
const VALID_CONFIDENCE = new Set(['low', 'medium', 'high'])

function tokenize(text) {
  return text
    .split(/[^a-z0-9]+/i)
    .map((part) => part.trim())
    .filter(Boolean)
}

function patternScore(normalized, pattern) {
  const input = String(pattern || '').trim().toLowerCase()
  if (!input) return 0

  if (input.includes(' ')) {
    return normalized.includes(input) ? 4 : 0
  }

  const matcher = new RegExp(`\\b${input.replace(/[.*+?^${}()|[\\]\\]/g, '\\$&')}\\b`, 'i')
  return matcher.test(normalized) ? 2 : 0
}

function resolveSkillIntent(normalized) {
  const scored = listSkillDefinitions()
    .filter((skill) => ROUTE_BY_SKILL[skill.id])
    .map((skill) => {
      const score = (skill.triggerPatterns || []).reduce((sum, pattern) => sum + patternScore(normalized, pattern), 0)
      return {
        skillId: skill.id,
        score,
        priority: PRIORITY_BY_SKILL[skill.id] || 0,
      }
    })
    .filter((entry) => entry.score > 0)
    .sort((a, b) => {
      if (b.score !== a.score) return b.score - a.score
      return b.priority - a.priority
    })

  if (scored.length === 0) return null

  const winner = scored[0]
  return {
    ...ROUTE_BY_SKILL[winner.skillId],
    reason: `${ROUTE_BY_SKILL[winner.skillId].reason}:${winner.score}`,
  }
}

export function classifyIntent(message) {
  const input = String(message || '').trim()
  const normalized = input.toLowerCase()
  const tokens = tokenize(normalized)

  if (!normalized) {
    return { route: 'fast_chat', confidence: 'low', reason: 'empty_message', intent: 'chat' }
  }

  const skillIntent = resolveSkillIntent(normalized)
  if (skillIntent) return skillIntent

  // Deterministic fallback: prioritize factual safety when uncertainty is high.
  const containsQuestionCue = tokens.includes('who') || tokens.includes('what') || tokens.includes('when') || tokens.includes('where') || tokens.includes('how')
  if (containsQuestionCue) {
    return {
      route: 'factual_tool',
      confidence: 'low',
      reason: 'fallback_question_routed_to_factual',
      intent: 'factual',
    }
  }

  return { route: 'fast_chat', confidence: 'high', reason: 'non_factual_conversation', intent: 'chat' }
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

function shouldUseModelClassifier(input, deterministicIntent) {
  if (!input) return false
  if (deterministicIntent.confidence === 'low') return true
  if (deterministicIntent.route === 'fast_chat') return true
  return false
}

export async function classifyIntentWithModel(message, options = {}) {
  const input = String(message || '').trim()
  const deterministicIntent = classifyIntent(input)
  const classifyWithModel = options.classifyWithModel

  if (!shouldUseModelClassifier(input, deterministicIntent)) {
    return deterministicIntent
  }

  if (typeof classifyWithModel !== 'function') {
    return deterministicIntent
  }

  const classifierSkill = getSkillDefinition('intent_classifier')

  try {
    const modelIntent = await classifyWithModel({
      message: input,
      deterministicIntent,
      skill: classifierSkill,
    })
    return normalizeModelIntent(modelIntent) || deterministicIntent
  } catch {
    return deterministicIntent
  }
}