import { appendFileSync, existsSync, mkdirSync, writeFileSync } from 'node:fs'

const DEFAULT_AUDIT_LOG = '/tmp/grove-orchestrator-audit.log'
let firstWriteDone = false

function buildRequestId() {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`
}

export function createAuditEvent(event = {}) {
  return {
    timestamp: new Date().toISOString(),
    requestId: event.requestId || buildRequestId(),
    route: event.route || 'unknown',
    method: event.method || 'UNKNOWN',
    plan: event.plan || null,
    outcome: event.outcome || 'unknown',
    error: event.error || null,
    metadata: event.metadata || {},
  }
}

export function resetAuditLogger() {
  firstWriteDone = false
}

function ensureLogDirectory(logPath) {
  const dir = logPath.split('/').slice(0, -1).join('/') || '/'
  if (dir && !existsSync(dir)) {
    mkdirSync(dir, { recursive: true })
  }
}

// Also export existsSync and mkdirSync for use in ensureLogDirectory if needed
export { existsSync, mkdirSync }

export function logAuditEvent(event) {
  const logPath = process.env.ORCHESTRATOR_AUDIT_LOG || DEFAULT_AUDIT_LOG
  const line = `${JSON.stringify(event)}\n`

  ensureLogDirectory(logPath)

  if (!firstWriteDone) {
    writeFileSync(logPath, line)
    firstWriteDone = true
    return
  }

  appendFileSync(logPath, line)
}
