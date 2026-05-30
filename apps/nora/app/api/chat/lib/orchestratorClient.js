// Orchestrator client for execution plan routing.
// Calls the orchestrator service at ORCHESTRATOR_URL (default: http://127.0.0.1:4010).
//
// In production fallback (when orchestrator is unreachable), this module uses
// LLM-based classifyIntent() for intent classification. Keyword-based matching
// (the old isCurrentInfoQuery) has been removed — all routing decisions now use
// semantic understanding via Ollama.

import { classifyIntent, IntentClassifierError } from './intent'

const ORCHESTRATOR_URL = process.env.ORCHESTRATOR_URL || 'http://127.0.0.1:4010'

const DEFAULT_MODEL = process.env.DEFAULT_MODEL || 'qwen3.5:9b'

/**
 * Build a fallback execution plan when the orchestrator is unreachable.
 * Uses LLM-based classifyIntent() for semantic intent detection — NO keyword matching.
 * In test mode, TEST_FALLBACK_ROUTE is the sole override.
 * 
 * Per AGENTS.md "No Silent Failures" policy: if the classifier fails in production
 * (throws IntentClassifierError), we fall back to 'fast_chat' with a clear log message
 * rather than silently masking the error. The route handler will still call the LLM
 * to generate a response (just without forced web search verification).
 */
async function buildFallbackPlan(message, reason) {
  // In test mode, TEST_FALLBACK_ROUTE is the sole override — do NOT call classifyIntent
  // based on the message string itself. The classifier must only be used in production
  // fallbacks where semantic understanding is available.
  const explicitTestRoute = process.env.TEST_FALLBACK_ROUTE
  if (explicitTestRoute) {
    console.error('[orchestratorClient] buildFallbackPlan: message="' + String(message).slice(0, 100) + '" route=' + explicitTestRoute + ' reason=' + reason)

    return {
      plan: {
        route: explicitTestRoute,
        confidence: 'low',
        reason,
        useModel: true,
        skipToolPlanning: explicitTestRoute === 'fast_chat',
        promptProfile: explicitTestRoute === 'factual_tool' ? 'factual' : 'fast',
        requireVerification: explicitTestRoute === 'factual_tool',
      },
    }
  }

  // LLM-based semantic intent classification — NO keyword matching.
  let intent
  try {
    intent = await classifyIntent(DEFAULT_MODEL, message)
  } catch (err) {
    // Per AGENTS.md "No Silent Failures": classifier failures must be surfaced.
    // In production, log the error and fall back to requiresSearch=true (fail-safe toward web search).
    // The LLM will still generate a response, but with forced search verification enabled.
    console.error('[orchestratorClient] buildFallbackPlan: classifier failed, defaulting to requiresSearch=true (fail-safe). reason=', err.message)
    intent = { requiresSearch: true, reason: 'classifier_failed_fallback', searchHints: [], confidence: 'low' }
  }

  // needsSearch from LLM classifier determines if factual/web search route is needed.
  const needsFactual = intent.requiresSearch === true

  let route
  if (needsFactual) {
    route = 'factual_tool'
  } else {
    route = 'fast_chat'
  }

  console.error('[orchestratorClient] buildFallbackPlan: message="' + String(message).slice(0, 100) + '" route=' + route + ' reason=' + reason + ' intent=' + JSON.stringify(intent))

  return {
    plan: {
      route,
      confidence: intent.confidence || 'low',
      reason,
      useModel: true,
      skipToolPlanning: route === 'fast_chat',
      promptProfile: route === 'factual_tool' ? 'factual' : 'fast',
      requireVerification: route === 'factual_tool',
    },
  }
}

export async function getExecutionPlan(message) {
  if (process.env.NODE_ENV === 'test') {
    return await buildFallbackPlan(message, 'test_mode_default')
  }

  try {
    console.debug('[orchestratorClient] Fetching orchestrator at: ' + ORCHESTRATOR_URL + '/orchestrate')
    const res = await fetch(ORCHESTRATOR_URL + '/orchestrate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ message, surface: 'chat' }),
    })

    console.debug('[orchestratorClient] Fetch response status: ' + res.status)
    const payload = await res.json().catch(() => null)

    console.debug('[orchestratorClient] Payload received: route=' + (payload?.plan?.route || 'null') + ' reason=' + (payload?.plan?.reason || 'none'))

    if (payload?.plan?.route) {
      const result = {
        ...payload,
        plan: {
          ...payload.plan,
          reason: res.ok ? payload.plan.reason : payload.plan.reason || 'orchestrator_http_' + res.status,
        },
      }

      return result
    }

    if (!res.ok) {
      console.error('[orchestratorClient] Orchestrator returned error status: ' + res.status)
      return await buildFallbackPlan(message, 'orchestrator_http_' + res.status)
    }

    if (!payload?.plan?.route) {
      console.error('[orchestratorClient] Invalid payload received, no plan.route')
      return await buildFallbackPlan(message, 'orchestrator_invalid_payload')
    }

    // Fallback path - no valid route in response
    console.error('[orchestratorClient] Returning orchestration result: route=' + payload.plan.route)
    return payload
  } catch (err) {
    console.error('[orchestratorClient] Orchestrator request failed: ' + err.message?.slice(0, 200))
    return await buildFallbackPlan(message, 'orchestrator_unreachable')
  }
}
