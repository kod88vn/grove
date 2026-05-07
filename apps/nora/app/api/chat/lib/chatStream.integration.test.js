import { afterAll, afterEach, describe, expect, it, jest } from '@jest/globals'
import { ReadableStream as NodeReadableStream } from 'node:stream/web'
import { TextDecoder as NodeTextDecoder, TextEncoder as NodeTextEncoder } from 'node:util'

import {
  buildVerificationReport,
  buildVerificationSystemMessage,
  requiresFactVerification,
  streamResponse,
} from './chatStream'

// Polyfills
const originalReadableStream = global.ReadableStream
const originalResponse = global.Response
const originalTextEncoder = global.TextEncoder
const originalTextDecoder = global.TextDecoder

if (!global.ReadableStream) {
  global.ReadableStream = NodeReadableStream
}
if (!global.Response) {
  global.Response = class MockResponse {
    constructor(body) {
      this.body = body
    }
    async text() {
      const reader = this.body.getReader()
      const decoder = new TextDecoder()
      let result = ''
      while (true) {
        const { done, value } = await reader.read()
        if (done) break
        result += decoder.decode(value)
      }
      return result
    }
  }
}
if (!global.TextEncoder) {
  global.TextEncoder = NodeTextEncoder
}
if (!global.TextDecoder) {
  global.TextDecoder = NodeTextDecoder
}

describe('Source Citation Integration', () => {
  afterEach(() => {
    jest.clearAllMocks()
  })

  afterAll(() => {
    global.ReadableStream = originalReadableStream
    global.Response = originalResponse
    global.TextEncoder = originalTextEncoder
    global.TextDecoder = originalTextDecoder
  })

  it('recognizes "what happened" questions as requiring verification', () => {
    const result = requiresFactVerification('what happened to charlie kirk')
    expect(result).toBe(true)
  })

  it('builds verification system message with available sources', () => {
    const report = {
      required: true,
      status: 'verified',
      sourceCount: 3,
    }
    const sources = ['https://reuters.com/article1', 'https://bbc.com/news2', 'https://apnews.com/story3']
    const message = buildVerificationSystemMessage(report, 'what happened to charlie kirk', sources)

    expect(message).toContain('CRITICAL')
    expect(message).toContain('MUST cite sources')
    expect(message).toContain('[Source: Name]')
    expect(message).toContain('reuters.com')
    expect(message).toContain('bbc.com')
    expect(message).toContain('apnews.com')
  })

  it('builds verification report with source counts from real sources', () => {
    const sources = ['https://reuters.com', 'https://bbc.com', 'https://apnews.com']
    const report = buildVerificationReport('what happened to charlie kirk', sources)

    expect(report.required).toBe(true)
    expect(report.sourceCount).toBeGreaterThanOrEqual(1)
    expect(['verified', 'weak', 'low_confidence', 'unverified']).toContain(report.status)
  })

  it('sources flow through verification and system message', () => {
    // Simulate web search results
    const searchResults = [
      { title: 'Charlie Kirk News', url: 'https://reuters.com/charlie-kirk', snippet: 'Recent news about Kirk' },
      { title: 'Update', url: 'https://bbc.com/charlie-kirk', snippet: 'Another source' },
    ]

    // The key test: verify that sources from search are collected and used
    const sources = searchResults.map((r) => r.url)
    const report = buildVerificationReport('what happened to charlie kirk', sources)
    const message = buildVerificationSystemMessage(report, 'what happened to charlie kirk', sources)

    expect(sources).toContain('https://reuters.com/charlie-kirk')
    expect(sources).toContain('https://bbc.com/charlie-kirk')
    expect(report.required).toBe(true)
    
    // Verify system message includes the sources
    expect(message).toContain('reuters.com')
    expect(message).toContain('bbc.com')
    expect(message).toContain('AVAILABLE SOURCES')
  })

  it('source list in verification message is numbered', () => {
    const sources = ['https://source1.com', 'https://source2.com', 'https://source3.com']
    const report = {
      required: true,
      status: 'verified',
    }

    const message = buildVerificationSystemMessage(report, 'test', sources)

    // Verify numbered list format
    expect(message).toMatch(/1\. https:\/\/source1\.com/)
    expect(message).toMatch(/2\. https:\/\/source2\.com/)
    expect(message).toMatch(/3\. https:\/\/source3\.com/)
  })

  it('verifies system message contains at least 2 sources when available', () => {
    const sources = ['https://source1.com', 'https://source2.com', 'https://source3.com']
    const report = {
      required: true,
      status: 'verified',
      sourceCount: sources.length,
    }

    const message = buildVerificationSystemMessage(report, 'test query', sources)

    // Verify all sources are in the message
    sources.slice(0, 5).forEach((url) => {
      expect(message).toContain(url)
    })

    // Verify format includes citation instruction
    expect(message).toMatch(/\[Source:|per /)
  })

  it('includes source list in AVAILABLE SOURCES section', () => {
    const sources = ['https://reuters.com', 'https://bbc.com', 'https://apnews.com']
    const report = {
      required: true,
      status: 'verified',
    }

    const message = buildVerificationSystemMessage(report, 'test', sources)

    expect(message).toContain('AVAILABLE SOURCES:')
    expect(message).toContain('1. https://reuters.com')
    expect(message).toContain('2. https://bbc.com')
    expect(message).toContain('3. https://apnews.com')
  })
})
