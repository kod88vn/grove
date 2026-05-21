// Nora-proxy classifier. Proxies classification requests to Nora's /api/nora-classify
// endpoint rather than calling Ollama directly. Only apps/nora may call Ollama;
// orchestrator (and all other sibling apps) route through Nora via PLT_NORA_URL.
//
// Contract: returns { route, intent, confidence, reason } compatible with
// classifier.normalizeModelIntent. On any error or timeout the caller will
// fall back to classifier.classifyIntent (safe default = factual_tool/low).

const DEFAULT_TIMEOUT_MS = Number(process.env.OLLAMA_CLASSIFIER_TIMEOUT_MS || 8000)

// DEFAULT_MODEL: intentionally defaults to '' (empty string).
// When empty, the `model: model || undefined` in line 34 omits the "model"
// key from the request body entirely, allowing Nora's /api/nora-classify route
// to pick its own default (DEFAULT_MODEL_NORA).  This decouples the orchestrator's
// classifier model from Nora's configurable default.
const DEFAULT_MODEL = process.env.OLLAMA_CLASSIFIER_MODEL || ''

// Resolve the Nora base URL: Platformatic mesh variable in production,
// localhost port in local dev.
function resolveNoraUrl() {
  const pltx = process.env.PLT_NORA_URL || ''
  if (pltx) {
    return pltx.replace(/\/+$/, '')
  }
  // Fallback to direct Nora dev server URL.
  const direct = process.env.NORA_URL || 'http://localhost:3001'
  return direct.replace(/\/+$/, '')
}

export function createOllamaClassifier(options = {}) {
  const noraUrl = options.noraUrl || resolveNoraUrl()
  const model = options.model || DEFAULT_MODEL
  const timeoutMs = Number(options.timeoutMs || DEFAULT_TIMEOUT_MS)
  const fetchImpl = options.fetch || globalThis.fetch

  return async function classifyWithOllama({ message }) {
    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), timeoutMs)
    try {
      const body = JSON.stringify({ message, model: model || undefined })

      // Set an AbortSignal for the fetch itself so Nora-side timeouts also work.
      const res = await fetchImpl(`${noraUrl}/api/nora-classify`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body,
        signal: controller.signal,
      })

      if (!res.ok) {
        const errBody = await res.text().catch(() => '')
        throw new Error(`nora_classifier_status_${res.status}: ${errBody}`)
      }

      return await res.json()
    } finally {
      clearTimeout(timer)
    }
  }
}