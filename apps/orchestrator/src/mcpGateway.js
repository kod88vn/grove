const DEFAULT_MCP_EXECUTE_URL = process.env.ORCHESTRATOR_MCP_EXECUTE_URL || ''

async function parseJsonResponse(res) {
  const rawBody = typeof res.text === 'function' ? await res.text() : ''
  const body = rawBody.trim()

  if (!body) {
    return {
      ok: false,
      error: {
        code: 'MCP_TOOL_EMPTY_RESPONSE',
        message: 'MCP endpoint returned an empty response body',
      },
    }
  }

  try {
    return { ok: true, payload: JSON.parse(body) }
  } catch {
    return {
      ok: false,
      error: {
        code: 'MCP_TOOL_INVALID_RESPONSE',
        message: 'MCP endpoint returned invalid JSON',
      },
    }
  }
}

export async function executeMcpTool(call, options = {}) {
  const toolName = call?.name
  const toolArguments = call?.arguments || {}
  const endpoint = options.endpoint || DEFAULT_MCP_EXECUTE_URL

  if (typeof options.executor === 'function') {
    try {
      const result = await options.executor({ name: toolName, arguments: toolArguments })
      if (result && result.ok) {
        return {
          ok: true,
          kind: 'mcp_tool',
          toolName,
          payload: result.payload,
        }
      }

      return {
        ok: false,
        kind: 'mcp_tool',
        toolName,
        error: result?.error || {
          code: 'MCP_TOOL_EXECUTION_FAILED',
          message: `MCP executor failed for tool: ${String(toolName || '')}`,
        },
      }
    } catch (error) {
      return {
        ok: false,
        kind: 'mcp_tool',
        toolName,
        error: {
          code: 'MCP_TOOL_EXECUTION_FAILED',
          message: error instanceof Error ? error.message : 'unknown_error',
        },
      }
    }
  }

  if (endpoint) {
    try {
      const res = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ toolName, arguments: toolArguments }),
      })

      if (!res.ok) {
        return {
          ok: false,
          kind: 'mcp_tool',
          toolName,
          error: {
            code: 'MCP_TOOL_HTTP_ERROR',
            message: `MCP endpoint returned HTTP ${res.status}`,
          },
        }
      }

      const parsed = await parseJsonResponse(res)
      if (!parsed.ok) {
        return {
          ok: false,
          kind: 'mcp_tool',
          toolName,
          error: parsed.error,
        }
      }

      const payload = parsed.payload
      if (payload?.ok === false) {
        return {
          ok: false,
          kind: 'mcp_tool',
          toolName,
          error: payload.error || {
            code: 'MCP_TOOL_EXECUTION_FAILED',
            message: `MCP endpoint reported failure for ${String(toolName || '')}`,
          },
        }
      }

      return {
        ok: true,
        kind: 'mcp_tool',
        toolName,
        payload: payload?.payload ?? payload,
      }
    } catch (error) {
      return {
        ok: false,
        kind: 'mcp_tool',
        toolName,
        error: {
          code: 'MCP_TOOL_EXECUTION_FAILED',
          message: error instanceof Error ? error.message : 'unknown_error',
        },
      }
    }
  }

  return {
    ok: false,
    kind: 'mcp_tool',
    toolName,
    error: {
      code: 'MCP_TOOL_UNAVAILABLE',
      message: `MCP tool is not available in this environment: ${String(toolName || '')}`,
    },
  }
}