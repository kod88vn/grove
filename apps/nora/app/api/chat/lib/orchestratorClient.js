const ORCHESTRATOR_URL = process.env.ORCHESTRATOR_URL || 'http://127.0.0.1:4010'

function buildFallbackPlan(reason) {
  return {
    plan: {
      route: 'factual_tool',
      confidence: 'low',
      reason,
      useModel: true,
      skipToolPlanning: false,
      promptProfile: 'factual',
      requireVerification: true,
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

    if (!res.ok) {
      return buildFallbackPlan(`orchestrator_http_${res.status}`)
    }

    const payload = await res.json()
    if (!payload?.plan?.route) {
      return buildFallbackPlan('orchestrator_invalid_payload')
    }

    return payload
  } catch {
    return buildFallbackPlan('orchestrator_unreachable')
  }
}
