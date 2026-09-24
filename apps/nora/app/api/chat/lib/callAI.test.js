import { afterEach, describe, expect, it, jest } from '@jest/globals'
import { ReadableStream as NodeReadableStream } from 'node:stream/web'
import { TextDecoder as NodeTextDecoder, TextEncoder as NodeTextEncoder } from 'node:util'

if (!global.TextEncoder) global.TextEncoder = NodeTextEncoder
if (!global.TextDecoder) global.TextDecoder = NodeTextDecoder
if (!global.ReadableStream) global.ReadableStream = NodeReadableStream
if (!global.fetch) global.fetch = jest.fn()
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

async function readStreamAsText(stream) {
  const decoder = new NodeTextDecoder()
  let text = ''
  for await (const chunk of stream) {
    text += decoder.decode(chunk, { stream: true })
  }
  return text
}

describe('callAI', () => {
  const originalBaseUrl = process.env.LMSTUDIO_BASE_URL

  afterEach(() => {
    if (originalBaseUrl === undefined) {
      delete process.env.LMSTUDIO_BASE_URL
    } else {
      process.env.LMSTUDIO_BASE_URL = originalBaseUrl
    }
    jest.resetModules()
    jest.restoreAllMocks()
  })

  it('returns an offline stub for a non-streaming call when LMSTUDIO_BASE_URL is unset', async () => {
    delete process.env.LMSTUDIO_BASE_URL
    const { callAI, AI_OFFLINE_MESSAGE } = require('./callAI')

    const res = await callAI({ model: 'test-model', stream: false, messages: [] })

    expect(res.status).toBe(200)
    expect(res.headers['X-AI-Offline']).toBe('true')
    const body = await res.json()
    expect(body.message.content).toBe(AI_OFFLINE_MESSAGE)
    expect(body.done).toBe(true)
    expect(body.offline).toBe(true)
  })

  it('does not call fetch when LMSTUDIO_BASE_URL is unset', async () => {
    delete process.env.LMSTUDIO_BASE_URL
    const fetchSpy = jest.spyOn(global, 'fetch')
    const { callAI } = require('./callAI')

    await callAI({ model: 'test-model', stream: false, messages: [] })

    expect(fetchSpy).not.toHaveBeenCalled()
  })

  it('returns an offline stub stream with content, an offline flag, and a done event for a streaming call when unconfigured', async () => {
    delete process.env.LMSTUDIO_BASE_URL
    const { callAI, AI_OFFLINE_MESSAGE } = require('./callAI')

    const res = await callAI({ model: 'test-model', stream: true, messages: [] })
    const text = await readStreamAsText(res._body)

    expect(res.headers['X-AI-Offline']).toBe('true')
    expect(text).toContain(AI_OFFLINE_MESSAGE)
    expect(text).toContain('"offline":true')
    expect(text).toContain('"done":true')
    expect(text).toContain('[DONE]')
  })

  it('falls back to the offline stub when configured but unreachable, logged at error level', async () => {
    process.env.LMSTUDIO_BASE_URL = 'http://127.0.0.1:1234/v1'
    jest.spyOn(global, 'fetch').mockRejectedValue(new Error('connect ECONNREFUSED'))
    const errorSpy = jest.spyOn(console, 'error').mockImplementation(() => {})
    const { callAI, AI_OFFLINE_MESSAGE } = require('./callAI')

    const res = await callAI({ model: 'test-model', stream: false, messages: [] })

    expect(res.status).toBe(200)
    expect(res.headers['X-AI-Offline']).toBe('true')
    const body = await res.json()
    expect(body.message.content).toBe(AI_OFFLINE_MESSAGE)
    expect(body.offline).toBe(true)
    expect(errorSpy).toHaveBeenCalled()
  })

  it('passes through the real response when configured and reachable', async () => {
    process.env.LMSTUDIO_BASE_URL = 'http://127.0.0.1:1234/v1'
    jest.spyOn(global, 'fetch').mockResolvedValue({
      ok: true,
      status: 200,
      clone() {
        return this
      },
      async json() {
        return {
          choices: [{ message: { content: 'real answer' } }],
        }
      },
    })
    const { callAI, AI_OFFLINE_MESSAGE } = require('./callAI')

    const res = await callAI({ model: 'test-model', stream: false, messages: [] })

    expect(res.status).toBe(200)
    expect(res.headers['X-AI-Offline']).toBeUndefined()
    const body = await res.json()
    expect(body.message.content).not.toBe(AI_OFFLINE_MESSAGE)
    expect(body.message.content).toBe('real answer')
    expect(body.offline).toBeUndefined()
  })
})
