import http from 'node:http'

import { createAuditEvent, logAuditEvent } from './auditLogger.js'
import { createClassificationCache } from './classificationCache.js'
import { getDashboardPayload } from './dashboardService.js'
import { buildExecutionPlan, buildExecutionPlanWithClassifier } from './intentRouter.js'
import { buildSkillPromptPack } from './skillRegistry.js'
import { executeLocalTool } from './localTools.js'
import { createOllamaClassifier } from './ollamaClassifier.js'
import { buildNightlyDigest } from './nightlyDigest.js'
import { formatNightlyDigestMessage } from './nightlyDigestSender.js'
import { runNightlyDigestJob, loadStoredDigest } from './nightlyDigestWorker.js'
import { validateResponse } from './responseValidator.js'
import { executeToolPlan } from './toolRegistry.js'
import { getWeatherPayload } from './weatherService.js'

function json(res, statusCode, payload) {
  const body = JSON.stringify(payload)
  res.writeHead(statusCode, {
    'Content-Type': 'application/json; charset=utf-8',
    'Content-Length': Buffer.byteLength(body),
  })
  res.end(body)
}

async function readJsonBody(req) {
  const chunks = []
  for await (const chunk of req) {
    chunks.push(Buffer.from(chunk))
  }

  const text = Buffer.concat(chunks).toString('utf8').trim()
  if (!text) return {}

  try {
    return JSON.parse(text)
  } catch {
    return null
  }
}

export function createServer(options = {}) {
  const weatherProvider = options.weatherProvider || getWeatherPayload
  const dashboardProvider = options.dashboardProvider || getDashboardPayload
  const mcpExecutor = options.mcpExecutor
  const mcpEndpoint = options.mcpEndpoint || process.env.ORCHESTRATOR_MCP_EXECUTE_URL || ''
  const intentClassifier = options.intentClassifier
  const nightlyDigestRunner = options.nightlyDigestRunner || runNightlyDigestJob
  const digestBuilder = options.digestBuilder || buildNightlyDigest
  const ownedClassificationCache = options.classificationCache
    ? null
    : createClassificationCache({
        dbPath: process.env.CLASSIFICATION_CACHE_PATH,
      })
  const classificationCache = options.classificationCache || ownedClassificationCache

  const server = http.createServer(async (req, res) => {
    const requestUrl = new URL(req.url || '/', 'http://localhost')

    if (req.method === 'GET' && requestUrl.pathname === '/health') {
      json(res, 200, { ok: true, service: 'orchestrator' })
      return
    }

    if (req.method === 'GET' && requestUrl.pathname === '/weather') {
      const location = requestUrl.searchParams.get('location') || process.env.GROVE_LOCATION || 'Duluth, Georgia, USA'
      const plan = buildExecutionPlan(`weather forecast for ${location}`, { surface: 'weather_widget' })
      const requestId = `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`

      try {
        const weather = await weatherProvider(location)
        const validation = validateResponse(plan.schemaName, weather)

        if (!validation.ok) {
          logAuditEvent(
            createAuditEvent({
              requestId,
              route: '/weather',
              method: 'GET',
              plan,
              outcome: 'failure',
              error: { code: 'SCHEMA_VALIDATION_FAILED', detail: validation.errors },
            })
          )
          json(res, 502, {
            error: 'Invalid weather payload',
            detail: validation.errors,
          })
          return
        }

        logAuditEvent(
          createAuditEvent({
            requestId,
            route: '/weather',
            method: 'GET',
            plan,
            outcome: 'success',
            metadata: { location },
          })
        )
        json(res, 200, weather)
      } catch (error) {
        logAuditEvent(
          createAuditEvent({
            requestId,
            route: '/weather',
            method: 'GET',
            plan,
            outcome: 'failure',
            error: { code: 'TOOL_EXECUTION_FAILED', message: error instanceof Error ? error.message : 'unknown_error' },
          })
        )
        json(res, 502, {
          error: 'Unable to load weather data',
          detail: error instanceof Error ? error.message : 'unknown_error',
        })
      }
      return
    }

    if (req.method === 'GET' && requestUrl.pathname === '/dashboard-data') {
      const plan = buildExecutionPlan('dashboard profile data', { surface: 'dashboard_profile' })
      const requestId = `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`

      try {
        const payload = await dashboardProvider()
        const validation = validateResponse(plan.schemaName, payload)

        if (!validation.ok) {
          logAuditEvent(
            createAuditEvent({
              requestId,
              route: '/dashboard-data',
              method: 'GET',
              plan,
              outcome: 'failure',
              error: { code: 'SCHEMA_VALIDATION_FAILED', detail: validation.errors },
            })
          )
          json(res, 502, {
            error: 'Invalid dashboard payload',
            detail: validation.errors,
          })
          return
        }

        logAuditEvent(
          createAuditEvent({
            requestId,
            route: '/dashboard-data',
            method: 'GET',
            plan,
            outcome: 'success',
          })
        )
        json(res, 200, payload)
      } catch (error) {
        logAuditEvent(
          createAuditEvent({
            requestId,
            route: '/dashboard-data',
            method: 'GET',
            plan,
            outcome: 'failure',
            error: {
              code: 'TOOL_EXECUTION_FAILED',
              message: error instanceof Error ? error.message : 'unknown_error',
            },
          })
        )
        json(res, 502, {
          error: 'Unable to load dashboard data',
          detail: error instanceof Error ? error.message : 'unknown_error',
        })
      }
      return
    }

    if (req.method === 'POST' && requestUrl.pathname === '/plan') {
      const body = await readJsonBody(req)
      if (!body) {
        json(res, 400, { error: 'Invalid JSON payload' })
        return
      }

      const plan = await buildExecutionPlanWithClassifier(body.message, { surface: body.surface }, {
        classifyWithModel: intentClassifier,
        classificationCache,
      })
      const requestId = `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`
      if (plan.route === 'local_tool' && plan.toolName) {
        const execution = executeLocalTool({ name: plan.toolName })
        logAuditEvent(
          createAuditEvent({
            requestId,
            route: '/plan',
            method: 'POST',
            plan,
            outcome: execution.ok ? 'success' : 'failure',
            error: execution.ok ? null : execution.error,
          })
        )
        json(res, 200, { plan, execution })
        return
      }

      logAuditEvent(
        createAuditEvent({
          requestId,
          route: '/plan',
          method: 'POST',
          plan,
          outcome: 'success',
        })
      )
      json(res, 200, { plan, skillPromptPack: buildSkillPromptPack(plan.skillSet || []) })
      return
    }

    if (req.method === 'POST' && requestUrl.pathname === '/orchestrate') {
      const body = await readJsonBody(req)
      if (!body) {
        json(res, 400, { error: 'Invalid JSON payload' })
        return
      }

      const plan = await buildExecutionPlanWithClassifier(body.message, { surface: body.surface }, {
        classifyWithModel: intentClassifier,
        classificationCache,
      })
      const requestId = `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`
      const toolPlan = Array.isArray(body.toolPlan) ? body.toolPlan : plan.toolPlan

      if (!Array.isArray(toolPlan) || toolPlan.length === 0) {
        logAuditEvent(
          createAuditEvent({
            requestId,
            route: '/orchestrate',
            method: 'POST',
            plan,
            outcome: 'success',
            metadata: { reason: 'no_tool_plan' },
          })
        )
        json(res, 200, { plan, execution: null, skillPromptPack: buildSkillPromptPack(plan.skillSet || []) })
        return
      }

      try {
        const execution = await executeToolPlan(toolPlan, {
          userMessage: body.message,
          location: body.location || process.env.GROVE_LOCATION || 'Duluth, Georgia, USA',
          weatherProvider,
          dashboardProvider,
          mcpExecutor,
          mcpEndpoint,
        })

        if (!execution.ok) {
          const status = execution.error?.code === 'MCP_TOOL_UNAVAILABLE' ? 503 : 502
          logAuditEvent(
            createAuditEvent({
              requestId,
              route: '/orchestrate',
              method: 'POST',
              plan,
              outcome: 'failure',
              error: execution.error,
            })
          )
          json(res, status, {
            plan,
            error: execution.error,
            execution,
          })
          return
        }

        if (plan.responseMode === 'structured_data' && plan.schemaName) {
          const validation = validateResponse(plan.schemaName, execution.payload)
          if (!validation.ok) {
            logAuditEvent(
              createAuditEvent({
                requestId,
                route: '/orchestrate',
                method: 'POST',
                plan,
                outcome: 'failure',
                error: { code: 'SCHEMA_VALIDATION_FAILED', detail: validation.errors },
              })
            )
            json(res, 502, {
              plan,
              error: {
                code: 'SCHEMA_VALIDATION_FAILED',
                message: 'Tool output did not satisfy the required schema',
                detail: validation.errors,
              },
              execution,
            })
            return
          }
        }

        if (classificationCache && typeof classificationCache.promoteWithEvidence === 'function') {
          classificationCache.promoteWithEvidence({
            message: body.message,
            surface: body.surface || 'chat',
            intent: {
              route: plan.route,
              intent: plan.intent,
              confidence: plan.confidence,
              reason: plan.reason,
              toolName: plan.toolName,
            },
            payload: execution.payload,
          })
        }

        logAuditEvent(
          createAuditEvent({
            requestId,
            route: '/orchestrate',
            method: 'POST',
            plan,
            outcome: 'success',
          })
        )
        json(res, 200, {
          plan,
          execution,
          skillPromptPack: buildSkillPromptPack(plan.skillSet || []),
        })
      } catch (error) {
        logAuditEvent(
          createAuditEvent({
            requestId,
            route: '/orchestrate',
            method: 'POST',
            plan,
            outcome: 'failure',
            error: {
              code: 'TOOL_EXECUTION_FAILED',
              message: error instanceof Error ? error.message : 'unknown_error',
            },
          })
        )
        json(res, 502, {
          plan,
          error: {
            code: 'TOOL_EXECUTION_FAILED',
            message: error instanceof Error ? error.message : 'unknown_error',
          },
        })
      }
      return
    }

    // In-app nightly digest endpoint — returns stored digest from cron job, or builds fresh if not available
    if (req.method === 'GET' && requestUrl.pathname === '/nightly-digest/in-app') {
      const enabled = process.env.NODE_ENV !== 'production' || process.env.ENABLE_NIGHTLY_DIGEST === 'true'
      if (!enabled) {
        json(res, 404, { error: 'Nightly digest not enabled' })
        return
      }

      try {
        const stored = loadStoredDigest()
        if (stored && stored.payload) {
          json(res, 200, stored.payload)
          return
        }

        const payload = await digestBuilder({
          weatherProvider,
        })

        json(res, 200, payload)
      } catch (error) {
        json(res, 502, {
          error: 'Nightly digest generation failed',
          detail: error instanceof Error ? error.message : 'unknown_error',
        })
      }
      return
    }

    if (req.method === 'POST' && requestUrl.pathname === '/nightly-digest/in-app') {
      const enabled = process.env.NODE_ENV !== 'production' || process.env.ENABLE_NIGHTLY_DIGEST === 'true'
      if (!enabled) {
        json(res, 404, { error: 'Nightly digest not enabled' })
        return
      }

      const body = await readJsonBody(req)
      if (!body) {
        json(res, 400, { error: 'Invalid JSON payload' })
        return
      }

      try {
        const stored = loadStoredDigest()
        if (stored && stored.payload) {
          json(res, 200, stored.payload)
          return
        }

        const payload = await digestBuilder({
          location: body.location,
          weatherProvider,
        })

        json(res, 200, payload)
      } catch (error) {
        json(res, 502, {
          error: 'Nightly digest generation failed',
          detail: error instanceof Error ? error.message : 'unknown_error',
        })
      }
      return
    }

    json(res, 404, { error: 'Not found' })
  })

  if (ownedClassificationCache) {
    const originalClose = server.close.bind(server)
    server.close = (callback) => {
      ownedClassificationCache.close()
      return originalClose(callback)
    }
  }

  return server
}

export function startServer(port = Number(process.env.PORT || 4010), options = {}) {
  const resolvedOptions = { ...options }
  // Auto-wire Nora-proxy classifier when PLT_NORA_URL or NORA_URL is set and
  // the caller didn't supply one. Tests run without these env vars so they get
  // the safe default classifier (factual_tool/low) unless they inject a stub.
  // The fallback to localhost is intentional for local dev but must NOT be used
  // as a truthy guard — wiring only happens when an env var explicitly provides a URL.
  const noraUrl = process.env.PLT_NORA_URL || process.env.NORA_URL || 'http://localhost:3001'
  if (!resolvedOptions.intentClassifier && (process.env.PLT_NORA_URL || process.env.NORA_URL)) {
    resolvedOptions.intentClassifier = createOllamaClassifier({ noraUrl })
  }
  const server = createServer(resolvedOptions)
  return new Promise((resolve) => {
    server.listen(port, () => resolve(server))
  })
}

if (process.argv[1] && import.meta.url === `file://${process.argv[1]}`) {
  startServer().then(() => {
    process.stdout.write('orchestrator listening\n')
  })
}
