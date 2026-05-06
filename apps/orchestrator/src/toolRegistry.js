import { executeLocalTool } from './localTools.js'
import { executeMcpTool } from './mcpGateway.js'

export async function executeToolPlan(toolPlan = [], context = {}) {
  if (!Array.isArray(toolPlan) || toolPlan.length === 0) {
    return {
      ok: false,
      kind: 'none',
      error: {
        code: 'NO_TOOL_PLAN',
        message: 'No executable tool plan was provided',
      },
    }
  }

  const first = toolPlan[0]

  if (first.type === 'local_tool') {
    const result = executeLocalTool({ name: first.name })
    return {
      ...result,
      kind: 'local_tool',
    }
  }

  if (first.type === 'external_api' && first.name === 'weather_provider') {
    const provider = context.weatherProvider
    if (typeof provider !== 'function') {
      return {
        ok: false,
        kind: 'external_api',
        toolName: first.name,
        error: {
          code: 'EXTERNAL_TOOL_UNAVAILABLE',
          message: 'weather provider is not configured',
        },
      }
    }

    const payload = await provider(context.location)
    return {
      ok: true,
      kind: 'external_api',
      toolName: first.name,
      payload,
    }
  }

  if (first.type === 'external_api' && first.name === 'dashboard_provider') {
    const provider = context.dashboardProvider
    if (typeof provider !== 'function') {
      return {
        ok: false,
        kind: 'external_api',
        toolName: first.name,
        error: {
          code: 'EXTERNAL_TOOL_UNAVAILABLE',
          message: 'dashboard provider is not configured',
        },
      }
    }

    const payload = await provider(context)
    return {
      ok: true,
      kind: 'external_api',
      toolName: first.name,
      payload,
    }
  }

  if (first.type === 'mcp_tool') {
    return executeMcpTool(first, {
      executor: context.mcpExecutor,
      endpoint: context.mcpEndpoint,
    })
  }

  return {
    ok: false,
    kind: first.type || 'unknown',
    toolName: first.name,
    error: {
      code: 'UNKNOWN_TOOL_TYPE',
      message: `Unsupported tool type: ${String(first.type || '')}`,
    },
  }
}