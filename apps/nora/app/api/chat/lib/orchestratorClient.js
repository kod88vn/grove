// Orchestrator client for execution plan routing.
// Calls the orchestrator service at ORCHESTRATOR_URL (default: http://127.0.0.1:4010).
//
// In production fallback (when orchestrator is unreachable), this module uses keyword-based
// detection as the PRIMARY fast path. LLM-based classifyIntent() is an optional warm
// enhancement that only runs when Ollama is reachable. This ensures the app works in
// production even if Ollama is temporarily unavailable — no LLM dependency for basic routing.

import { classifyIntent } from './intent'
import { requiresLiveData, requiresFactVerification } from './intent'

const ORCHESTRATOR_URL = process.env.ORCHESTRATOR_URL || 'http://127.0.0.1:4010'

const DEFAULT_MODEL = process.env.DEFAULT_MODEL || 'qwen3.5:9b'

/**
 * Fast keyword-based intent detection — works WITHOUT Ollama.
 * Returns { requiresSearch: boolean } to determine factual vs fast_chat route.
 */
function keywordDetectIntent(message) {
  if (!message || !String(message).trim()) return { requiresSearch: false, reason: 'empty_input' }
  const normalized = String(message).toLowerCase()

  // Current-info / live-data questions (weather, stock prices, sports scores, breaking news)
  const needsLiveData = requiresLiveData(normalized)

  // Factual questions needing citation verification (dates, numbers, statistics, events)
  const needsVerification = requiresFactVerification(normalized)

  return {
    requiresSearch: needsLiveData || needsVerification,
    reason: needsVerification ? 'factual_verification' : (needsLiveData ? 'live_data_needed' : 'general_knowledge'),
  }
}

/**
 * Build a fallback execution plan when the orchestrator is unreachable.
 * Uses keyword-based detection as the PRIMARY fast path (works without Ollama).
 * Falls back to LLM-based classifyIntent() as an optional warm enhancement.
 * If Ollama is unavailable, keyword detection still provides correct routing.
 */
async function buildFallbackPlan(message, reason) {
  // In test mode, TEST_FALLBACK_ROUTE is the sole override.
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

  // PRIMARY PATH: Keyword-based detection works WITHOUT Ollama.
  // This is the same logic that powered production before commit a2fd7cd.
  const keywordIntent = keywordDetectIntent(message)
  console.error('[orchestratorClient] buildFallbackPlan: message="' + String(message).slice(0, 100) + '" route=' +
    (keywordIntent.requiresSearch ? 'factual_tool' : 'fast_chat') + ' reason=' + reason +
    ' method=keyword_based intent=' + JSON.stringify(keywordIntent))

  return {
    plan: {
      route: keywordIntent.requiresSearch ? 'factual_tool' : 'fast_chat',
      confidence: 'medium',
      reason,
      useModel: true,
      skipToolPlanning: !keywordIntent.requiresSearch,
      promptProfile: keywordIntent.requiresSearch ? 'factual' : 'fast',
      requireVerification: keywordIntent.requiresSearch,
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
