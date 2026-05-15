import http from 'node:http'

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

function normalizeDdgTopics(topics = []) {
  const normalized = []

  for (const topic of topics) {
    if (Array.isArray(topic?.Topics)) {
      normalized.push(...normalizeDdgTopics(topic.Topics))
      continue
    }

    if (!topic?.FirstURL && !topic?.Text) continue
    normalized.push({
      title: topic.Text || topic.FirstURL,
      url: topic.FirstURL || '',
      snippet: topic.Text || '',
    })
  }

  return normalized
}

async function executeWebSearch(args = {}, fetchImpl = fetch) {
  const query = String(args.query || '').trim()
  if (!query) {
    return {
      ok: false,
      error: {
        code: 'INVALID_ARGUMENTS',
        message: 'web_search requires a non-empty query',
      },
    }
  }

  const url = new URL('https://api.duckduckgo.com/')
  url.searchParams.set('q', query)
  url.searchParams.set('format', 'json')
  url.searchParams.set('no_html', '1')
  url.searchParams.set('skip_disambig', '1')

  const response = await fetchImpl(url)
  if (!response.ok) {
    return {
      ok: false,
      error: {
        code: 'UPSTREAM_HTTP_ERROR',
        message: `DuckDuckGo returned HTTP ${response.status}`,
      },
    }
  }

  const payload = await response.json()
  const related = normalizeDdgTopics(payload?.RelatedTopics || []).slice(0, 5)

  return {
    ok: true,
    payload: {
      query,
      results: related,
    },
  }
}

async function executeReadWebpage(args = {}, fetchImpl = fetch) {
  const target = String(args.url || '').trim()
  if (!target) {
    return {
      ok: false,
      error: {
        code: 'INVALID_ARGUMENTS',
        message: 'read_webpage requires a non-empty url',
      },
    }
  }

  let url
  try {
    url = new URL(target)
  } catch {
    return {
      ok: false,
      error: {
        code: 'INVALID_ARGUMENTS',
        message: 'read_webpage url must be a valid absolute URL',
      },
    }
  }

  const response = await fetchImpl(url)
  if (!response.ok) {
    return {
      ok: false,
      error: {
        code: 'UPSTREAM_HTTP_ERROR',
        message: `read_webpage target returned HTTP ${response.status}`,
      },
    }
  }

  const html = await response.text()
  const titleMatch = html.match(/<title[^>]*>([^<]+)<\/title>/i)
  const stripped = html.replace(/<script[\s\S]*?<\/script>/gi, ' ').replace(/<style[\s\S]*?<\/style>/gi, ' ').replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim()

  return {
    ok: true,
    payload: {
      url: url.toString(),
      title: titleMatch?.[1]?.trim() || null,
      content: stripped.slice(0, 4000),
    },
  }
}

async function executeTool(toolName, args, fetchImpl = fetch) {
  if (toolName === 'web_search') {
    return executeWebSearch(args, fetchImpl)
  }

  if (toolName === 'read_webpage') {
    return executeReadWebpage(args, fetchImpl)
  }

  return {
    ok: false,
    error: {
      code: 'UNSUPPORTED_MCP_TOOL',
      message: `Unsupported MCP bridge tool: ${String(toolName || '')}`,
    },
  }
}

export function createMcpBridgeServer({ fetchImpl = fetch } = {}) {
  return http.createServer(async (req, res) => {
    const requestUrl = new URL(req.url || '/', 'http://localhost')

    if (req.method === 'GET' && requestUrl.pathname === '/health') {
      json(res, 200, { ok: true, service: 'mcp-bridge' })
      return
    }

    if (req.method === 'POST' && requestUrl.pathname === '/execute') {
      const body = await readJsonBody(req)
      if (!body) {
        json(res, 400, {
          ok: false,
          error: { code: 'INVALID_JSON', message: 'Invalid JSON payload' },
        })
        return
      }

      const toolName = body.toolName
      const args = body.arguments || {}
      const result = await executeTool(toolName, args, fetchImpl)

      if (!result.ok) {
        const status = result.error?.code === 'UNSUPPORTED_MCP_TOOL' || result.error?.code === 'INVALID_ARGUMENTS' ? 400 : 502
        json(res, status, result)
        return
      }

      json(res, 200, result)
      return
    }

    json(res, 404, { ok: false, error: { code: 'NOT_FOUND', message: 'Not found' } })
  })
}

export function startMcpBridgeServer(port = Number(process.env.MCP_BRIDGE_PORT || 4020)) {
  const server = createMcpBridgeServer()
  return new Promise((resolve) => {
    server.listen(port, () => resolve(server))
  })
}

if (process.argv[1] && import.meta.url === `file://${process.argv[1]}`) {
  startMcpBridgeServer().then(() => {
    process.stdout.write('mcp bridge listening\n')
  })
}