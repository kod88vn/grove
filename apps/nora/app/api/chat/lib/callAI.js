// Unified AI client router. Routes to LMStudio-compatible backend only.
// All callers should import from this file instead of calling lmstudioClient.js directly.

import { callLMStudio } from './lmstudioClient'

const AI_LOG_PREFIX = '[AI_ROUTER]'

function aiLog(...args) {
  console.log(AI_LOG_PREFIX, ...args)
}

// Use console.error (not aiLog) for offline-fallback events so they surface as
// error-level entries in log aggregation (see skills/observability/openobserve)
// instead of blending in with routine info logs — this is a real backend
// failure being handled gracefully, not a normal code path.
function aiError(...args) {
  console.error(AI_LOG_PREFIX, ...args)
}

/**
 * Get the active AI provider from environment.
 * Returns 'lmstudio' only.
 */
function getProvider() {
  const provider = (process.env.AI_PROVIDER || 'lmstudio').trim().toLowerCase()
  return ['lmstudio'].includes(provider) ? provider : 'lmstudio'
}

// Message shown when no local AI backend is configured or reachable.
// This lets the app run locally without a real AI backend instead of throwing.
export const AI_OFFLINE_MESSAGE =
  'AI is offline. No local AI backend is configured or reachable — this is a stub response for local development.'

// Header set on every offline-stub response so callers/monitoring can detect
// it without parsing the body — never rely on string-matching AI_OFFLINE_MESSAGE.
const AI_OFFLINE_HEADER = 'X-AI-Offline'

/**
 * Build a normalized stub response so callers behave the same as a real backend.
 * Mirrors the shape lmstudioClient.js produces (Ollama-compatible envelope), but
 * marks itself as offline via a response header and an `offline: true` body field
 * so it can never be silently mistaken for a real backend answer.
 */
function buildOfflineResponse(payload) {
  const model = payload?.model || '(unnamed)'

  if (payload?.stream) {
    const encoder = new TextEncoder()
    const stream = new ReadableStream({
      start(controller) {
        const chunk = {
          message: { role: 'assistant', content: AI_OFFLINE_MESSAGE },
          done: false,
          offline: true,
        }
        controller.enqueue(encoder.encode(`data: ${JSON.stringify(chunk)}\n\n`))
        controller.enqueue(
          encoder.encode(
            `data: ${JSON.stringify({
              message: {},
              done: true,
              offline: true,
              total_duration: 0,
              load_duration: 0,
              prompt_eval_count: 0,
              eval_count: 0,
            })}\n\n`
          )
        )
        controller.enqueue(encoder.encode('data: [DONE]\n\n'))
        controller.close()
      },
    })

    return new Response(stream, {
      status: 200,
      headers: { 'Content-Type': 'text/event-stream', [AI_OFFLINE_HEADER]: 'true' },
    })
  }

  return new Response(
    JSON.stringify({
      model,
      message: { role: 'assistant', content: AI_OFFLINE_MESSAGE },
      done: true,
      offline: true,
      total_duration: 0,
      load_duration: 0,
      prompt_eval_count: 0,
      eval_count: 0,
    }),
    { status: 200, headers: { 'Content-Type': 'application/json', [AI_OFFLINE_HEADER]: 'true' } }
  )
}

/**
 * Main entry point for AI calls. Routes to LMStudio backend only.
 * Falls back to an offline stub when no backend is configured or reachable,
 * so the app remains usable for local development without a real AI backend.
 * The fallback is never silent: it is logged at error level and the response
 * carries the `X-AI-Offline` header plus an `offline: true` body field.
 */
export async function callAI(payload) {
  const provider = getProvider()

  aiLog('provider:', provider, '| model:', payload?.model || '(unnamed)')

  if (!process.env.LMSTUDIO_BASE_URL) {
    aiError('LMSTUDIO_BASE_URL is not configured — returning offline stub (not a real AI response)')
    return buildOfflineResponse(payload)
  }

  const res = await callLMStudio(payload)

  // status: 0 is lmstudioClient's signal for a network-level failure (backend unreachable)
  if (res.status === 0) {
    aiError('AI backend unreachable — returning offline stub (not a real AI response)')
    return buildOfflineResponse(payload)
  }

  return res
}

// Export the provider for debugging / testing
export { getProvider }