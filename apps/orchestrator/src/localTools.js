export function executeLocalTool(call) {
  const toolName = call?.name

  if (toolName === 'get_current_time') {
    const now = new Date()
    return {
      ok: true,
      toolName,
      payload: {
        iso: now.toISOString(),
        localTime: now.toLocaleString('en-US', { hour12: false }),
      },
    }
  }

  return {
    ok: false,
    toolName,
    error: {
      code: 'UNKNOWN_LOCAL_TOOL',
      message: `Unsupported local tool: ${String(toolName || '')}`,
    },
  }
}
