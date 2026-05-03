export function normalizeQuery(rawArguments) {
  if (!rawArguments) return ''
  if (typeof rawArguments === 'string') {
    try {
      return JSON.parse(rawArguments).query?.toString().trim() ?? ''
    } catch {
      return rawArguments.trim()
    }
  }
  return rawArguments.query?.toString().trim() ?? ''
}

export function normalizeUrl(rawArguments) {
  if (!rawArguments) return ''

  let value = ''
  if (typeof rawArguments === 'string') {
    try {
      value = JSON.parse(rawArguments).url?.toString().trim() ?? rawArguments.trim()
    } catch {
      value = rawArguments.trim()
    }
  } else {
    value = rawArguments.url?.toString().trim() ?? ''
  }

  if (!value) return ''

  try {
    const parsed = new URL(value)
    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') return ''
    return parsed.toString()
  } catch {
    return ''
  }
}

// Some models (e.g. qwen3-coder) emit XML-style tool calls in message content
// instead of a structured tool_calls field. Parse both.
export function parseXmlToolCalls(content) {
  if (!content) return []
  const calls = []
  const fnRegex = /<function=(\w+)>(.*?)<\/function>/gs
  let fnMatch
  while ((fnMatch = fnRegex.exec(content)) !== null) {
    const name = fnMatch[1]
    const body = fnMatch[2]
    const args = {}
    const paramRegex = /<parameter=(\w+)>([\s\S]*?)<\/parameter>/g
    let pMatch
    while ((pMatch = paramRegex.exec(body)) !== null) {
      args[pMatch[1]] = pMatch[2].trim()
    }
    calls.push({ type: 'function', function: { name, arguments: args } })
  }
  return calls
}

export function extractToolCalls(message) {
  const structured = message?.tool_calls
  if (Array.isArray(structured) && structured.length > 0) {
    return structured.map((call) => ({
      ...call,
      type: call?.type || 'function',
    }))
  }
  return parseXmlToolCalls(message?.content ?? '')
}
