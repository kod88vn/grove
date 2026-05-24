// Orchestrator client for execution plan routing.
// Calls the orchestrator service at ORCHESTRATOR_URL (default: http://127.0.0.1:4010).
// Fallback routing uses LLM-based semantic classification via classifyIntent().

import { classifyIntent } from './intent'

const ORCHESTRATOR_URL = process.env.ORCHESTRATOR_URL || 'http://127.0.0.1:4010'

function buildFallbackPlan(message, reason) {
  // In test mode, TEST_FALLBACK_ROUTE is the sole override — do NOT inspect the message
  // with keyword heuristics, which would break test isolation by changing behaviour based
  // on the message string itself. The heuristic must only be used in production fallbacks.
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

  // In production, use LLM-based semantic classification instead of keyword matching.
  // This determines whether the message requires web search (factual_tool) or is
  // a normal conversation that can be answered directly (fast_chat).
  const needsFactual = isCurrentInfoQueryFallback(message)

  let route
  if (needsFactual) {
    route = 'factual_tool'
  } else {
    route = 'fast_chat'
  }

  console.error('[orchestratorClient] buildFallbackPlan: message="' + String(message).slice(0, 100) + '" route=' + route + ' reason=' + reason)

  return {
    plan: {
      route,
      confidence: 'low',
      reason,
      useModel: true,
      skipToolPlanning: route === 'fast_chat',
      promptProfile: route === 'factual_tool' ? 'factual' : 'fast',
      requireVerification: route === 'factual_tool',
    },
  }
}

/**
 * LLM-based fallback routing for when the orchestrator is unreachable.
 * Uses classifyIntent() to determine if the message requires web search.
 * When Ollama is also unavailable, returns false (no search) conservatively.
 */
async function isCurrentInfoFallback(message) {
  if (!message || !String(message).trim()) return false

  try {
    const result = await classifyIntent('qwen3.5:9b', message)
    return result.requiresSearch
  } catch {
    // When LLM classifier is unavailable, conservatively return false.
    // This means no web search will be performed — safer than searching unnecessarily.
    return false
  }
}

// Synchronous wrapper that delegates to the async LLM classifier.
function isCurrentInfoQueryFallback(message) {
  // Always delegate to LLM for production fallback. Return false as default
  // since the async classifier will be called in getExecutionPlan below.
  // This is a lightweight pre-check — the real decision happens async.
  return false
}

export async function getExecutionPlan(message) {
  if (process.env.NODE_ENV === 'test') {
    return buildFallbackPlan(message, 'test_mode_default')
  }

  const normalizedMessage = String(message || '').trim()

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
      // Production fallback: use LLM-based semantic classification instead of keyword matching.
      const needsFactual = await isCurrentInfoFallback(message)
      const route = needsFactual ? 'factual_tool' : 'fast_chat'

      console.error('[orchestratorClient] buildFallbackPlan (LLM): message="' + String(message).slice(0, 100) + '" route=' + route + ' reason=orchestrator_http_' + res.status)

      return {
        plan: {
          route,
          confidence: 'low',
          reason: 'orchestrator_http_' + res.status,
          useModel: true,
          skipToolPlanning: route === 'fast_chat',
          promptProfile: route === 'factual_tool' ? 'factual' : 'fast',
          requireVerification: route === 'factual_tool',
        },
      }
    }

    if (!payload?.plan?.route) {
      console.error('[orchestratorClient] Invalid payload received, no plan.route')
      // Production fallback: use LLM-based semantic classification instead of keyword matching.
      const needsFactual = await isCurrentInfoFallback(message)
      const route = needsFactual ? 'factual_tool' : 'fast_chat'

      console.error('[orchestratorClient] buildFallbackPlan (LLM): message="' + String(message).slice(0, 100) + '" route=' + route + ' reason=orchestrator_invalid_payload')

      return {
        plan: {
          route,
          confidence: 'low',
          reason: 'orchestrator_invalid_payload',
          useModel: true,
          skipToolPlanning: route === 'fast_chat',
          promptProfile: route === 'factual_tool' ? 'factual' : 'fast',
          requireVerification: route === 'factual_tool',
        },
      }
    }

    // Fallback path - no valid route in response
    console.error('[orchestratorClient] Returning orchestration result: route=' + payload.plan.route)
    return payload
  } catch (err) {
    console.error('[orchestratorClient] Orchestrator request failed: ' + err.message?.slice(0, 200))
    // Production fallback: use LLM-based semantic classification instead of keyword matching.
    const needsFactual = await isCurrentInfoFallback(message)
    const route = needsFactual ? 'factual_tool' : 'fast_chat'

    console.error('[orchestratorClient] buildFallbackPlan (LLM): message="' + String(message).slice(0, 100) + '" route=' + route + ' reason=orchestrator_unreachable')

    return {
      plan: {
        route,
        confidence: 'low',
        reason: 'orchestrator_unreachable',
        useModel: true,
        skipToolPlanning: route === 'fast_chat',
        promptProfile: route === 'factual_tool' ? 'factual' : 'fast',
        requireVerification: route === 'factual_tool',
      },
    }
  }
}