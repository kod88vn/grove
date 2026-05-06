import test from 'node:test'
import assert from 'node:assert/strict'
import { existsSync, readFileSync, rmSync } from 'node:fs'

import { createAuditEvent, logAuditEvent } from '../src/auditLogger.js'

const testLogPath = '/tmp/grove-orchestrator-audit-test.log'

test.beforeEach(() => {
  process.env.ORCHESTRATOR_AUDIT_LOG = testLogPath
  if (existsSync(testLogPath)) {
    rmSync(testLogPath)
  }
})

test.after(() => {
  if (existsSync(testLogPath)) {
    rmSync(testLogPath)
  }
  delete process.env.ORCHESTRATOR_AUDIT_LOG
})

test('Given route context, when creating audit event, then structured metadata is included', () => {
  const event = createAuditEvent({
    route: '/orchestrate',
    method: 'POST',
    plan: { route: 'structured_data', skillSet: ['weather_widget'] },
    outcome: 'success',
  })

  assert.equal(event.route, '/orchestrate')
  assert.equal(event.method, 'POST')
  assert.equal(event.plan.route, 'structured_data')
  assert.equal(Array.isArray(event.plan.skillSet), true)
  assert.equal(typeof event.requestId, 'string')
})

test('Given two audit events, when logging, then JSONL file is persisted', () => {
  logAuditEvent(createAuditEvent({ route: '/plan', method: 'POST', outcome: 'success' }))
  logAuditEvent(createAuditEvent({ route: '/weather', method: 'GET', outcome: 'failure' }))

  assert.equal(existsSync(testLogPath), true)
  const lines = readFileSync(testLogPath, 'utf8').trim().split('\n')
  assert.equal(lines.length, 2)

  const first = JSON.parse(lines[0])
  const second = JSON.parse(lines[1])
  assert.equal(first.route, '/plan')
  assert.equal(second.route, '/weather')
})