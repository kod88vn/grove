const LOCAL_TIME_PATTERN = /\b(time|clock|current time|local time)\b/i
const WEATHER_PATTERN = /\b(weather|forecast|temperature)\b/i
const FACTUAL_PATTERN = /\b(weather|forecast|temperature|price|latest|current|today|tomorrow|who is|what is|what happened|happened|news|stock|version|release)\b/i
const REASONING_PATTERN = /\b(compare|tradeoff|architecture|strategy|analy[sz]e|evaluation|pros and cons|multi-step)\b/i

export function classifyIntent(message) {
  const input = String(message || '').trim()
  const normalized = input.toLowerCase()

  if (!normalized) {
    return { route: 'fast_chat', confidence: 'low', reason: 'empty_message', intent: 'chat' }
  }

  if (LOCAL_TIME_PATTERN.test(normalized)) {
    return {
      route: 'local_tool',
      confidence: 'high',
      reason: 'local_time_command',
      intent: 'local_time',
      toolName: 'get_current_time',
    }
  }

  if (REASONING_PATTERN.test(normalized)) {
    return {
      route: 'reasoning',
      confidence: 'medium',
      reason: 'complex_reasoning_request',
      intent: 'reasoning',
    }
  }

  if (WEATHER_PATTERN.test(normalized)) {
    return {
      route: 'factual_tool',
      confidence: 'high',
      reason: 'weather_request',
      intent: 'weather',
    }
  }

  if (FACTUAL_PATTERN.test(normalized)) {
    return {
      route: 'factual_tool',
      confidence: 'high',
      reason: 'factual_or_live_data_request',
      intent: 'factual',
    }
  }

  return { route: 'fast_chat', confidence: 'high', reason: 'non_factual_conversation', intent: 'chat' }
}