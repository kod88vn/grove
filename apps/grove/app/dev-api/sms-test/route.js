import { NextResponse } from 'next/server'

function isEnabled() {
  return process.env.NODE_ENV !== 'production' && process.env.ENABLE_SMS_TEST_PAGE !== 'false'
}

export async function POST(request) {
  if (!isEnabled()) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 })
  }

  let body
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON payload' }, { status: 400 })
  }

  const orchestratorUrl = process.env.PLT_ORCHESTRATOR_URL || 'http://localhost:4010'

  try {
    const response = await fetch(`${orchestratorUrl}/nightly-digest/test`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        phoneNumber: body?.phoneNumber,
        carrier: body?.carrier,
        location: body?.location,
        dryRun: body?.dryRun !== false,
      }),
      cache: 'no-store',
    })

    const payload = await response.json()
    if (!response.ok) {
      return NextResponse.json(
        {
          error: payload?.error || 'Nightly digest test failed',
          detail: payload?.detail || 'unknown_error',
        },
        { status: response.status }
      )
    }

    return NextResponse.json(payload, { status: 200 })
  } catch (error) {
    return NextResponse.json(
      {
        error: 'Unable to reach orchestrator',
        detail: error instanceof Error ? error.message : 'unknown_error',
      },
      { status: 502 }
    )
  }
}
