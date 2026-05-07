import http from 'node:http'

import { createAuditEvent, logAuditEvent } from './auditLogger.js'
import { getDashboardPayload } from './dashboardService.js'
import { buildExecutionPlan } from './intentRouter.js'
import { buildSkillPromptPack } from './skillRegistry.js'
import { executeLocalTool } from './localTools.js'
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

  return http.createServer(async (req, res) => {
    const requestUrl = new URL(req.url || '/', 'http://localhost')

    if (req.method === 'GET' && requestUrl.pathname === '/health') {
      json(res, 200, { ok: true, service: 'orchestrator' })
      return
    }

    if (req.method === 'GET' && requestUrl.pathname === '/weather') {
      const location = requestUrl.searchParams.get('location') || process.env.WEATHER_LOCATION || 'Duluth, GA'
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

      const plan = buildExecutionPlan(body.message, { surface: body.surface })
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

      const plan = buildExecutionPlan(body.message, { surface: body.surface })
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
          location: body.location || process.env.WEATHER_LOCATION || 'Duluth, GA',
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

    json(res, 404, { error: 'Not found' })
  })
}

export function startServer(port = Number(process.env.PORT || 4010), options = {}) {
  const server = createServer(options)
  return new Promise((resolve) => {
    server.listen(port, () => resolve(server))
  })
}

if (process.argv[1] && import.meta.url === `file://${process.argv[1]}`) {
  startServer().then(() => {
    process.stdout.write('orchestrator listening\n')
  })
}
