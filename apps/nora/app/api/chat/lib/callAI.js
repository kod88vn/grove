// Unified AI client router. Routes to LMStudio-compatible backend only.
// All callers should import from this file instead of calling lmstudioClient.js directly.

import { callLMStudio } from './lmstudioClient'

const AI_LOG_PREFIX = '[AI_ROUTER]'

function aiLog(...args) {
  console.log(AI_LOG_PREFIX, ...args)
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

/**
 * Build a normalized stub response so callers behave the same as a real backend.
 * Mirrors the shape lmstudioClient.js produces (Ollama-compatible envelope).
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
        }
        controller.enqueue(encoder.encode(`data: ${JSON.stringify(chunk)}\n\n`))
        controller.enqueue(
          encoder.encode(
            `data: ${JSON.stringify({
              message: {},
              done: true,
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
      headers: { 'Content-Type': 'text/event-stream' },
    })
  }

  return new Response(
    JSON.stringify({
      model,
      message: { role: 'assistant', content: AI_OFFLINE_MESSAGE },
      done: true,
      total_duration: 0,
      load_duration: 0,
      prompt_eval_count: 0,
      eval_count: 0,
    }),
    { status: 200, headers: { 'Content-Type': 'application/json' } }
  )
}

/**
 * Main entry point for AI calls. Routes to LMStudio backend only.
 * Falls back to an offline stub when no backend is configured or reachable,
 * so the app remains usable for local development without a real AI backend.
 */
export async function callAI(payload) {
  const provider = getProvider()

  aiLog('provider:', provider, '| model:', payload?.model || '(unnamed)')

  if (!process.env.LMSTUDIO_BASE_URL) {
    aiLog('LMSTUDIO_BASE_URL is not configured — returning offline stub')
    return buildOfflineResponse(payload)
  }

  const res = await callLMStudio(payload)

  // status: 0 is lmstudioClient's signal for a network-level failure (backend unreachable)
  if (res.status === 0) {
    aiLog('AI backend unreachable — returning offline stub')
    return buildOfflineResponse(payload)
  }

  return res
}

// Export the provider for debugging / testing
export { getProvider }