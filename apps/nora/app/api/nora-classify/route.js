import { classifyRoute } from '@/app/api/chat/lib/classifyRoute'

function log(...args) {
  console.log('[NORACLASSIFY]', ...args)
}

function error(...args) {
  console.error('[NORACLASSIFY]', ...args)
}

export async function POST(request) {
  log('=== CLASSIFIER REQUEST STARTED ===')

  let message
  try {
    const body = await request.json()
    message = body?.message
    log('Parsed request body, message:', JSON.stringify(message).slice(0, 500))
  } catch (err) {
    error('Failed to parse request body:', err.message)
    return Response.json({ error: 'invalid_request' }, { status: 400 })
  }

  if (!message) {
    error('Missing message in request body')
    return Response.json({ error: 'message_required' }, { status: 400 })
  }

  try {
    const classification = await classifyRoute(message)
    log('Classification result:', JSON.stringify(classification))
    return Response.json(classification)
  } catch (err) {
    error('Classifier unexpected error:', err.message, err.stack)
    return Response.json({ error: 'classifier_error', details: err.message }, { status: 502 })
  } finally {
    log('=== CLASSIFIER REQUEST COMPLETED ===')
  }
}
