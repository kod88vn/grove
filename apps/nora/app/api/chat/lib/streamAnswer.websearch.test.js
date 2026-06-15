// Test: Web search results display but then fallback message appears
// This reproduces the bug where after web search runs successfully,
// streamFinalAnswer is called with tool results but Ollama returns only thinking (no content),
// causing the fallback message to appear.

import { afterAll, afterEach, beforeEach, describe, expect, it, jest } from '@jest/globals'
import { ReadableStream as NodeReadableStream } from 'node:stream/web'
import { TextDecoder as NodeTextDecoder, TextEncoder as NodeTextEncoder } from 'node:util'

import { streamFinalAnswer } from './streamAnswer'

class TestResponse {
  constructor(body, init = {}) {
    this.body = body
    this.status = init.status ?? 200
    this.ok = this.status >= 200 && this.status < 300
    this.headers = init.headers ?? {}
  }

  async text() {
    if (!this.body) return ''
    if (typeof this.body === 'string') return this.body

    const reader = this.body.getReader()
    const decoder = new TextDecoder()
    let result = ''

    while (true) {
      const { done, value } = await reader.read()
      if (done) break
      result += decoder.decode(value, { stream: true })
    }

    result += decoder.decode()
    return result
  }

  async json() {
    const text = await this.text()
    return JSON.parse(text)
  }
}

const originalReadableStream = global.ReadableStream
const originalResponse = global.Response
const originalTextEncoder = global.TextEncoder
const originalTextDecoder = global.TextDecoder

// Unconditionally set globals to ensure consistency with lmstudioClient.js wrapper
global.ReadableStream = NodeReadableStream
global.Response = TestResponse
global.TextDecoder = NodeTextDecoder
global.TextEncoder = NodeTextEncoder

afterEach(() => {
  jest.restoreAllMocks()
})

afterAll(() => {
  global.ReadableStream = originalReadableStream
  global.Response = originalResponse
  global.TextEncoder = originalTextEncoder
  global.TextDecoder = originalTextDecoder
})

describe('streamFinalAnswer - web search fallback bug', () => {
  let emitCalls = []
  let controllerObj

  beforeEach(() => {
    emitCalls = []
    const chunks = []
    controllerObj = {
      enqueue: jest.fn((chunk) => chunks.push(chunk)),
      close: jest.fn(),
    }

    global.fetch = jest.fn()
    // Set LMSTUDIO_BASE_URL so callAI doesn't throw before reaching our mock
    process.env.LMSTUDIO_BASE_URL = 'http://test-lmstudio:1234/v1'
  })

  afterEach(() => {
    jest.restoreAllMocks()
    delete process.env.LMSTUDIO_BASE_URL
  })

  it('should emit thinking as content when model returns only reasoning_content (no content) after web search', async () => {
    // Simulate: model returns ONLY reasoning_content, no content field at all.
    // The data format matches raw LMStudio SSE (choices[0].delta.reasoning_content).
    const encoder = new NodeTextEncoder()

    global.fetch.mockImplementation(async (url) => {
      if (url.includes('chat/completions')) {
        const stream = new NodeReadableStream({
          async start(controller) {
            // Raw LMStudio SSE format with reasoning_content in choices[0].delta
            // IMPORTANT: Each SSE event must be separated by \n\n (blank line)
            controller.enqueue(encoder.encode('data: {"id":"chatcmpl-1","object":"chat.completion.chunk","created":1000000,"model":"qwen3","choices":[{"index":0,"delta":{"role":"assistant","reasoning_content":"The capital of France is Paris. This is a well-known fact confirmed by multiple sources."},"finish_reason":null}]}\n\n'))
            controller.enqueue(encoder.encode('data: {"id":"chatcmpl-1","object":"chat.completion.chunk","created":1000001,"model":"qwen3","choices":[{"index":0,"delta":{"reasoning_content":" I will now provide the answer with proper citations."},"finish_reason":null}]}\n\n'))
            controller.enqueue(encoder.encode('data: {"id":"chatcmpl-1","object":"chat.completion.chunk","created":1000002,"model":"qwen3","choices":[{"index":0,"delta":{},"finish_reason":"stop"}]}\n\n'))
            controller.enqueue(encoder.encode('data: [DONE]\n\n'))
            controller.close()
          },
        })
        return new TestResponse(stream, { status: 200 })
      }

      throw new Error(`Unexpected fetch: ${url}`)
    })

    const followupMessages = [
      { role: 'user', content: 'What is the capital of France?' },
      { role: 'assistant', content: '', tool_calls: [{ type: 'function', function: { name: 'web_search', arguments: { query: 'capital of France' } } }] },
      { role: 'tool', tool_name: 'web_search', content: JSON.stringify({ query: 'capital of France', results: [{ title: 'France Capital', url: 'https://en.wikipedia.org/wiki/Paris', content: 'Paris is the capital of France.' }] }) },
      { role: 'system', content: 'You must cite your sources. Use [Source: Name] format.' },
    ]

    const sourceUrls = ['https://en.wikipedia.org/wiki/Paris']

    await streamFinalAnswer('qwen3.6-35b-a3b-mtp-holo3-qwopus-qx86-hi-mlx', followupMessages, sourceUrls, (obj) => {
      emitCalls.push(obj)
    }, controllerObj, encoder)

    // Debug: log all emitted events to understand what happened
    console.log('=== EMITTED EVENTS ===')
    emitCalls.forEach((c, i) => console.log(`${i}:`, JSON.stringify(c).slice(0, 200)))
    console.log('=== END EMITTED EVENTS ===')

    // Check that we got actual content (from thinking promotion), NOT the fallback message
    const emittedWords = emitCalls.filter(c => c.word).map(c => c.word)
    console.log('EMITTED WORDS:', emittedWords)
    const hasFallback = emittedWords.some(w => w.includes("wasn't able to generate"))
    const hasContent = emittedWords.some(w => w.toLowerCase().includes('paris'))

    expect(hasFallback).toBe(false)
    expect(hasContent).toBe(true)
  })

  it('should emit short thinking as content when reasoning_content is less than 15 chars but valid', async () => {
    const encoder = new NodeTextEncoder()

    global.fetch.mockImplementation(async (url) => {
      if (url.includes('chat/completions')) {
        const stream = new NodeReadableStream({
          async start(controller) {
            // Short reasoning_content (less than 15 chars) that is still valid content
            controller.enqueue(encoder.encode('data: {"id":"chatcmpl-2","object":"chat.completion.chunk","created":1000000,"model":"qwen3","choices":[{"index":0,"delta":{"role":"assistant","reasoning_content":"It is 42."},"finish_reason":null}]}\n\n'))
            controller.enqueue(encoder.encode('data: {"id":"chatcmpl-2","object":"chat.completion.chunk","created":1000001,"model":"qwen3","choices":[{"index":0,"delta":{},"finish_reason":"stop"}]}\n\n'))
            controller.enqueue(encoder.encode('data: [DONE]\n\n'))
            controller.close()
          },
        })
        return new TestResponse(stream, { status: 200 })
      }
      throw new Error(`Unexpected fetch: ${url}`)
    })

    const followupMessages = [
      { role: 'user', content: 'What is 6 times 7?' },
    ]

    await streamFinalAnswer('qwen3.6-35b-a3b-mtp-holo3-qwopus-qx86-hi-mlx', followupMessages, [], (obj) => {
      emitCalls.push(obj)
    }, controllerObj, encoder)

    const emittedWords = emitCalls.filter(c => c.word).map(c => c.word)
    const hasFallback = emittedWords.some(w => w.includes("wasn't able to generate"))
    const hasContent = emittedWords.some(w => w.includes('42'))

    expect(hasFallback).toBe(false)
    expect(hasContent).toBe(true)
  })

  it('should emit fallback only when response is truly empty', async () => {
    const encoder = new NodeTextEncoder()

    global.fetch.mockImplementation(async (url) => {
      if (url.includes('chat/completions')) {
        const stream = new NodeReadableStream({
          async start(controller) {
            // Empty response - no content, no reasoning_content
            controller.enqueue(encoder.encode('data: {"id":"chatcmpl-3","object":"chat.completion.chunk","created":1000000,"model":"qwen3","choices":[{"index":0,"delta":{"role":"assistant"},"finish_reason":null}]}\n\n'))
            controller.enqueue(encoder.encode('data: {"id":"chatcmpl-3","object":"chat.completion.chunk","created":1000001,"model":"qwen3","choices":[{"index":0,"delta":{},"finish_reason":"stop"}]}\n\n'))
            controller.enqueue(encoder.encode('data: [DONE]\n\n'))
            controller.close()
          },
        })
        return new TestResponse(stream, { status: 200 })
      }
      throw new Error(`Unexpected fetch: ${url}`)
    })

    const followupMessages = [
      { role: 'user', content: 'Hello' },
    ]

    await streamFinalAnswer('qwen3.6-35b-a3b-mtp-holo3-qwopus-qx86-hi-mlx', followupMessages, [], (obj) => {
      emitCalls.push(obj)
    }, controllerObj, encoder)

    const emittedWords = emitCalls.filter(c => c.word).map(c => c.word)
    const hasFallback = emittedWords.some(w => w.includes("wasn't able to generate"))

    expect(hasFallback).toBe(true)
  })
})

// NEW: Integration test using callAI directly (like wrapperDebug.test.js)
describe('streamFinalAnswer - integration with callAI', () => {
  let emitCalls = []
  let controllerObj

  beforeEach(() => {
    emitCalls = []
    const chunks = []
    controllerObj = {
      enqueue: jest.fn((chunk) => chunks.push(chunk)),
      close: jest.fn(),
    }

    global.fetch = jest.fn()
    process.env.LMSTUDIO_BASE_URL = 'http://test-lmstudio:1234/v1'
  })

  afterEach(() => {
    jest.restoreAllMocks()
    delete process.env.LMSTUDIO_BASE_URL
  })

  it('should emit thinking as content when model returns only reasoning_content (integration test)', async () => {
    const encoder = new NodeTextEncoder()

    global.fetch.mockImplementation(async (url) => {
      if (url.includes('chat/completions')) {
        const stream = new NodeReadableStream({
          async start(controller) {
            // IMPORTANT: Each SSE event must be separated by \n\n (blank line)
            controller.enqueue(encoder.encode('data: {"id":"chatcmpl-1","object":"chat.completion.chunk","created":1000000,"model":"qwen3","choices":[{"index":0,"delta":{"role":"assistant","reasoning_content":"The capital of France is Paris. This is a well-known fact confirmed by multiple sources."},"finish_reason":null}]}\n\n'))
            controller.enqueue(encoder.encode('data: {"id":"chatcmpl-1","object":"chat.completion.chunk","created":1000001,"model":"qwen3","choices":[{"index":0,"delta":{"reasoning_content":" I will now provide the answer with proper citations."},"finish_reason":null}]}\n\n'))
            controller.enqueue(encoder.encode('data: {"id":"chatcmpl-1","object":"chat.completion.chunk","created":1000002,"model":"qwen3","choices":[{"index":0,"delta":{},"finish_reason":"stop"}]}\n\n'))
            controller.enqueue(encoder.encode('data: [DONE]\n\n'))
            controller.close()
          },
        })
        return new TestResponse(stream, { status: 200 })
      }

      throw new Error(`Unexpected fetch: ${url}`)
    })

    const followupMessages = [
      { role: 'user', content: 'What is the capital of France?' },
      { role: 'assistant', content: '', tool_calls: [{ type: 'function', function: { name: 'web_search', arguments: { query: 'capital of France' } } }] },
      { role: 'tool', tool_name: 'web_search', content: JSON.stringify({ query: 'capital of France', results: [{ title: 'France Capital', url: 'https://en.wikipedia.org/wiki/Paris', content: 'Paris is the capital of France.' }] }) },
      { role: 'system', content: 'You must cite your sources. Use [Source: Name] format.' },
    ]

    const sourceUrls = ['https://en.wikipedia.org/wiki/Paris']

    await streamFinalAnswer('qwen3.6-35b-a3b-mtp-holo3-qwopus-qx86-hi-mlx', followupMessages, sourceUrls, (obj) => {
      emitCalls.push(obj)
    }, controllerObj, encoder)

    // Debug: log all emitted events to understand what happened
    console.log('=== EMITTED EVENTS ===')
    emitCalls.forEach((c, i) => console.log(`${i}:`, JSON.stringify(c).slice(0, 200)))
    console.log('=== END EMITTED EVENTS ===')

    // Check that we got actual content (from thinking promotion), NOT the fallback message
    const emittedWords = emitCalls.filter(c => c.word).map(c => c.word)
    console.log('EMITTED WORDS:', emittedWords)
    const hasFallback = emittedWords.some(w => w.includes("wasn't able to generate"))
    const hasContent = emittedWords.some(w => w.toLowerCase().includes('paris'))

    expect(hasFallback).toBe(false)
    expect(hasContent).toBe(true)
  })

  it('should emit short thinking as content when reasoning_content is less than 15 chars but valid', async () => {
    const encoder = new NodeTextEncoder()

    global.fetch.mockImplementation(async (url) => {
      if (url.includes('chat/completions')) {
        const stream = new NodeReadableStream({
          async start(controller) {
            // Short reasoning_content (less than 15 chars) that is still valid content
            controller.enqueue(encoder.encode('data: {"id":"chatcmpl-2","object":"chat.completion.chunk","created":1000000,"model":"qwen3","choices":[{"index":0,"delta":{"role":"assistant","reasoning_content":"It is 42."},"finish_reason":null}]}\n\n'))
            controller.enqueue(encoder.encode('data: {"id":"chatcmpl-2","object":"chat.completion.chunk","created":1000001,"model":"qwen3","choices":[{"index":0,"delta":{},"finish_reason":"stop"}]}\n\n'))
            controller.enqueue(encoder.encode('data: [DONE]\n\n'))
            controller.close()
          },
        })
        return new TestResponse(stream, { status: 200 })
      }
      throw new Error(`Unexpected fetch: ${url}`)
    })

    const followupMessages = [
      { role: 'user', content: 'What is 6 times 7?' },
    ]

    await streamFinalAnswer('qwen3.6-35b-a3b-mtp-holo3-qwopus-qx86-hi-mlx', followupMessages, [], (obj) => {
      emitCalls.push(obj)
    }, controllerObj, encoder)

    const emittedWords = emitCalls.filter(c => c.word).map(c => c.word)
    const hasFallback = emittedWords.some(w => w.includes("wasn't able to generate"))
    const hasContent = emittedWords.some(w => w.includes('42'))

    expect(hasFallback).toBe(false)
    expect(hasContent).toBe(true)
  })

  it('should emit fallback only when response is truly empty', async () => {
    const encoder = new NodeTextEncoder()

    global.fetch.mockImplementation(async (url) => {
      if (url.includes('chat/completions')) {
        const stream = new NodeReadableStream({
          async start(controller) {
            // Empty response - no content, no reasoning_content
            controller.enqueue(encoder.encode('data: {"id":"chatcmpl-3","object":"chat.completion.chunk","created":1000000,"model":"qwen3","choices":[{"index":0,"delta":{"role":"assistant"},"finish_reason":null}]}\n\n'))
            controller.enqueue(encoder.encode('data: {"id":"chatcmpl-3","object":"chat.completion.chunk","created":1000001,"model":"qwen3","choices":[{"index":0,"delta":{},"finish_reason":"stop"}]}\n\n'))
            controller.enqueue(encoder.encode('data: [DONE]\n\n'))
            controller.close()
          },
        })
        return new TestResponse(stream, { status: 200 })
      }
      throw new Error(`Unexpected fetch: ${url}`)
    })

    const followupMessages = [
      { role: 'user', content: 'Hello' },
    ]

    await streamFinalAnswer('qwen3.6-35b-a3b-mtp-holo3-qwopus-qx86-hi-mlx', followupMessages, [], (obj) => {
      emitCalls.push(obj)
    }, controllerObj, encoder)

    const emittedWords = emitCalls.filter(c => c.word).map(c => c.word)
    const hasFallback = emittedWords.some(w => w.includes("wasn't able to generate"))

    expect(hasFallback).toBe(true)
  })
})
