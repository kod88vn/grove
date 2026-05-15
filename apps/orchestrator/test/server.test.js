import test from 'node:test'
import assert from 'node:assert/strict'

import { createServer, startServer } from '../src/server.js'
import { resetAuditLogger } from '../src/auditLogger.js'

const testLogPath = '/tmp/grove-orchestrator-audit-server-test.log'

let server
let baseUrl

// Test stub classifier — mimics what a real model would emit for the
// specific inputs used in this suite. Real classification is handled by
// createOllamaClassifier in production.
const stubClassifier = async ({ message }) => {
  const m = String(message || '').toLowerCase()
  if (m.includes('birthday message') || m.includes('rewrite')) {
    return { route: 'fast_chat', confidence: 'high' }
  }
  if (m.includes('current time') || m === 'what time is it') {
    return { route: 'local_tool', confidence: 'high' }
  }
  if (m.includes('current president') || m.includes('chip news') || m.includes('chip exports')) {
    return { route: 'factual_tool', intent: 'factual', confidence: 'high' }
  }
  return { route: 'factual_tool', intent: 'factual', confidence: 'low' }
}

test.before(async () => {
  resetAuditLogger()
  process.env.ORCHESTRATOR_AUDIT_LOG = testLogPath
  server = await startServer(0, { intentClassifier: stubClassifier })
  const address = server.address()
  baseUrl = `http://127.0.0.1:${address.port}`
})

test.after(async () => {
  await new Promise((resolve, reject) => server.close((err) => (err ? reject(err) : resolve())))
  delete process.env.ORCHESTRATOR_AUDIT_LOG
})

test('GET /health returns service health', async () => {
  const res = await fetch(`${baseUrl}/health`)
  const body = await res.json()

  assert.equal(res.status, 200)
  assert.equal(body.ok, true)
  assert.equal(body.service, 'orchestrator')
})

test('POST /plan for casual chat returns fast_chat plan', async () => {
  const res = await fetch(`${baseUrl}/plan`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ message: 'write a short birthday message' }),
  })

  const body = await res.json()
  assert.equal(res.status, 200)
  assert.equal(body.plan.route, 'fast_chat')
  assert.equal(body.plan.skipToolPlanning, true)
})

test('POST /plan uses model-backed classifier when provided', async () => {
  const routeServer = createServer({
    intentClassifier: async () => ({
      route: 'factual_tool',
      intent: 'factual',
      confidence: 'medium',
      reason: 'model_event_disambiguation',
    }),
  })

  await new Promise((resolve) => routeServer.listen(0, resolve))
  const address = routeServer.address()
  const url = `http://127.0.0.1:${address.port}/plan`
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ message: 'can you give me an update on trade sanctions?' }),
  })
  const body = await res.json()

  await new Promise((resolve, reject) => routeServer.close((err) => (err ? reject(err) : resolve())))

  assert.equal(res.status, 200)
  assert.equal(body.plan.route, 'factual_tool')
  assert.equal(body.plan.toolPlan[0].name, 'factual_lookup')
})

test('POST /plan for local action executes local tool directly', async () => {
  const res = await fetch(`${baseUrl}/plan`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ message: 'what is the current time' }),
  })

  const body = await res.json()
  assert.equal(res.status, 200)
  assert.equal(body.plan.route, 'local_tool')
  assert.equal(body.execution.ok, true)
  assert.equal(body.execution.toolName, 'get_current_time')
})

test('GET /weather returns normalized weather payload from provider', async () => {
  const mockPayload = {
    location: { label: 'Duluth, Georgia, US', timezone: 'America/New_York' },
    observedAt: '2026-05-06T12:00',
    current: { temperatureF: 73, condition: 'Partly cloudy', windMph: 10 },
    today: { highF: 74, lowF: 61, precipChancePct: 40 },
    source: { provider: 'open-meteo' },
  }

  const weatherServer = createServer({
    weatherProvider: async () => mockPayload,
  })

  await new Promise((resolve) => weatherServer.listen(0, resolve))
  const address = weatherServer.address()
  const url = `http://127.0.0.1:${address.port}/weather?location=Duluth%2C%20GA`
  const res = await fetch(url)
  const body = await res.json()

  await new Promise((resolve, reject) => weatherServer.close((err) => (err ? reject(err) : resolve())))

  assert.equal(res.status, 200)
  assert.equal(body.current.temperatureF, 73)
  assert.equal(body.today.precipChancePct, 40)
  assert.equal(body.source.provider, 'open-meteo')
})

test('GET /weather returns 502 when provider fails', async () => {
  const weatherServer = createServer({
    weatherProvider: async () => {
      throw new Error('upstream failure')
    },
  })

  await new Promise((resolve) => weatherServer.listen(0, resolve))
  const address = weatherServer.address()
  const url = `http://127.0.0.1:${address.port}/weather`
  const res = await fetch(url)
  const body = await res.json()

  await new Promise((resolve, reject) => weatherServer.close((err) => (err ? reject(err) : resolve())))

  assert.equal(res.status, 502)
  assert.equal(body.error, 'Unable to load weather data')
})

test('GET /weather returns 502 when provider returns prose instead of structured weather data', async () => {
  const weatherServer = createServer({
    weatherProvider: async () => ({
      message: 'It is probably warm today. Check a radar site for details.',
    }),
  })

  await new Promise((resolve) => weatherServer.listen(0, resolve))
  const address = weatherServer.address()
  const url = `http://127.0.0.1:${address.port}/weather`
  const res = await fetch(url)
  const body = await res.json()

  await new Promise((resolve, reject) => weatherServer.close((err) => (err ? reject(err) : resolve())))

  assert.equal(res.status, 502)
  assert.equal(body.error, 'Invalid weather payload')
})

test('POST /orchestrate returns typed refusal when MCP tool is unavailable', async () => {
  const routeServer = createServer()

  await new Promise((resolve) => routeServer.listen(0, resolve))
  const address = routeServer.address()
  const url = `http://127.0.0.1:${address.port}/orchestrate`
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      message: 'search for the latest chip news',
      surface: 'tool_execution',
      toolPlan: [{ type: 'mcp_tool', name: 'web_search' }],
    }),
  })
  const body = await res.json()

  await new Promise((resolve, reject) => routeServer.close((err) => (err ? reject(err) : resolve())))

  assert.equal(res.status, 503)
  assert.equal(body.error.code, 'MCP_TOOL_UNAVAILABLE')
  assert.equal(body.plan.responseMode, 'chat')
})

test('POST /orchestrate for factual query no longer returns UNKNOWN_TOOL_TYPE', async () => {
  const routeServer = createServer()

  await new Promise((resolve) => routeServer.listen(0, resolve))
  const address = routeServer.address()
  const url = `http://127.0.0.1:${address.port}/orchestrate`
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      message: "who's the current president",
      surface: 'chat',
    }),
  })
  const body = await res.json()

  await new Promise((resolve, reject) => routeServer.close((err) => (err ? reject(err) : resolve())))

  assert.equal(res.status, 503)
  assert.equal(body.error.code, 'MCP_TOOL_UNAVAILABLE')
  assert.equal(body.plan.toolPlan[0].type, 'mcp_tool')
  assert.equal(body.plan.toolPlan[0].name, 'factual_lookup')
})

test('POST /orchestrate returns execution payload when MCP adapter succeeds', async () => {
  const routeServer = createServer({
    mcpExecutor: async (call) => ({
      ok: true,
      kind: 'mcp_tool',
      toolName: call.name,
      payload: { results: [{ title: 'Market brief', url: 'https://example.com/brief' }] },
    }),
  })

  await new Promise((resolve) => routeServer.listen(0, resolve))
  const address = routeServer.address()
  const url = `http://127.0.0.1:${address.port}/orchestrate`
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      message: 'search for the latest chip news',
      surface: 'tool_execution',
      toolPlan: [{ type: 'mcp_tool', name: 'web_search', arguments: { query: 'latest chip news' } }],
    }),
  })
  const body = await res.json()

  await new Promise((resolve, reject) => routeServer.close((err) => (err ? reject(err) : resolve())))

  assert.equal(res.status, 200)
  assert.equal(body.execution.ok, true)
  assert.equal(body.execution.kind, 'mcp_tool')
  assert.equal(Array.isArray(body.execution.payload.results), true)
})

test('GET /dashboard-data returns structured dashboard payload from provider', async () => {
  const mockPayload = {
    profile: {
      summary: 'Recent activity points to school logistics and meal planning.',
      sourceCount: 3,
    },
    brief: [{ id: '1', title: 'Camp forms review' }],
    reminders: [],
  }

  const routeServer = createServer({
    dashboardProvider: async () => mockPayload,
  })

  await new Promise((resolve) => routeServer.listen(0, resolve))
  const address = routeServer.address()
  const url = `http://127.0.0.1:${address.port}/dashboard-data`
  const res = await fetch(url)
  const body = await res.json()

  await new Promise((resolve, reject) => routeServer.close((err) => (err ? reject(err) : resolve())))

  assert.equal(res.status, 200)
  assert.equal(body.profile.sourceCount, 3)
  assert.equal(Array.isArray(body.brief), true)
})

test('GET /dashboard-data returns 502 when provider returns prose payload', async () => {
  const routeServer = createServer({
    dashboardProvider: async () => ({ message: 'Try asking chat for dashboard insights.' }),
  })

  await new Promise((resolve) => routeServer.listen(0, resolve))
  const address = routeServer.address()
  const url = `http://127.0.0.1:${address.port}/dashboard-data`
  const res = await fetch(url)
  const body = await res.json()

  await new Promise((resolve, reject) => routeServer.close((err) => (err ? reject(err) : resolve())))

  assert.equal(res.status, 502)
  assert.equal(body.error, 'Invalid dashboard payload')
})

test('POST /plan uses classification cache hit to skip repeated classifier calls', async () => {
  const cacheMap = new Map()
  const classificationCache = {
    get({ message, surface }) {
      return cacheMap.get(`${surface || 'chat'}:${String(message || '').toLowerCase()}`) || null
    },
    rememberFromClassification({ message, surface, intent }) {
      cacheMap.set(`${surface || 'chat'}:${String(message || '').toLowerCase()}`, intent)
      return true
    },
    promoteWithEvidence() {
      return false
    },
  }

  let classifierCalls = 0
  const routeServer = createServer({
    classificationCache,
    intentClassifier: async () => {
      classifierCalls += 1
      return {
        route: 'fast_chat',
        intent: 'chat',
        confidence: 'high',
        reason: 'rewrite',
      }
    },
  })

  await new Promise((resolve) => routeServer.listen(0, resolve))
  const address = routeServer.address()
  const url = `http://127.0.0.1:${address.port}/plan`

  await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ message: 'rewrite this in a friendlier tone', surface: 'chat' }),
  })

  const second = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ message: 'rewrite this in a friendlier tone', surface: 'chat' }),
  })
  const secondBody = await second.json()

  await new Promise((resolve, reject) => routeServer.close((err) => (err ? reject(err) : resolve())))

  assert.equal(classifierCalls, 1)
  assert.equal(secondBody.plan.route, 'fast_chat')
})

test('POST /orchestrate promotes factual classification to persistent cache when tool returns citations', async () => {
  let promoted = null
  const classificationCache = {
    get() {
      return null
    },
    rememberFromClassification() {
      return false
    },
    promoteWithEvidence(input) {
      promoted = input
      return true
    },
  }

  const routeServer = createServer({
    classificationCache,
    intentClassifier: async () => ({
      route: 'factual_tool',
      intent: 'factual',
      confidence: 'high',
      reason: 'fresh_news',
    }),
    mcpExecutor: async () => ({
      ok: true,
      payload: { results: [{ title: 'News', url: 'https://example.com/news' }] },
    }),
  })

  await new Promise((resolve) => routeServer.listen(0, resolve))
  const address = routeServer.address()
  const url = `http://127.0.0.1:${address.port}/orchestrate`

  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ message: 'latest chip news', surface: 'chat' }),
  })
  const body = await res.json()

  await new Promise((resolve, reject) => routeServer.close((err) => (err ? reject(err) : resolve())))

  assert.equal(res.status, 200)
  assert.equal(body.plan.route, 'factual_tool')
  assert.equal(promoted?.message, 'latest chip news')
  assert.equal(promoted?.intent?.route, 'factual_tool')
})

test('POST /nightly-digest/test returns 404 when SMS test page feature is disabled', async () => {
  const previousValue = process.env.ENABLE_SMS_TEST_PAGE
  process.env.ENABLE_SMS_TEST_PAGE = 'false'

  const routeServer = createServer()

  await new Promise((resolve) => routeServer.listen(0, resolve))
  const address = routeServer.address()
  const url = `http://127.0.0.1:${address.port}/nightly-digest/test`
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ phoneNumber: '7705551234', carrier: 'att' }),
  })
  const body = await res.json()

  await new Promise((resolve, reject) => routeServer.close((err) => (err ? reject(err) : resolve())))
  if (typeof previousValue === 'undefined') {
    delete process.env.ENABLE_SMS_TEST_PAGE
  } else {
    process.env.ENABLE_SMS_TEST_PAGE = previousValue
  }

  assert.equal(res.status, 404)
  assert.equal(body.error, 'Not found')
})

test('POST /nightly-digest/test runs nightly digest in dry-run mode when feature is enabled', async () => {
  const previousValue = process.env.ENABLE_SMS_TEST_PAGE
  process.env.ENABLE_SMS_TEST_PAGE = 'true'

  const routeServer = createServer({
    nightlyDigestRunner: async (options) => {
      assert.equal(options.phoneNumber, '7705551234')
      assert.equal(options.carrier, 'att')
      assert.equal(options.env.DIGEST_DRY_RUN, 'true')
      return {
        requestId: 'req-test-1',
        delivery: { ok: true, id: 'dry-run' },
        payload: {
          generatedAt: '2026-05-13T06:30:00.000Z',
          delivery: { channel: 'email_to_sms', address: '7705551234@txt.att.net' },
          sections: { reminders: [], shoppingList: [], weather: {}, market: [], news: [] },
        },
      }
    },
  })

  await new Promise((resolve) => routeServer.listen(0, resolve))
  const address = routeServer.address()
  const url = `http://127.0.0.1:${address.port}/nightly-digest/test`
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ phoneNumber: '7705551234', carrier: 'att', dryRun: true }),
  })
  const body = await res.json()

  await new Promise((resolve, reject) => routeServer.close((err) => (err ? reject(err) : resolve())))
  if (typeof previousValue === 'undefined') {
    delete process.env.ENABLE_SMS_TEST_PAGE
  } else {
    process.env.ENABLE_SMS_TEST_PAGE = previousValue
  }

  assert.equal(res.status, 200)
  assert.equal(body.ok, true)
  assert.equal(body.delivery.id, 'dry-run')
  assert.equal(body.payload.delivery.address, '7705551234@txt.att.net')
})
