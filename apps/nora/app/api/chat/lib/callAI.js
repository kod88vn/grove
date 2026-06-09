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

/**
 * Main entry point for AI calls. Routes to LMStudio backend only.
 */
export async function callAI(payload) {
  const provider = getProvider()

  aiLog('provider:', provider, '| model:', payload?.model || '(unnamed)')

  // Validate LMSTUDIO_BASE_URL is configured
  if (!process.env.LMSTUDIO_BASE_URL) {
    console.error(AI_LOG_PREFIX, 'LMSTUDIO_BASE_URL is not set but AI_PROVIDER=lmstudio.')
    return {
      ok: false,
      status: 0,
      statusText: 'lmstudio_not_configured',
      async json() { return {} },
      async text() { return 'LMSTUDIO_BASE_URL is not configured' },
    }
  }

  return callLMStudio(payload)
}

// Export the provider for debugging / testing
export { getProvider }