import { NextResponse } from 'next/server'

const ORCHESTRATOR_URL = process.env.PLT_ORCHESTRATOR_URL || 'http://localhost:4010'
const REQUEST_TIMEOUT_MS = 5000

function requestOptions(options = {}) {
  return {
    ...options,
    signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
  }
}

export async function GET() {
  try {
    const res = await fetch(`${ORCHESTRATOR_URL}/nightly-digest/in-app`, requestOptions())
    if (!res.ok) {
      return NextResponse.json({ ok: false }, { status: res.status })
    }
    const data = await res.json()
    return NextResponse.json(data)
  } catch {
    return NextResponse.json({ ok: false, error: 'orchestrator_unreachable' }, { status: 502 })
  }
}

export async function POST(request) {
  try {
    const body = await request.json()
    const res = await fetch(`${ORCHESTRATOR_URL}/nightly-digest/in-app`, requestOptions({
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    }))
    if (!res.ok) {
      return NextResponse.json({ ok: false }, { status: res.status })
    }
    const data = await res.json()
    return NextResponse.json(data)
  } catch {
    return NextResponse.json({ ok: false, error: 'orchestrator_unreachable' }, { status: 502 })
  }
}