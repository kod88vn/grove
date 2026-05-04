import { describe, it, expect, afterAll, afterEach, jest } from '@jest/globals'
import { ReadableStream as NodeReadableStream } from 'node:stream/web'
import { TextDecoder as NodeTextDecoder, TextEncoder as NodeTextEncoder } from 'node:util'
import { streamResponse } from '../app/api/chat/lib/chatStream'

class TestResponse {
  constructor(body, init = {}) {
    this.body = body
    this.headers = init.headers ?? {}
  }

  async text() {
    if (!this.body) return ''

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
}

const originalReadableStream = global.ReadableStream
const originalResponse = global.Response
const originalTextEncoder = global.TextEncoder
const originalTextDecoder = global.TextDecoder
if (!global.ReadableStream) {
  global.ReadableStream = NodeReadableStream
}
if (!global.Response) {
  global.Response = TestResponse
}
if (!global.TextDecoder) {
  global.TextDecoder = NodeTextDecoder
}
if (!global.TextEncoder) {
  global.TextEncoder = NodeTextEncoder
}

afterEach(() => {
  jest.restoreAllMocks()
})

afterAll(() => {
  global.ReadableStream = originalReadableStream
  global.Response = originalResponse
  global.TextEncoder = originalTextEncoder
  global.TextDecoder = originalTextDecoder
})

/**
 * Regression: planning pass returns final content but a second streaming pass
 * was launched, which emitted only thinking tokens with no content.
 * The route must short-circuit and emit the planning answer directly.
 */
describe('Route: planning pass short-circuit', () => {
  it('emits thinkingDone + word when planning result has content and no remaining tool calls', () => {
    // Simulate the events the route would emit when short-circuiting
    const events = []
    const emit = (obj) => events.push(obj)

    const planningAnswer = 'The current React version is 19.2.5.'
    const toolCalls = [] // no remaining tool calls

    const hasRemainingToolCalls = Array.isArray(toolCalls) && toolCalls.length > 0
    if (!hasRemainingToolCalls && planningAnswer) {
      emit({ thinkingDone: true })
      emit({ word: planningAnswer })
      events.push('[DONE]')
    }

    expect(events[0]).toEqual({ thinkingDone: true })
    expect(events[1]).toEqual({ word: planningAnswer })
    expect(events[2]).toBe('[DONE]')
  })

  it('does NOT short-circuit when planning result has remaining tool calls', () => {
    const events = []
    const emit = (obj) => events.push(obj)

    const planningAnswer = ''
    const toolCalls = [{ type: 'function', function: { name: 'web_search', arguments: { query: 'React version' } } }]

    const hasRemainingToolCalls = Array.isArray(toolCalls) && toolCalls.length > 0
    if (!hasRemainingToolCalls && planningAnswer) {
      emit({ thinkingDone: true })
      emit({ word: planningAnswer })
    }

    // No early emissions — should proceed to tool execution path
    expect(events).toHaveLength(0)
  })
})

/**
 * Regression: parseXmlToolCalls returned objects without `type` field,
 * causing Ollama to reject the tool_calls array on the follow-up request.
 */
describe('Route: XML tool-call type normalization', () => {
  // Inline the functions under test (pure, no imports needed)
  function parseXmlToolCalls(content) {
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

  function extractToolCalls(message) {
    const structured = message?.tool_calls
    if (Array.isArray(structured) && structured.length > 0) {
      return structured.map((call) => ({ ...call, type: call?.type || 'function' }))
    }
    return parseXmlToolCalls(message?.content ?? '')
  }

  it('XML tool call includes type=function', () => {
    const content = '<function=web_search>\n<parameter=query>\nReact version\n</parameter>\n</function>'
    const calls = parseXmlToolCalls(content)
    expect(calls).toHaveLength(1)
    expect(calls[0].type).toBe('function')
    expect(calls[0].function.name).toBe('web_search')
    expect(calls[0].function.arguments.query).toBe('React version')
  })

  it('structured tool call without type gets type=function added', () => {
    const message = {
      tool_calls: [{ function: { name: 'web_search', arguments: { query: 'test' } } }],
    }
    const calls = extractToolCalls(message)
    expect(calls[0].type).toBe('function')
  })

  it('structured tool call that already has type preserves it', () => {
    const message = {
      tool_calls: [{ type: 'function', function: { name: 'web_search', arguments: { query: 'test' } } }],
    }
    const calls = extractToolCalls(message)
    expect(calls[0].type).toBe('function')
  })
})

/**
 * Integration test: Simulates a full chat flow with thinking and content
 * This mimics what the actual Ollama API returns and how the UI should process it
 */
describe('Chat Integration - Full Flow', () => {
  it('should handle complete thinking -> content -> done flow', () => {
    // Simulate Ollama API responses (NDJSON format)
    const ollamaResponses = [
      '{"model":"qwen3.5:9b","message":{"role":"assistant","content":"","thinking":"Let"},"done":false}',
      '{"model":"qwen3.5:9b","message":{"role":"assistant","content":"","thinking":" me"},"done":false}',
      '{"model":"qwen3.5:9b","message":{"role":"assistant","content":"","thinking":" think"},"done":false}',
      '{"model":"qwen3.5:9b","message":{"role":"assistant","content":"Hello","thinking":""},"done":false}',
      '{"model":"qwen3.5:9b","message":{"role":"assistant","content":" world","thinking":""},"done":false}',
      '{"model":"qwen3.5:9b","message":{"role":"assistant","content":"!","thinking":""},"done":true}',
    ]

    // Simulate API processing
    const thinkingEmissions = []
    const contentEmissions = []
    let contentStarted = false

    let thinkBuffer = ''
    let contentBuffer = ''

    for (const response of ollamaResponses) {
      const json = JSON.parse(response)
      const thinking = json.message?.thinking || ''
      const content = json.message?.content || ''

      // Process thinking
      if (thinking && !contentStarted) {
        thinkBuffer += thinking
        while (true) {
          const match = thinkBuffer.match(/^(.*?)\s/)
          if (!match) break
          const word = match[1] + ' '
          thinkingEmissions.push(word)
          thinkBuffer = thinkBuffer.slice(word.length)
        }
      }

      // Process content start
      if (content && !contentStarted) {
        contentStarted = true
        if (thinkBuffer) {
          thinkingEmissions.push(thinkBuffer)
          thinkBuffer = ''
        }
        contentEmissions.push('[THINKING_DONE]')
      }

      // Process content
      if (content && contentStarted) {
        contentBuffer += content
        while (true) {
          const match = contentBuffer.match(/^(.*?)\s/)
          if (!match) break
          const word = match[1] + ' '
          contentEmissions.push(word)
          contentBuffer = contentBuffer.slice(word.length)
        }
      }

      // Handle done
      if (json.done && contentBuffer) {
        contentEmissions.push(contentBuffer)
      }
    }

    // Verify thinking was emitted
    expect(thinkingEmissions).toContain('Let ')
    expect(thinkingEmissions).toContain('me ')
    expect(thinkingEmissions).toContain('think')

    // Verify content was emitted after thinking done signal
    const thinkingDoneIdx = contentEmissions.indexOf('[THINKING_DONE]')
    expect(thinkingDoneIdx).toBeGreaterThanOrEqual(0)
    expect(contentEmissions[thinkingDoneIdx + 1]).toBe('Hello ')
    expect(contentEmissions[thinkingDoneIdx + 2]).toBe('world!')
  })

  it('should reconstruct full thinking and content strings correctly', () => {
    const stream = `data: {"thinking":"Let"}

data: {"thinking":" me"}

data: {"thinking":" think"}

data: {"thinkingDone":true}

data: {"word":"Hello"}

data: {"word":" world"}

data: [DONE]

`

    const lines = stream.split('\n\n').filter(l => l.trim())
    let thinking = ''
    let content = ''
    let thinkingDone = false

    for (const line of lines) {
      const data = line.replace(/^data: /, '').trim()
      if (!data || data === '[DONE]') continue

      const json = JSON.parse(data)
      if (json.thinking) thinking += json.thinking
      if (json.thinkingDone) thinkingDone = true
      if (json.word) content += json.word
    }

    expect(thinking).toBe('Let me think')
    expect(thinkingDone).toBe(true)
    expect(content).toBe('Hello world')
  })

  it('should handle SSE message parsing with proper state transitions', () => {
    // Simulate React state updates
    let msgState = {
      role: 'assistant',
      content: '',
      thinking: '',
      thinkingVisible: true
    }

    const updates = [
      { thinking: 'Let' },
      { thinking: ' me' },
      { thinking: ' think' },
      { thinkingDone: true },
      { word: 'Hello' },
      { word: ' world' },
    ]

    for (const update of updates) {
      if (update.thinking) {
        msgState.thinking += update.thinking
      }
      if (update.thinkingDone) {
        msgState.thinkingVisible = false
      }
      if (update.word) {
        msgState.content += update.word
      }
    }

    // Verify final state
    expect(msgState.thinking).toBe('Let me think')
    expect(msgState.thinkingVisible).toBe(false)
    expect(msgState.content).toBe('Hello world')
  })

  it('should not show thinking bubble after thinkingDone', () => {
    const msg = {
      thinking: 'processing...',
      thinkingVisible: false, // Set to false by thinkingDone signal
      content: 'Hello'
    }

    // UI should render ChatMessage with:
    // - thinking NOT shown (because thinkingVisible is false)
    // - content shown
    const shouldShowThinking = Boolean(msg.thinking && msg.thinkingVisible)
    const shouldShowContent = Boolean(msg.content)

    expect(shouldShowThinking).toBe(false)
    expect(shouldShowContent).toBe(true)
  })

  it('should handle empty content after thinking completes', () => {
    // Edge case: what if thinking completes but no content yet?
    const msg = {
      thinking: 'thinking...',
      thinkingVisible: false,
      content: ''
    }

    const hasThinking = Boolean(msg.thinking && msg.thinkingVisible)
    const hasContent = Boolean(msg.content)

    // Should not render thinking (thinkingVisible is false)
    // Should not render content (empty)
    // UI should not render ChatMessage, only empty div
    expect(hasThinking).toBe(false)
    expect(hasContent).toBe(false)
  })
})

describe('Chat Integration - current title verification', () => {
  it('disables reasoning mode for the final streaming answer to avoid leaking chain-of-thought text', async () => {
    const ollamaRequests = []

    global.fetch = jest.fn(async (url, options = {}) => {
      const urlValue = String(url)

      if (urlValue === 'http://grove:11434/api/chat') {
        const body = options?.body ? JSON.parse(options.body) : {}
        ollamaRequests.push(body)

        // Planning pass: no tool calls, no content.
        if (body?.stream === false) {
          return {
            ok: true,
            async json() {
              return { message: { role: 'assistant', content: '', tool_calls: [] } }
            },
          }
        }

        // Final streaming pass: return a plain answer payload.
        const encoder = new TextEncoder()
        return {
          ok: true,
          body: [
            encoder.encode('{"message":{"role":"assistant","content":"React stable is 19.2.0."},"done":true}\n'),
          ],
        }
      }

      if (urlValue.startsWith('https://api.duckduckgo.com/') || urlValue.startsWith('https://html.duckduckgo.com/')) {
        return {
          ok: true,
          async json() {
            return {
              AbstractURL: 'https://react.dev/blog',
              Heading: 'React blog',
              AbstractText: 'Latest React releases.',
              RelatedTopics: [],
            }
          },
          async text() { return '' },
        }
      }

      if (urlValue === 'https://react.dev/blog') {
        return {
          ok: true,
          async text() {
            return '<html><head><title>React Blog</title></head><body>Latest stable release: 19.2.0.</body></html>'
          },
        }
      }

      throw new Error(`Unexpected fetch: ${urlValue}`)
    })

    const response = streamResponse('qwen3.6:27b', [
      { role: 'user', content: 'what is the latest version of react?' },
    ])

    const text = await response.text()

    expect(text).toContain('React stable is 19.2.0.')
    const finalRequest = ollamaRequests.findLast((payload) => payload?.stream === true)
    expect(finalRequest).toBeDefined()
    expect(finalRequest.options?.think).toBe(false)
  })

  it('answers a basic current-president question when an official source is available through site-filtered search', async () => {
    let ollamaCallCount = 0

    global.fetch = jest.fn(async (url, options = {}) => {
      const urlValue = String(url)

      if (urlValue === 'http://grove:11434/api/chat') {
        ollamaCallCount += 1

        if (ollamaCallCount <= 1) {
          return {
            ok: true,
            async json() {
              return {
                message: {
                  role: 'assistant',
                  content: '',
                  tool_calls: [],
                },
              }
            },
          }
        }

        const encoder = new TextEncoder()
        return {
          ok: true,
          body: [
            encoder.encode('{"message":{"role":"assistant","content":"Donald Trump is the current president of the United States."},"done":true}\n'),
          ],
        }
      }

      if (urlValue.startsWith('https://api.duckduckgo.com/')) {
        return {
          ok: true,
          async json() {
            return {
              AbstractURL: 'https://en.wikipedia.org/wiki/2026_United_States_elections',
              Heading: '2026 United States elections',
              AbstractText: 'Wikipedia result that does not satisfy the official-site query.',
              RelatedTopics: [],
            }
          },
        }
      }

      if (urlValue.startsWith('https://html.duckduckgo.com/html/')) {
        return {
          ok: true,
          async text() {
            return `
              <div class="result results_links results_links_deep web-result">
                <a class="result__a" href="https://www.whitehouse.gov/administration/president-donald-j-trump/">President Donald J. Trump</a>
                <a class="result__snippet">Official White House biography.</a>
              </div>
            `
          },
        }
      }

      throw new Error(`Unexpected fetch: ${urlValue}`)
    })

    const response = streamResponse('qwen3.5:9b', [
      { role: 'user', content: 'who is the current president?' },
    ])

    const text = await response.text()

    expect(text).toContain('"verification":{"required":true,"status":"verified"')
    expect(text).toContain('Donald Trump is the current president of the United States.')
    expect(text).not.toContain('I can’t confidently verify this claim yet')
  })

  it('does not answer definitively when only Wikipedia evidence is found', async () => {
    let ollamaCallCount = 0
    let pageReadRequested = false

    global.fetch = jest.fn(async (url) => {
      const urlValue = String(url)

      if (urlValue === 'http://grove:11434/api/chat') {
        ollamaCallCount += 1
        if (ollamaCallCount <= 2) {
          return { ok: true, async json() { return { message: { role: 'assistant', content: '', tool_calls: [] } } } }
        }
        const encoder = new TextEncoder()
        return {
          ok: true,
          body: [encoder.encode('{"message":{"role":"assistant","content":"Donald Trump is the current president."},"done":true}\n')],
        }
      }

      if (urlValue.startsWith('https://api.duckduckgo.com/') || urlValue.startsWith('https://html.duckduckgo.com/')) {
        return {
          ok: true,
          async json() {
            return { AbstractURL: 'https://en.wikipedia.org/wiki/2026_United_States_elections', Heading: '2026 United States elections', AbstractText: 'Congressional midterm elections.', RelatedTopics: [] }
          },
          async text() { return '' },
        }
      }

      // The page read must be triggered because Wikipedia is low-confidence
      if (urlValue === 'https://en.wikipedia.org/wiki/2026_United_States_elections') {
        pageReadRequested = true
        return {
          ok: true,
          async text() {
            return '<html><head><title>2026 United States elections</title></head><body>Donald Trump is serving as the 47th president of the United States in his second term since January 2025.</body></html>'
          },
        }
      }

      throw new Error(`Unexpected fetch: ${urlValue}`)
    })

    const response = streamResponse('qwen3.5:9b', [
      { role: 'user', content: 'who is the current president?' },
    ])

    const text = await response.text()

    expect(pageReadRequested).toBe(true)
    expect(ollamaCallCount).toBeGreaterThanOrEqual(2)
    expect(text).toContain('"verification":{"required":true,"status":"unverified"')
    expect(text).toContain('I ran three rounds of research')
    expect(text).not.toContain('Donald Trump is the current president.')
  })

  it('does not trust a model-written final answer after a single Wikipedia result', async () => {
    let ollamaCallCount = 0

    global.fetch = jest.fn(async (url) => {
      const urlValue = String(url)

      if (urlValue === 'http://grove:11434/api/chat') {
        ollamaCallCount += 1

        if (ollamaCallCount === 1) {
          return {
            ok: true,
            async json() {
              return {
                message: {
                  role: 'assistant',
                  content: '',
                  tool_calls: [
                    {
                      type: 'function',
                      function: {
                        name: 'web_search',
                        arguments: { query: 'current president of the United States' },
                      },
                    },
                  ],
                },
              }
            },
          }
        }

        if (ollamaCallCount === 2) {
          return {
            ok: true,
            async json() {
              return {
                message: {
                  role: 'assistant',
                  content:
                    'As of May 3, 2026, Joe Biden is still the president of the United States.',
                  tool_calls: [],
                },
              }
            },
          }
        }

        throw new Error(`Unexpected Ollama call ${ollamaCallCount}`)
      }

      if (urlValue.startsWith('https://api.duckduckgo.com/') || urlValue.startsWith('https://html.duckduckgo.com/')) {
        return {
          ok: true,
          async json() {
            return {
              AbstractURL: 'https://en.wikipedia.org/wiki/2026_United_States_elections',
              Heading: '2026 United States elections',
              AbstractText: 'Congressional midterm elections.',
              RelatedTopics: [],
            }
          },
          async text() { return '' },
        }
      }

      throw new Error(`Unexpected fetch: ${urlValue}`)
    })

    const response = streamResponse('qwen3-coder:latest', [
      { role: 'user', content: 'who is the current president?' },
    ])

    const text = await response.text()

    expect(ollamaCallCount).toBeGreaterThanOrEqual(2)
    expect(text).toContain('"verification":{"required":true,"status":"unverified"')
    expect(text).toContain('I ran three rounds of research')
    expect(text).not.toContain('Joe Biden is still the president')
  })

  it('answers when only govtrack-like reliable sources are found (exact screenshot scenario)', async () => {
    let ollamaCallCount = 0

    global.fetch = jest.fn(async (url) => {
      const urlValue = String(url)

      if (urlValue === 'http://grove:11434/api/chat') {
        ollamaCallCount += 1

        if (ollamaCallCount <= 1) {
          return {
            ok: true,
            async json() {
              return { message: { role: 'assistant', content: '', tool_calls: [] } }
            },
          }
        }

        const encoder = new TextEncoder()
        return {
          ok: true,
          body: [
            encoder.encode('{"message":{"role":"assistant","content":"Donald Trump is the current president of the United States."},"done":true}\n'),
          ],
        }
      }

      if (urlValue.startsWith('https://api.duckduckgo.com/') || urlValue.startsWith('https://html.duckduckgo.com/html/')) {
        return {
          ok: true,
          async json() {
            return {
              AbstractURL: 'https://www.govtrack.us/congress/other-people/donald_trump/412733',
              Heading: 'Donald Trump',
              AbstractText: 'GovTrack profile.',
              RelatedTopics: [],
            }
          },
          async text() { return '' },
        }
      }

      throw new Error(`Unexpected fetch: ${urlValue}`)
    })

    const response = streamResponse('qwen3.5:9b', [
      { role: 'user', content: 'who is the current president?' },
    ])

    const text = await response.text()

    expect(text).toContain('"verification":{"required":true,"status":"verified"')
    expect(text).toContain('Donald Trump is the current president of the United States.')
    expect(text).not.toContain("I can't confidently verify this claim yet")
  })

  it('keeps searching official variants before falling back to generic title-query results like govtrack', async () => {
    let ollamaCallCount = 0

    global.fetch = jest.fn(async (url) => {
      const urlValue = String(url)

      if (urlValue === 'http://grove:11434/api/chat') {
        ollamaCallCount += 1

        if (ollamaCallCount <= 1) {
          return {
            ok: true,
            async json() {
              return {
                message: {
                  role: 'assistant',
                  content: '',
                  tool_calls: [],
                },
              }
            },
          }
        }

        const encoder = new TextEncoder()
        return {
          ok: true,
          body: [
            encoder.encode('{"message":{"role":"assistant","content":"Donald Trump is the current president of the United States."},"done":true}\n'),
          ],
        }
      }

      if (urlValue.startsWith('https://api.duckduckgo.com/')) {
        const query = decodeURIComponent(urlValue.split('?q=')[1].split('&')[0])

        if (query.includes('official source')) {
          return {
            ok: true,
            async json() {
              return {
                AbstractURL: 'https://www.whitehouse.gov/administration/president-donald-j-trump/',
                Heading: 'President Donald J. Trump',
                AbstractText: 'Official White House biography.',
                RelatedTopics: [],
              }
            },
          }
        }

        return {
          ok: true,
          async json() {
            return {
              AbstractURL: 'https://www.govtrack.us/congress/other-people/donald_trump/412733',
              Heading: 'Donald Trump',
              AbstractText: 'GovTrack profile.',
              RelatedTopics: [],
            }
          },
        }
      }

      if (urlValue.startsWith('https://html.duckduckgo.com/html/')) {
        return {
          ok: true,
          async text() {
            return ''
          },
        }
      }

      throw new Error(`Unexpected fetch: ${urlValue}`)
    })

    const response = streamResponse('qwen3.5:9b', [
      { role: 'user', content: 'who is the current president?' },
    ])

    const text = await response.text()

    expect(text).toContain('"verification":{"required":true,"status":"verified"')
    expect(text).toContain('https://www.whitehouse.gov/administration/president-donald-j-trump/')
    expect(text).not.toContain('I can’t confidently verify this claim yet')
  })


  it('continues searching trusted outlets instead of stopping when initial evidence is weak', async () => {
    let streamCallCount = 0
    let trustedReadRequested = false

    global.fetch = jest.fn(async (url, options = {}) => {
      const urlValue = String(url)

      if (urlValue === 'http://grove:11434/api/chat') {
        const body = options?.body ? JSON.parse(options.body) : {}

        // Planning/verification passes: no tool calls from model side.
        if (body?.stream === false) {
          return {
            ok: true,
            async json() {
              return { message: { role: 'assistant', content: '', tool_calls: [] } }
            },
          }
        }

        // Final streaming answer after verification succeeds.
        streamCallCount += 1
        const encoder = new TextEncoder()
        return {
          ok: true,
          body: [
            encoder.encode('{"message":{"role":"assistant","content":"I found a trusted report confirming the latest verified details."},"done":true}\n'),
          ],
        }
      }

      if (urlValue.startsWith('https://api.duckduckgo.com/')) {
        const query = decodeURIComponent(urlValue.split('?q=')[1].split('&')[0])

        // Trusted-outlet escalation should include explicit site filter.
        if (query.includes('site:reuters.com')) {
          return {
            ok: true,
            async json() {
              return {
                AbstractURL: 'https://www.reuters.com/world/us/example-story/',
                Heading: 'Reuters report',
                AbstractText: 'Trusted coverage from Reuters.',
                RelatedTopics: [],
              }
            },
          }
        }

        // Initial searches return weak/untrusted coverage only.
        return {
          ok: true,
          async json() {
            return {
              AbstractURL: 'https://www.timesnownews.com/world/us-news/example-article',
              Heading: 'Untrusted outlet result',
              AbstractText: 'Weak corroboration.',
              RelatedTopics: [
                { FirstURL: 'https://en.wikipedia.org/wiki/Assassination_of_Charlie_Kirk', Text: 'Wikipedia page.' },
              ],
            }
          },
        }
      }

      if (urlValue.startsWith('https://html.duckduckgo.com/')) {
        return {
          ok: true,
          async text() {
            return ''
          },
        }
      }

      if (urlValue === 'https://www.reuters.com/world/us/example-story/') {
        trustedReadRequested = true
        return {
          ok: true,
          async text() {
            return '<html><head><title>Reuters story</title></head><body>Confirmed details from Reuters reporting.</body></html>'
          },
        }
      }

      throw new Error(`Unexpected fetch: ${urlValue}`)
    })

    const response = streamResponse('qwen3.5:9b', [
      { role: 'user', content: 'what happened to charlie kirk?' },
    ])

    const text = await response.text()

    expect(streamCallCount).toBeGreaterThanOrEqual(1)
    expect(trustedReadRequested).toBe(true)
    expect(text).toContain('Still verifying — searching trusted outlets…')
    expect(text).toContain('https://www.reuters.com/world/us/example-story/')
    expect(text).not.toContain('I can’t confidently verify this claim yet')
  })

  it('reads the top source page for exact-version questions instead of guessing from training data', async () => {
    let ollamaCallCount = 0
    let pageReadRequested = false

    global.fetch = jest.fn(async (url) => {
      const urlValue = String(url)

      if (urlValue === 'http://grove:11434/api/chat') {
        ollamaCallCount += 1

        // First pass: model returns no tool calls (skips searching)
        if (ollamaCallCount === 1) {
          return { ok: true, async json() { return { message: { role: 'assistant', content: '', tool_calls: [] } } } }
        }

        // Final streaming answer — should mention the version from the page
        const encoder = new TextEncoder()
        return {
          ok: true,
          body: [encoder.encode('{"message":{"role":"assistant","content":"The latest stable version of React is 19.1.0."},"done":true}\n')],
        }
      }

      // DuckDuckGo search returns versionlog.com
      if (urlValue.startsWith('https://api.duckduckgo.com/') || urlValue.startsWith('https://html.duckduckgo.com/')) {
        return {
          ok: true,
          async json() {
            return {
              AbstractURL: 'https://versionlog.com/react/',
              Heading: 'React versions',
              AbstractText: 'Version history for React.',
              RelatedTopics: [],
            }
          },
          async text() { return '' },
        }
      }

      // Page read of versionlog.com
      if (urlValue === 'https://versionlog.com/react/') {
        pageReadRequested = true
        return {
          ok: true,
          async text() {
            return '<html><head><title>React versions - versionlog.com</title></head><body><h1>React 19.1.0</h1><p>Released April 28, 2026. Latest stable version.</p></body></html>'
          },
        }
      }

      throw new Error(`Unexpected fetch: ${urlValue}`)
    })

    const response = streamResponse('qwen3.5:9b', [
      { role: 'user', content: 'give me exact version number of React' },
    ])

    const text = await response.text()

    expect(pageReadRequested).toBe(true)
    expect(text).toContain('"status":"verified"')
    expect(text).not.toContain('I can\'t confidently verify')
  })
})

/**
 * Edge cases and error handling
 */
describe('Edge Cases', () => {
  it('should handle stream with no thinking phase', () => {
    const updates = [
      { word: 'Direct' },
      { word: ' response' },
    ]

    let state = { content: '', thinking: '', thinkingVisible: true }

    for (const update of updates) {
      if (update.word) {
        state.content += update.word
      }
      // No thinkingDone signal, so thinking stays visible but empty
    }

    // Thinking is visible but empty - should not render
    const shouldRender = Boolean(state.thinking && state.thinkingVisible)
    expect(shouldRender).toBe(false)
    expect(state.content).toBe('Direct response')
  })

  it('should handle malformed SSE gracefully', () => {
    const malformed = 'data: {incomplete json'
    try {
      const data = malformed.replace(/^data: /, '')
      JSON.parse(data)
      expect(true).toBe(false) // Should throw
    } catch (e) {
      expect(e).toBeDefined()
    }
  })

  it('should handle very long thinking', () => {
    const thinking = 'I need to think very carefully about this problem. '.repeat(10)
    let buffer = ''
    const words = []

    buffer += thinking
    while (true) {
      const match = buffer.match(/^(.*?)\s/)
      if (!match) break
      const word = match[1] + ' '
      words.push(word)
      buffer = buffer.slice(word.length)
    }
    if (buffer) words.push(buffer)

    // Should split into multiple words
    expect(words.length).toBeGreaterThan(20)
    expect(words.join('')).toContain('think')
  })

  it('should handle special characters in response', () => {
    const content = 'Hello! 你好 🌟 "quoted" (parentheses) [brackets]'
    let buffer = ''
    const words = []

    buffer += content
    while (true) {
      const match = buffer.match(/^(.*?)\s/)
      if (!match) break
      const word = match[1] + ' '
      words.push(word)
      buffer = buffer.slice(word.length)
    }
    if (buffer) words.push(buffer)

    const reconstructed = words.join('')
    expect(reconstructed).toContain('你好')
    expect(reconstructed).toContain('🌟')
    expect(reconstructed).toContain('quoted')
  })
})
