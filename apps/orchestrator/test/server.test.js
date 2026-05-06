import test from 'node:test'
import assert from 'node:assert/strict'

import { createServer, startServer } from '../src/server.js'

let server
let baseUrl

test.before(async () => {
  server = await startServer(0)
  const address = server.address()
  baseUrl = `http://127.0.0.1:${address.port}`
})

test.after(async () => {
  await new Promise((resolve, reject) => server.close((err) => (err ? reject(err) : resolve())))
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
