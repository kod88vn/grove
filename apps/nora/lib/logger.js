/**
 * Shared logger for all Grove apps.
 * Writes logs to OpenObserve via Nora's central ingestion endpoint (/chat/api/ingest).
 * Works in both Node.js (server) and browser (client) environments.
 *
 * Usage:
 *   import { createLogger } from '@/lib/logger'
 *   const log = createLogger({ service: 'nora', level: 'info' })
 *   log.error('Ollama timeout', { error, stack, metadata: { model } })
 *   log.info('Request completed', { metadata: { durationMs, route } })
 */

// ─── Configuration ───────────────────────────────────────────────────────────

const INGEST_PATH = '/chat/api/ingest'
const MAX_BATCH_SIZE = 50
const BATCH_FLUSH_INTERVAL_MS = 2000 // flush batch every 2 seconds

// ─── Log Level Ordering ─────────────────────────────────────────────────────

const LEVEL_ORDER = { debug: 0, info: 1, warn: 2, error: 3, fatal: 4 }

// ─── Sensitive keys to redact from metadata ──────────────────────────────────

const SENSITIVE_KEYS = new Set([
  'password', 'secret', 'token', 'apiKey', 'api_key', 'apikey',
  'authorization', 'cookie', 'session', 'credential', 'privateKey',
])

/**
 * Recursively redact sensitive values from an object.
 */
function redactSensitive(obj, depth = 0) {
  if (depth > 5 || typeof obj !== 'object' || obj === null) return obj
  if (Array.isArray(obj)) return obj.map((v) => redactSensitive(v, depth + 1))

  const result = {}
  for (const [key, value] of Object.entries(obj)) {
    const lowerKey = key.toLowerCase()
    if (SENSITIVE_KEYS.has(lowerKey)) {
      result[key] = '[REDACTED]'
    } else if (typeof value === 'object' && value !== null) {
      result[key] = redactSensitive(value, depth + 1)
    } else {
      result[key] = value
    }
  }
  return result
}

// ─── Batch Buffer (client-side, reduces API calls) ──────────────────────────

let batch = []
let flushTimer = null

function enqueue(entry) {
  batch.push(entry)
  if (batch.length >= MAX_BATCH_SIZE) {
    flushBatch()
  } else if (!flushTimer) {
    flushTimer = setTimeout(flushBatch, BATCH_FLUSH_INTERVAL_MS)
  }
}

async function flushBatch() {
  if (!flushTimer || batch.length === 0) return
  clearTimeout(flushTimer)
  flushTimer = null

  const snapshot = batch.slice(0, MAX_BATCH_SIZE)
  batch = []

  try {
    await fetch(INGEST_PATH, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(snapshot),
      keepalive: true, // works in browsers even during page unload
    })
  } catch {
    // Best-effort — if ingestion fails in browser, just drop the log
  }
}

// ─── Logger Class ────────────────────────────────────────────────────────────

export function createLogger({ service = 'nora', level = process.env.NODE_ENV === 'production' ? 'info' : 'debug' } = {}) {
  const minLevel = LEVEL_ORDER[level] ?? 1 // default: info

  function makeEntry(message, extra = {}) {
    const entry = {
      timestamp: new Date().toISOString(),
      service,
      message,
    }

    if (extra.error) entry.error = String(extra.error)
    if (extra.stack) entry.stack = String(extra.stack)

    // Redact sensitive keys from metadata before sending
    if (extra.metadata && typeof extra.metadata === 'object') {
      entry.metadata = redactSensitive(extra.metadata)
    }

    return entry
  }

  function log(level, message, extra = {}) {
    if (LEVEL_ORDER[level] < minLevel) return

    const entry = makeEntry(message, extra)

    // Server-side: send immediately (single log, no batching needed for server API calls)
    if (typeof window === 'undefined') {
      sendToIngest(entry)
      return
    }

    // Client-side: batch to reduce network overhead
    enqueue(entry)
  }

  return {
    debug: (message, extra) => log('debug', message, extra),
    info: (message, extra) => log('info', message, extra),
    warn: (message, extra) => log('warn', message, extra),
    error: (message, extra) => log('error', message, extra),
    fatal: (message, extra) => log('fatal', message, extra),

    /**
     * Log a request: records method, path, duration, and status.
     */
    request(method, path, { durationMs, statusCode = 200, userId } = {}) {
      log(statusCode >= 500 ? 'error' : statusCode >= 400 ? 'warn' : 'info', `${method} ${path}`, {
        metadata: { method, path, durationMs, statusCode },
      })
    },

    /**
     * Log an Ollama call: records model, duration, and success/failure.
     */
    ollama(model, { ok, durationMs, promptTokens, completionTokens } = {}) {
      if (ok) {
        log('info', `ollama response`, { metadata: { model, durationMs, promptTokens, completionTokens } })
      } else {
        log('error', `ollama request failed`, { metadata: { model, durationMs } })
      }
    },
  }
}

// ─── Server-Side Only: Send to OpenObserve Directly ─────────────────────────

async function sendToIngest(entry) {
  // Don't log ingestion failures themselves to avoid infinite loops in dev
  if (process.env.NODE_ENV === 'development') return

  try {
    const ingestUrl = process.env.INGEST_URL || 'http://localhost:3001/chat/api/ingest'
    await fetch(ingestUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify([entry]),
    })
  } catch {
    // Silently drop — we don't want logging to break the app
  }
}

// ─── Browser Global Error Handler (auto-capture) ─────────────────────────────

if (typeof window !== 'undefined') {
  // Capture unhandled errors
  window.addEventListener('error', (event) => {
    createLogger({ service: 'nora' }).error(event.message || 'unhandled error', {
      stack: `${event.error?.name}: ${event.error?.message}\n${event.error?.stack || 'no stack'}`,
      metadata: { filename: event.filename, lineno: event.lineno, colno: event.colno },
    })
  })

  // Capture unhandled promise rejections
  window.addEventListener('unhandledrejection', (event) => {
    createLogger({ service: 'nora' }).error('unhandled promise rejection', {
      error: event.reason?.message || String(event.reason),
      stack: event.reason?.stack,
    })
  })

  // Capture navigation timing (client-side)
  if ('performance' in window && 'navigatePerfObserver' in performance) {
    const navEntry = performance.getEntriesByType('navigation')[0]
    if (navEntry) {
      createLogger().info('page load', { metadata: { durationMs: navEntry.loadEventEnd - navEntry.startTime } })
    }
  }

  // Flush remaining batch on page unload
  if (typeof document !== 'undefined') {
    window.addEventListener('beforeunload', flushBatch)
  }
}

// ─── Default Export (convenience for apps that just want a quick log) ─────────

export const defaultLogger = createLogger({ service: 'nora' })