const ORCHESTRATOR_URL = process.env.ORCHESTRATOR_URL || 'http://127.0.0.1:4010'

function buildFallbackPlan(reason) {
  const route = process.env.TEST_FALLBACK_ROUTE || 'fast_chat'
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
    return buildFallbackPlan('test_mode_default')
  }

  try {
    const res = await fetch(`${ORCHESTRATOR_URL}/orchestrate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ message, surface: 'chat' }),
    })

    const payload = await res.json().catch(() => null)

    if (payload?.plan?.route) {
      return {
        ...payload,
        plan: {
          ...payload.plan,
          reason: res.ok ? payload.plan.reason : payload.plan.reason || `orchestrator_http_${res.status}`,
        },
      }
    }

    if (!res.ok) {
      return buildFallbackPlan(`orchestrator_http_${res.status}`)
    }

    if (!payload?.plan?.route) {
      return buildFallbackPlan('orchestrator_invalid_payload')
    }

    return payload
  } catch {
    return buildFallbackPlan('orchestrator_unreachable')
  }
}
