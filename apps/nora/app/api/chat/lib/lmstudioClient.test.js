import { afterEach, describe, expect, it, jest } from '@jest/globals'
import { ReadableStream as NodeReadableStream } from 'node:stream/web'
import { TextDecoder as NodeTextDecoder, TextEncoder as NodeTextEncoder } from 'node:util'

if (!global.TextEncoder) global.TextEncoder = NodeTextEncoder
if (!global.TextDecoder) global.TextDecoder = NodeTextDecoder
if (!global.ReadableStream) global.ReadableStream = NodeReadableStream
if (!global.Response) {
  global.Response = class Response {
    constructor(body, init = {}) {
      this._body = body
      this.status = init.status || 200
      this.headers = init.headers || {}
    }
    async json() {
      return JSON.parse(typeof this._body === 'string' ? this._body : '')
    }
    async text() {
      return typeof this._body === 'string' ? this._body : ''
    }
  }
}

function makeBody(lines) {
  const enc = new TextEncoder()
  return new NodeReadableStream({
    start(c) {
      for (const line of lines) c.enqueue(enc.encode(line))
      c.close()
    },
  })
}

function makeMockResponse(jsonBody) {
  return {
    ok: true,
    status: 200,
    clone() { return this },
    async json() { return jsonBody },
  }
}

afterEach(() => {
  jest.restoreAllMocks()
  delete process.env.LMSTUDIO_BASE_URL
})

describe('parseLMStudioStream deduplication safety', () => {
  it('yields a distinct event for each content chunk even when created timestamp is identical', async () => {
    const { parseLMStudioStream } = await import('./lmstudioClient')
    const ts = 1749999999
    const chunks = [
      `data: {"id":"chatcmpl-1","created":${ts},"choices":[{"delta":{"content":"Hello"}}]}\n`,
      `data: {"id":"chatcmpl-1","created":${ts},"choices":[{"delta":{"content":" world"}}]}\n`,
      `data: {"id":"chatcmpl-1","created":${ts},"choices":[{"delta":{"content":"!"}}]}\n`,
      'data: [DONE]\n',
    ]
    const events = []
    for await (const e of parseLMStudioStream(makeBody(chunks), 'test-model')) {
      events.push(e)
    }
    const contentEvents = events.filter((e) => e.message?.content)
    expect(contentEvents).toHaveLength(3)
    expect(contentEvents[0].message.content).toBe('Hello')
    expect(contentEvents[1].message.content).toBe(' world')
    expect(contentEvents[2].message.content).toBe('!')
    // Each created_at must be unique so streamAnswer.js deduplication doesn't fire
    const keys = events.map((e) => e.created_at).filter(Boolean)
    expect(new Set(keys).size).toBe(keys.length)
  })

  it('emits done event after all content chunks', async () => {
    const { parseLMStudioStream } = await import('./lmstudioClient')
    const chunks = [
      'data: {"id":"chatcmpl-2","created":1000,"choices":[{"delta":{"content":"Hi"}}]}\n',
      'data: [DONE]\n',
    ]
    const events = []
    for await (const e of parseLMStudioStream(makeBody(chunks), 'test-model')) {
      events.push(e)
    }
    expect(events.some((e) => e.done === true)).toBe(true)
  })
})

describe('callLMStudio request body', () => {
  it('forwards tools array to LMStudio request body', async () => {
    process.env.LMSTUDIO_BASE_URL = 'http://test:1234/v1'
    const captured = []
    global.fetch = jest.fn(async (_url, opts) => {
      captured.push(JSON.parse(opts.body))
      return makeMockResponse({ choices: [{ message: { content: 'ok', tool_calls: [] } }] })
    })
    jest.resetModules()
    const { callLMStudio } = await import('./lmstudioClient')
    await callLMStudio({
      model: 'test-model',
      messages: [{ role: 'user', content: 'hi' }],
      stream: false,
      tools: [{ type: 'function', function: { name: 'web_search', parameters: {} } }],
    })
    expect(captured[0].tools).toBeDefined()
    expect(captured[0].tools[0].function.name).toBe('web_search')
  })

  it('omits tools from request body when no tools provided', async () => {
    process.env.LMSTUDIO_BASE_URL = 'http://test:1234/v1'
    const captured = []
    global.fetch = jest.fn(async (_url, opts) => {
      captured.push(JSON.parse(opts.body))
      return makeMockResponse({ choices: [{ message: { content: 'ok' } }] })
    })
    jest.resetModules()
    const { callLMStudio } = await import('./lmstudioClient')
    await callLMStudio({
      model: 'test-model',
      messages: [{ role: 'user', content: 'hi' }],
      stream: false,
    })
    expect(captured[0].tools).toBeUndefined()
  })
})

describe('callLMStudio non-streaming tool_calls', () => {
  it('preserves tool_calls from LMStudio non-streaming response in normalized message', async () => {
    process.env.LMSTUDIO_BASE_URL = 'http://test:1234/v1'
    const mockToolCalls = [{
      id: 'call_abc',
      type: 'function',
      function: { name: 'web_search', arguments: '{"query":"test"}' },
    }]
    global.fetch = jest.fn(async () => makeMockResponse({
      model: 'test-model',
      choices: [{ message: { role: 'assistant', content: '', tool_calls: mockToolCalls } }],
      usage: { prompt_tokens: 10, completion_tokens: 5 },
    }))
    jest.resetModules()
    const { callLMStudio } = await import('./lmstudioClient')
    const res = await callLMStudio({
      model: 'test-model',
      messages: [{ role: 'user', content: 'search for test' }],
      stream: false,
    })
    const normalized = await res.json()
    expect(normalized.message.tool_calls).toEqual(mockToolCalls)
  })

  it('omits tool_calls from normalized response when none returned', async () => {
    process.env.LMSTUDIO_BASE_URL = 'http://test:1234/v1'
    global.fetch = jest.fn(async () => makeMockResponse({
      choices: [{ message: { role: 'assistant', content: 'hello', tool_calls: [] } }],
    }))
    jest.resetModules()
    const { callLMStudio } = await import('./lmstudioClient')
    const res = await callLMStudio({
      model: 'test-model',
      messages: [{ role: 'user', content: 'hi' }],
      stream: false,
    })
    const normalized = await res.json()
    expect(normalized.message.tool_calls).toBeUndefined()
  })
})

describe('buildLmstudioPayload — enable_thinking option', () => {
  it('sets enable_thinking=false when options.think is false', async () => {
    const { buildLmstudioPayload } = await import('./lmstudioClient')
    const payload = buildLmstudioPayload({
      model: 'test-model',
      messages: [{ role: 'user', content: 'hi' }],
      options: { think: false },
    })
    expect(payload.enable_thinking).toBe(false)
  })

  it('does not set enable_thinking when options.think is not false', async () => {
    const { buildLmstudioPayload } = await import('./lmstudioClient')
    const payload = buildLmstudioPayload({
      model: 'test-model',
      messages: [{ role: 'user', content: 'hi' }],
      options: {},
    })
    expect(payload.enable_thinking).toBeUndefined()
  })

  it('does not set enable_thinking when options is omitted', async () => {
    const { buildLmstudioPayload } = await import('./lmstudioClient')
    const payload = buildLmstudioPayload({
      model: 'test-model',
      messages: [{ role: 'user', content: 'hi' }],
    })
    expect(payload.enable_thinking).toBeUndefined()
  })

  it('forwards enable_thinking=false via callLMStudio request body', async () => {
    process.env.LMSTUDIO_BASE_URL = 'http://test:1234/v1'
    const captured = []
    global.fetch = jest.fn(async (_url, opts) => {
      captured.push(JSON.parse(opts.body))
      return makeMockResponse({ choices: [{ message: { content: 'ok' } }] })
    })
    jest.resetModules()
    const { callLMStudio } = await import('./lmstudioClient')
    await callLMStudio({
      model: 'test-model',
      messages: [{ role: 'user', content: 'hi' }],
      stream: false,
      options: { think: false },
    })
    expect(captured[0].enable_thinking).toBe(false)
  })
})

describe('getAIBaseUrl', () => {
  const originalAi = process.env.AI_BASE_URL
  const originalLm = process.env.LMSTUDIO_BASE_URL

  afterEach(() => {
    if (originalAi === undefined) delete process.env.AI_BASE_URL
    else process.env.AI_BASE_URL = originalAi
    if (originalLm === undefined) delete process.env.LMSTUDIO_BASE_URL
    else process.env.LMSTUDIO_BASE_URL = originalLm
    jest.resetModules()
  })

  it('prefers AI_BASE_URL over legacy LMSTUDIO_BASE_URL and trims trailing slashes', async () => {
    process.env.AI_BASE_URL = 'http://host.docker.internal:8080/v1/'
    process.env.LMSTUDIO_BASE_URL = 'http://host.docker.internal:1234/v1'
    const { getAIBaseUrl } = await import('./lmstudioClient')
    expect(getAIBaseUrl()).toBe('http://host.docker.internal:8080/v1')
  })

  it('falls back to legacy LMSTUDIO_BASE_URL when AI_BASE_URL is unset', async () => {
    delete process.env.AI_BASE_URL
    process.env.LMSTUDIO_BASE_URL = 'http://host.docker.internal:1234/v1/'
    const { getAIBaseUrl } = await import('./lmstudioClient')
    expect(getAIBaseUrl()).toBe('http://host.docker.internal:1234/v1')
  })

  it('returns an empty string when neither is set', async () => {
    delete process.env.AI_BASE_URL
    delete process.env.LMSTUDIO_BASE_URL
    const { getAIBaseUrl } = await import('./lmstudioClient')
    expect(getAIBaseUrl()).toBe('')
  })
})
