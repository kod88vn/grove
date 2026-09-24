// Local execution-plan routing. The shared classifier is the single authority
// for chat routing; the standalone orchestrator remains a separate service for
// scheduled jobs and other integrations.

import { classifyRoute, routeToPlan } from './classifyRoute'

/**
 * Build an execution plan from the shared classifier.
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

  return await buildFallbackPlan(message, 'local_classifier')
}
