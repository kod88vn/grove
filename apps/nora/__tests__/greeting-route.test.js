import { afterAll, afterEach, describe, expect, it, jest } from '@jest/globals'
import { ReadableStream as NodeReadableStream } from 'node:stream/web'
import { TextDecoder as NodeTextDecoder, TextEncoder as NodeTextEncoder } from 'node:util'

import { POST } from '../app/api/chat/route'

class TestResponse {
  constructor(body, init = {}) {
    this.body = body
    this.status = init.status ?? 200
    this.headers = init.headers ?? {}
  }

  static json(payload, init = {}) {
    return new TestResponse(JSON.stringify(payload), {
      ...init,
      headers: {
        'Content-Type': 'application/json',
        ...(init.headers ?? {}),
      },
    })
  }

  async json() {
    if (typeof this.body === 'string') {
      return JSON.parse(this.body)
    }

    const text = await this.text()
    return text ? JSON.parse(text) : {}
  }

  async text() {
    if (!this.body) return ''
    if (typeof this.body === 'string') return this.body

    const reader = this.body.getReader()
    const decoder = new TextDecoder()
    let out = ''

    while (true) {
      const { done, value } = await reader.read()
      if (done) break
      out += decoder.decode(value, { stream: true })
    }

    out += decoder.decode()
    return out
  }
}

const originalReadableStream = global.ReadableStream
const originalResponse = global.Response
const originalTextEncoder = global.TextEncoder
const originalTextDecoder = global.TextDecoder
const originalFetch = global.fetch

if (!global.ReadableStream) {
  global.ReadableStream = NodeReadableStream
}
if (!global.Response) {
  global.Response = TestResponse
}
if (!global.TextEncoder) {
  global.TextEncoder = NodeTextEncoder
}
if (!global.TextDecoder) {
  global.TextDecoder = NodeTextDecoder
}

function makeNdjsonStream(lines) {
  const encoder = new TextEncoder()
  return new NodeReadableStream({
    start(controller) {
      for (const line of lines) {
        controller.enqueue(encoder.encode(`${line}\n`))
      }
      controller.close()
    },
  })
}

async function readStreamText(response) {
  const reader = response.body.getReader()
  const decoder = new TextDecoder()
  let out = ''

  while (true) {
    const { done, value } = await reader.read()
    if (done) break
    out += decoder.decode(value, { stream: true })
  }

  out += decoder.decode()
  return out
}

afterEach(() => {
  jest.restoreAllMocks()
  global.fetch = originalFetch
})

afterAll(() => {
  global.ReadableStream = originalReadableStream
  global.Response = originalResponse
  global.TextEncoder = originalTextEncoder
  global.TextDecoder = originalTextDecoder
})

describe('Chat Route Greeting Mode', () => {
  it('uses fast greeting stream without planning statuses', async () => {
    const fetchMock = jest.fn().mockResolvedValue({
      ok: true,
      body: makeNdjsonStream([
        JSON.stringify({ message: { content: 'Hi Master, how can I help today?' }, done: false }),
        JSON.stringify({ done: true }),
      ]),
    })
    global.fetch = fetchMock

    const request = {
      json: async () => ({
        model: 'qwen3.5:9b',
        mode: 'greeting',
        greetingName: 'Master',
      }),
    }

    const response = await POST(request)
    const body = await readStreamText(response)

    expect(body).toContain('data: {"word":"Hi Master, how can I help today?"}')
    expect(body).toContain('data: [DONE]')
    expect(body).not.toContain('Planning…')

    expect(fetchMock).toHaveBeenCalledTimes(1)
    const [, options] = fetchMock.mock.calls[0]
    const payload = JSON.parse(options.body)
    expect(payload.stream).toBe(true)
    expect(payload.options.think).toBe(false)
    expect(payload.messages[0].role).toBe('system')
    expect(payload.messages[1].content).toContain('Master')
  })

  it('still validates regular chat payloads', async () => {
    const request = {
      json: async () => ({ model: 'qwen3.5:9b' }),
    }

    const response = await POST(request)
    expect(response.status).toBe(400)

    const payload = await response.json()
    expect(payload.error).toBe('Invalid messages')
  })
})
