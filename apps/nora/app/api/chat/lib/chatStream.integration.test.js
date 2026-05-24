import { afterAll, afterEach, describe, expect, it, jest } from '@jest/globals'
import { ReadableStream as NodeReadableStream } from 'node:stream/web'
import { TextDecoder as NodeTextDecoder, TextEncoder as NodeTextEncoder } from 'node:util'

import {
  buildVerificationReport,
  buildVerificationSystemMessage,
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
// Force-assign for streamResponse usage (jsdom version may not be a usable constructor)
global.ReadableStream = NodeReadableStream
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

  // NOTE: Keyword-based requiresFactVerification test removed. All intent
  // classification now uses the LLM classifier (classifyIntent in lib/intent.js)
  // which performs semantic understanding instead of regex/keyword matching.

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
    // forceRequired: true simulates what the orchestrator does when classifyIntent
    // determines this prompt needs web search (LLM-based, not keyword matching).
    const report = buildVerificationReport('what happened to charlie kirk', sources, { forceRequired: true })

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

    // The key test: verify that sources from search are collected and used.
    // forceRequired: true simulates what the orchestrator does when classifyIntent
    // determines this prompt needs web search (LLM-based, not keyword matching).
    const sources = searchResults.map((r) => r.url)
    const report = buildVerificationReport('what happened to charlie kirk', sources, { forceRequired: true })
    const message = buildVerificationSystemMessage(report, 'what happened to charlie kirk', sources)

    expect(sources).toContain('https://reuters.com/charlie-kirk')
    expect(sources).toContain('https://bbc.com/charlie-kirk')
    expect(report.required).toBe(true)
    expect(message).toContain('reuters.com')
    expect(message).toContain('bbc.com')
    expect(message).toContain('AVAILABLE SOURCES')
  })

  it('builds verification report with official sources as verified', () => {
    // forceRequired: true simulates what the orchestrator does when classifyIntent
    // determines this prompt needs web search (LLM-based, not keyword matching).
    const sources = ['https://www.whitehouse.gov/administration/president-donald-j-trump/']
    const report = buildVerificationReport('who is the current US president?', sources, { forceRequired: true })

    expect(report.required).toBe(true)
    expect(report.status).toBe('verified')
    expect(report.highConfidenceSourceCount).toBe(1)
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

  it('forceRequired option overrides prompts that LLM classifier marked as needing verification', () => {
    // NOTE: All intent classification now uses the LLM classifier (classifyIntent in lib/intent.js)
    // which performs semantic understanding instead of regex/keyword matching.
    // forceRequired is set by the orchestrator when classifyIntent determines search is needed.
    const userMessage = 'what happed to charlie kirk'

    const sources = ['https://reuters.com/article', 'https://bbc.com/story']
    const report = buildVerificationReport(userMessage, sources, { forceRequired: true })

    expect(report.required).toBe(true)
    expect(['verified', 'weak', 'low_confidence', 'unverified']).toContain(report.status)
  })
})

// =====================================================================
// Real end-to-end flow integration: simulates the full chat stream from
// user prompt through orchestrator-forced verification, parallel web
// search, and final answer with citations. NO real LLM or network calls
// — all external I/O is mocked. This test would FAIL with prior bugs:
//   - first LLM planning pass running before verification (~30s wait)
//   - assessVerificationNeed LLM call running before searches (~30s wait)
//   - verification not forced when local regex misses the query
//   - 'Thinking…' never advancing because LLM was blocking
// Test must complete well under 5 seconds (no real LLM latency tolerated).
// =====================================================================

describe('Full chat flow integration (orchestrator forced verification)', () => {
  const originalFetch = global.fetch
  const originalEnv = process.env.NODE_ENV
  const originalReadableStream = global.ReadableStream
  const originalResponseClass = global.Response

  beforeAll(() => {
    // jsdom's ReadableStream/Response are not usable constructors here; force Node's.
    global.ReadableStream = NodeReadableStream
    global.TextEncoder = NodeTextEncoder
    global.TextDecoder = NodeTextDecoder
    global.Response = class IntegrationMockResponse {
      constructor(body, init) {
        this.body = body
        this.init = init
      }
      async text() {
        if (!this.body) return ''
        const reader = this.body.getReader()
        const decoder = new NodeTextDecoder()
        let out = ''
        while (true) {
          const { done, value } = await reader.read()
          if (done) break
          out += decoder.decode(value)
        }
        return out
      }
    }
  })

  afterAll(() => {
    global.ReadableStream = originalReadableStream
    global.Response = originalResponseClass
  })

  beforeEach(() => {
    process.env.NODE_ENV = 'test' // forces orchestratorClient to use buildFallbackPlan(requireVerification:true)
  })

  afterEach(() => {
    global.fetch = originalFetch
    process.env.NODE_ENV = originalEnv
    delete process.env.TEST_FALLBACK_ROUTE
    jest.clearAllMocks()
  })

  async function readStreamText(response) {
    if (response.text) return response.text()
    const reader = response.body.getReader()
    const decoder = new NodeTextDecoder()
    let out = ''
    while (true) {
      const { done, value } = await reader.read()
      if (done) break
      out += decoder.decode(value)
    }
    return out
  }

  function parseSseEvents(text) {
    return text
      .split('\n\n')
      .map((chunk) => chunk.replace(/^data:\s*/, '').trim())
      .filter(Boolean)
      .filter((s) => s !== '[DONE]')
      .map((s) => {
        try {
          return JSON.parse(s)
        } catch {
          return null
        }
      })
      .filter(Boolean)
  }

  function makeMockFetch({ ddgJson, ddgHtml, ollamaFinalAnswer, ollamaPlanning } = {}) {
    let ollamaCallCount = 0
    const calls = { ollama: 0, ddgJson: 0, ddgHtml: 0, readWebpage: 0 }

    const mock = jest.fn(async (url, init) => {
      const u = String(url)
      if (u === 'http://grove:11434/api/chat') {
        ollamaCallCount += 1
        calls.ollama = ollamaCallCount
        const body = JSON.parse(init?.body || '{}')
        // Streaming final answer call (no `tools`, has stream=undefined → streamFinalAnswer uses streaming).
        const isStreaming = !body.tools
        if (isStreaming) {
          const encoder = new NodeTextEncoder()
          const content = ollamaFinalAnswer || 'Charlie Kirk was a political activist who was assassinated in September 2025 [Source: Reuters]. He co-founded Turning Point USA in 2012 [Source: BBC News].'
          const chunk = encoder.encode(JSON.stringify({ message: { role: 'assistant', content } }) + '\n')
          // streamFinalAnswer uses `for await (const chunk of upstream.body)`
          async function* bodyIterator() {
            yield chunk
          }
          return { ok: true, body: bodyIterator() }
        }
        // Non-streaming planning calls — return whatever caller specified.
        return {
          ok: true,
          async json() {
            return ollamaPlanning || { message: { role: 'assistant', content: '', tool_calls: [] } }
          },
        }
      }

      if (u.startsWith('https://api.duckduckgo.com/')) {
        calls.ddgJson += 1
        return {
          ok: true,
          async json() {
            return ddgJson || {
              AbstractURL: 'https://www.reuters.com/world/us/charlie-kirk-shot',
              Heading: 'Charlie Kirk shot at Utah Valley University',
              AbstractText: 'Charlie Kirk was fatally shot at UVU on September 10, 2025.',
              RelatedTopics: [
                { FirstURL: 'https://www.bbc.com/news/charlie-kirk', Text: 'BBC coverage of the Charlie Kirk shooting' },
                { FirstURL: 'https://apnews.com/charlie-kirk-shooting', Text: 'AP News on Charlie Kirk' },
              ],
            }
          },
        }
      }

      if (u.startsWith('https://html.duckduckgo.com/')) {
        calls.ddgHtml += 1
        return {
          ok: true,
          async text() {
            return ddgHtml || `
              <div class="result results_links results_links_deep web-result">
                <a class="result__a" href="https://www.reuters.com/world/us/charlie-kirk-shot">Charlie Kirk shot</a>
                <a class="result__snippet">Reuters report</a>
              </div>
              <div class="result results_links results_links_deep web-result">
                <a class="result__a" href="https://www.bbc.com/news/charlie-kirk">BBC coverage</a>
                <a class="result__snippet">BBC News</a>
              </div>
            `
          },
        }
      }

      // readWebpage on a real URL
      calls.readWebpage += 1
      return {
        ok: true,
        async text() {
          return '<html><head><title>Mock page</title></head><body>Charlie Kirk was killed at UVU in September 2025.</body></html>'
        },
      }
    })

    global.fetch = mock
    return { mock, calls: () => calls }
  }

  it('completes full flow end-to-end with citations within 5 seconds (typo query)', async () => {
    const orig = process.env.TEST_FALLBACK_ROUTE
    process.env.TEST_FALLBACK_ROUTE = 'factual_tool'

    makeMockFetch()

    const response = streamResponse('gemma4:26b', [
      { role: 'user', content: 'what happed to charlie kirk' }, // typo defeats local regex
    ])

    const start = Date.now()
    const text = await readStreamText(response)
    const elapsed = Date.now() - start

    expect(elapsed).toBeLessThan(5000) // would have been 60s+ with old code

    const events = parseSseEvents(text)

    // 1. Orchestrator routed it to factual_tool (test mode fallback returns this)
    const orch = events.find((e) => e.orchestration)
    expect(orch?.orchestration?.route).toBe('factual_tool')

    // 2. Verification ran (status update emitted)
    const statuses = events.filter((e) => typeof e.status === 'string').map((e) => e.status)
    expect(statuses.some((s) => /Verifying|Searching|Reading|Researching/i.test(String(s)))).toBe(true)

    // 3. Web search produced sources
    const sourcesEvent = events.find((e) => Array.isArray(e.sources))
    expect(sourcesEvent).toBeDefined()
    expect(sourcesEvent.sources.length).toBeGreaterThanOrEqual(1)

    // 4. Verification report emitted with required: true (forced by orchestrator even though
    //    the typo defeats keyword-based regex heuristics)
    const verificationEvent = events.find((e) => e.verification)
    expect(verificationEvent).toBeDefined()
    expect(verificationEvent.verification.required).toBe(true)

    // 5. Final answer streamed with citations
    expect(text).toMatch(/\[Source:|per /)
    expect(text).toContain('Reuters')

    process.env.TEST_FALLBACK_ROUTE = orig
  }, 15000)

  it('completes full flow with proper citations for "what happened to" query', async () => {
    process.env.TEST_FALLBACK_ROUTE = 'factual_tool'

    makeMockFetch()

    const response = streamResponse('gemma4:26b', [
      { role: 'user', content: 'what happened to charlie kirk?' },
    ])

    const start = Date.now()
    const text = await readStreamText(response)
    const elapsed = Date.now() - start

    expect(elapsed).toBeLessThan(5000)

    const events = parseSseEvents(text)
    const verificationEvent = events.find((e) => e.verification)
    expect(verificationEvent?.verification?.required).toBe(true)

    const sourcesEvent = events.find((e) => Array.isArray(e.sources))
    expect(sourcesEvent?.sources?.length).toBeGreaterThanOrEqual(1)

    expect(text).toMatch(/\[Source:|per /)
  }, 15000)

  it('does not call the slow firstPass planning LLM when verification is forced', async () => {
    const orig = process.env.TEST_FALLBACK_ROUTE
    process.env.TEST_FALLBACK_ROUTE = 'factual_tool'

    const { mock } = makeMockFetch()

    const response = streamResponse('gemma4:26b', [
      { role: 'user', content: 'what happened to charlie kirk?' },
    ])

    await readStreamText(response)

    // Count Ollama calls: should ONLY be the final-answer streaming call
    // (NOT the firstPass planning call AND NOT assessVerificationNeed).
    const ollamaCalls = mock.mock.calls.filter(([url]) => String(url) === 'http://grove:11434/api/chat')
    // Final answer + maybe 1 verification re-plan if status not 'verified' on first try.
    // Critical: must NOT include the obsolete firstPass + assessVerificationNeed pair.
    expect(ollamaCalls.length).toBeLessThanOrEqual(2)

    process.env.TEST_FALLBACK_ROUTE = orig
  }, 15000)

  it('emits status updates promptly (no long Thinking… stall)', async () => {
    process.env.TEST_FALLBACK_ROUTE = 'factual_tool'

    makeMockFetch()

    const response = streamResponse('gemma4:26b', [
      { role: 'user', content: 'what happened to charlie kirk?' },
    ])

    const text = await readStreamText(response)
    const events = parseSseEvents(text)

    // Status sequence should include the verification phase, not stall on "Thinking…"
    const statuses = events.filter((e) => 'status' in e).map((e) => e.status)
    const verifyingIdx = statuses.findIndex((s) => /Verifying/i.test(String(s)))
    expect(verifyingIdx).toBeGreaterThanOrEqual(0)

    delete process.env.TEST_FALLBACK_ROUTE
  }, 15000)
})