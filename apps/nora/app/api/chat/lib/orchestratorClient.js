// Orchestrator client for execution plan routing.
// Calls the orchestrator service at ORCHESTRATOR_URL (default: http://127.0.0.1:4010).

const ORCHESTRATOR_URL = process.env.ORCHESTRATOR_URL || 'http://127.0.0.1:4010'

function isCurrentInfoQuery(message) {
  if (!message) return false
  const normalized = String(message).toLowerCase()

  // Current person detection - handles: "who is", "who's", "whos", "what is", "what are"
  const currentTitleQuestion = /\b(who['']?s|whos|who are|who is)(\sis)?\s+(the\s)?(current|sitting|incumbent|acting|present)\b/i.test(normalized)
  const titleKeyword = /\b(president|prime minister|governor|mayor|ceo|chief executive|chancellor|king|queen|pope|chair|chairperson|secretary|minister|leader)\b/.test(normalized)
  if (currentTitleQuestion && titleKeyword) return true

  // Version detection
  const versionQuestion = /\b(what(?:'s| is) the (?:latest|current|newest) (?:version|release)|current version|latest release|newest release|version of)\b/.test(normalized)
  if (versionQuestion) return true

  // Live data detection
  const liveDataQuestion = /\b(what(?:'s| is) the weather|how(?:'s| is) the weather|weather (?:today|tomorrow|tonight|right now)|temperature (?:today|now)|forecast|stock price|stock market|share price|sports score|live score|breaking news|current news|latest news)\b/.test(normalized)
  if (liveDataQuestion) return true

  // General current info detection — but exclude conversational small talk.
  const smallTalkPatterns = [
    /\bhow are you\b/i,
    /\bwh(?:a)?ts?\s+up\b/i,
    /\bwhats\s+(going|happening)\b/i,
    /\bi['\u2019]?m (fine|good|okay?|ok)\b/i,
    /\bhows(?: it)? going\b/i,
    /\bhow['\u2019]?s it going\b/i,
    /\bhows(?: it)? (going|things)\b/i,
    /\bwhat['\u2019]?s new\b/i,
  ]
  const isSmallTalk = smallTalkPatterns.some((p) => p.test(normalized))
  if (isSmallTalk) return false

  const currentCue = /\b(currently|right now|as of now|as of today|today|tonight|tomorrow|latest|newest)\b/.test(normalized)
  const factualCue =/\b(who|what|when|where|which|is|are|did|does|do|has|have)\b/.test(normalized)
  const nounCue = /\b(version|release|president|prime minister|weather|temperature|forecast|news|price|score|status|update|result|headline)\b/.test(normalized)

  // "today" alone is not enough to trigger factual search — it must co-occur with
  // a concrete noun that indicates actual news/current-data intent.
  const hasTodayToken = /\btoday\b/.test(normalized)
  if (hasTodayToken && currentCue && !nounCue) return false

  return currentCue && factualCue && nounCue
}

function buildFallbackPlan(message, reason) {
  // In test mode, TEST_FALLBACK_ROUTE is the sole override — do NOT inspect the message
  // with isCurrentInfoQuery, which would break test isolation by changing behaviour based
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

  const needsFactual = isCurrentInfoQuery(message)

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
      return buildFallbackPlan(message, 'orchestrator_http_' + res.status)
    }

    if (!payload?.plan?.route) {
      console.error('[orchestratorClient] Invalid payload received, no plan.route')
      return buildFallbackPlan(message, 'orchestrator_invalid_payload')
    }

    // Fallback path - no valid route in response
    console.error('[orchestratorClient] Returning orchestration result: route=' + payload.plan.route)
    return payload
  } catch (err) {
    console.error('[orchestratorClient] Orchestrator request failed: ' + err.message?.slice(0, 200))
    return buildFallbackPlan(message, 'orchestrator_unreachable')
  }
}