// Orchestrator client for execution plan routing.
// Calls the orchestrator service at ORCHESTRATOR_URL (default: http://127.0.0.1:4010).
//
// In production fallback (when orchestrator is unreachable), this module uses
// the shared classifyRoute() helper for intent classification. This eliminates
// the parallel-but-inconsistent dual classifier system.

import { classifyRoute, routeToPlan } from './classifyRoute'

const ORCHESTRATOR_URL = process.env.ORCHESTRATOR_URL || 'http://127.0.0.1:4010'

/**
 * Build a fallback execution plan when the orchestrator is unreachable.
 * Uses the shared classifyRoute() helper for semantic intent detection.
 * In test mode, TEST_FALLBACK_ROUTE is the sole override.
 */
async function buildFallbackPlan(message, reason) {
  // In test mode, TEST_FALLBACK_ROUTE is the sole override — do NOT call classifyRoute.
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

  // Shared classifier — single authoritative classification logic.
  const routeResult = await classifyRoute(message)

  console.error('[orchestratorClient] buildFallbackPlan: message="' + String(message).slice(0, 100) + '" route=' + routeResult.route + ' reason=' + reason + ' intent=' + JSON.stringify(routeResult))

  return routeToPlan(routeResult)
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
      // If the orchestrator explicitly signals it couldn't classify (no_classifier),
      // its route is a meaningless default — fall back to classifyRoute for real routing.
      if (payload.plan.reason === 'no_classifier') {
        console.error('[orchestratorClient] Orchestrator returned no_classifier — using classifyRoute fallback')
        return await buildFallbackPlan(message, 'orchestrator_no_classifier')
      }

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
