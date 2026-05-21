/**
 * Central log ingestion endpoint.
 * Receives log entries from any Grove app and forwards them to OpenObserve.
 *
 * POST /chat/api/ingest
 * Body: single log entry object or array of entries
 */

const OPENOBSERVE_URL = process.env.OPENOBSERVE_URL || 'http://openobserve:5080'
const OPENOBSERVE_ORG = 'default'
const OPENOBSERVE_STREAM = 'grove_all_logs'
const OPENOBSERVE_USER = process.env.OPENOBSERVE_UI_USER || 'admin@grove.local'
const OPENOBSERVE_PASS = process.env.OPENOBSERVE_UI_PASSWORD || ''

function basicAuthHeader() {
  return `Basic ${Buffer.from(`${OPENOBSERVE_USER}:${OPENOBSERVE_PASS}`).toString('base64')}`
}

export async function POST(request) {
  // Accept single entry or array
  let entries = await request.json()
  if (!Array.isArray(entries)) {
    entries = [entries]
  }

  // Validate and sanitize: strip fields that are client-side only (batch buffer state)
  const logs = entries.map((entry) => {
    // Ensure required fields exist
    const sanitized = { ...entry }

    // Default level to 'info' if missing
    if (!sanitized.level) sanitized.level = 'info'

    // Ensure timestamp is ISO format
    if (sanitized.timestamp && typeof sanitized.timestamp === 'string') {
      // Already ISO — keep it
    } else if (sanitized.timestamp) {
      sanitized.timestamp = new Date(sanitized.timestamp).toISOString()
    }

    // Ensure metadata is an object
    if (sanitized.metadata && typeof sanitized.metadata !== 'object') {
      sanitized.metadata = {}
    }

    return sanitized
  })

  // Forward to OpenObserve via its JSON ingest API
  const oboUrl = `${OPENOBSERVE_URL}/api/${OPENOBSERVE_ORG}/${OPENOBSERVE_STREAM}/_json`

  try {
    const response = await fetch(oboUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: basicAuthHeader(),
      },
      body: JSON.stringify(logs),
    })

    if (!response.ok) {
      const body = await response.text()
      // Log the OpenObserve failure to stderr so admins can see it
      console.error(`[OpenObserve] Ingest failed: ${response.status} - ${body}`)
      return Response.json(
        { error: 'OpenObserve ingest failed', status: response.status },
        { status: 502 }
      )
    }

    return Response.json({ ok: true, received: logs.length })
  } catch (err) {
    console.error(`[OpenObserve] Network error: ${err.message}`)
    return Response.json(
      { error: 'Failed to reach OpenObserve', message: err.message },
      { status: 503 }
    )
  }
}