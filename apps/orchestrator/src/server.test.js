import test from 'node:test'
import assert from 'node:assert/strict'

import { createServer, startServer } from './server.js'
import { resetAuditLogger } from './auditLogger.js'

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

test('POST /orchestrate returns 200 with execution null when no toolPlan is provided', async () => {
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

  // When no toolPlan is provided and the safe default classifier returns fast_chat,
  // the endpoint returns 200 with execution: null (no tool execution attempted)
  assert.equal(res.status, 200)
  assert.equal(body.execution, null)
  assert.equal(body.plan.route, 'fast_chat')
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

test('GET /nightly-digest/in-app returns stored digest when cron job has run', async () => {
  const previousValue = process.env.ENABLE_NIGHTLY_DIGEST
  process.env.ENABLE_NIGHTLY_DIGEST = 'true'

  const storedPayload = {
    ok: true,
    generatedAt: '2026-05-15T06:30:00.000Z',
    sections: {
      reminders: [{ id: 'stored-1', title: 'Stored reminder' }],
      shoppingList: ['Stored item'],
      weather: { temperatureF: 68 },
      market: [],
      news: [],
    },
  }

  const routeServer = createServer({
    digestBuilder: async () => storedPayload,
  })

  await new Promise((resolve) => routeServer.listen(0, resolve))
  const address = routeServer.address()
  const url = `http://127.0.0.1:${address.port}/nightly-digest/in-app`
  const res = await fetch(url)
  const body = await res.json()

  await new Promise((resolve, reject) => routeServer.close((err) => (err ? reject(err) : resolve())))
  if (typeof previousValue === 'undefined') {
    delete process.env.ENABLE_NIGHTLY_DIGEST
  } else {
    process.env.ENABLE_NIGHTLY_DIGEST = previousValue
  }

  assert.equal(res.status, 200)
  assert.equal(body.ok, true)
  assert.equal(body.sections.reminders[0].title, 'Stored reminder')
})

test('GET /nightly-digest/in-app returns 404 when nightly digest is disabled', async () => {
  const previousNodeEnv = process.env.NODE_ENV
  const previousDigestValue = process.env.ENABLE_NIGHTLY_DIGEST
  delete process.env.ENABLE_NIGHTLY_DIGEST
  process.env.NODE_ENV = 'production'

  const routeServer = createServer()

  await new Promise((resolve) => routeServer.listen(0, resolve))
  const address = routeServer.address()
  const url = `http://127.0.0.1:${address.port}/nightly-digest/in-app`
  const res = await fetch(url)
  const body = await res.json()

  await new Promise((resolve, reject) => routeServer.close((err) => (err ? reject(err) : resolve())))
  if (typeof previousNodeEnv === 'undefined') {
    delete process.env.NODE_ENV
  } else {
    process.env.NODE_ENV = previousNodeEnv
  }
  if (typeof previousDigestValue === 'undefined') {
    delete process.env.ENABLE_NIGHTLY_DIGEST
  } else {
    process.env.ENABLE_NIGHTLY_DIGEST = previousDigestValue
  }

  assert.equal(res.status, 404)
  assert.equal(body.error, 'Nightly digest not enabled')
})

test('POST /nightly-digest/in-app accepts custom location', async () => {
  const previousValue = process.env.ENABLE_NIGHTLY_DIGEST
  process.env.ENABLE_NIGHTLY_DIGEST = 'true'

  let receivedLocation = null
  const routeServer = createServer({
    digestBuilder: async (options) => {
      receivedLocation = options.location
      return {
        ok: true,
        generatedAt: '2026-05-15T06:30:00.000Z',
        sections: { reminders: [], shoppingList: [], weather: {}, market: [], news: [] },
      }
    },
  })

  await new Promise((resolve) => routeServer.listen(0, resolve))
  const address = routeServer.address()
  const url = `http://127.0.0.1:${address.port}/nightly-digest/in-app`
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ location: 'Miami, FL' }),
  })
  const body = await res.json()

  await new Promise((resolve, reject) => routeServer.close((err) => (err ? reject(err) : resolve())))
  if (typeof previousValue === 'undefined') {
    delete process.env.ENABLE_NIGHTLY_DIGEST
  } else {
    process.env.ENABLE_NIGHTLY_DIGEST = previousValue
  }

  assert.equal(res.status, 200)
  assert.equal(body.ok, true)
})

