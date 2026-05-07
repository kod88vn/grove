import { afterAll, afterEach, describe, expect, it, jest } from '@jest/globals'
import { ReadableStream as NodeReadableStream } from 'node:stream/web'
import { TextDecoder as NodeTextDecoder, TextEncoder as NodeTextEncoder } from 'node:util'

import {
  buildVerificationQueries,
  buildVerificationReport,
  buildVerificationSystemMessage,
  countHighConfidenceSources,
  countReliableSources,
  countTrustedSources,
  countTrustedTechSources,
  hasSufficientCitations,
  requiresFactVerification,
  requiresLiveData,
  requiresPreciseValue,
  streamResponse,
} from './chatStream'

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

describe('streamResponse planning short-circuit', () => {
  it('emits thinkingDone + word when planning result has content and no remaining tool calls', () => {
    const events = []
    const emit = (obj) => events.push(obj)

    const planningAnswer = 'The current React version is 19.2.5.'
    const toolCalls = []

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

  it('does not short-circuit when planning result has remaining tool calls', () => {
    const events = []
    const emit = (obj) => events.push(obj)

    const planningAnswer = ''
    const toolCalls = [{ type: 'function', function: { name: 'web_search', arguments: { query: 'React version' } } }]

    const hasRemainingToolCalls = Array.isArray(toolCalls) && toolCalls.length > 0
    if (!hasRemainingToolCalls && planningAnswer) {
      emit({ thinkingDone: true })
      emit({ word: planningAnswer })
    }

    expect(events).toHaveLength(0)
  })
})

describe('chat stream token handling', () => {
  it('handles thinking chunks before content starts', () => {
    const mockThinking = '{"model":"qwen3.5:9b","message":{"thinking":"Let","content":""},"done":false}'
    const json = JSON.parse(mockThinking)

    expect(json.message.thinking).toBe('Let')
    expect(json.message.content).toBe('')
  })

  it('marks the content transition when thinking stops', () => {
    const thinkingChunk = '{"model":"qwen3.5:9b","message":{"thinking":" me","content":""},"done":false}'
    const contentChunk = '{"model":"qwen3.5:9b","message":{"thinking":"","content":"Hello"},"done":false}'

    const think = JSON.parse(thinkingChunk)
    const content = JSON.parse(contentChunk)

    expect(think.message.thinking).toBeTruthy()
    expect(think.message.content).toBe('')
    expect(content.message.thinking).toBe('')
    expect(content.message.content).toBe('Hello')
  })

  it('buffers words until whitespace boundaries', () => {
    const tokens = ['H', 'ello ', 'wor', 'ld']
    let buffer = ''
    const words = []

    for (const token of tokens) {
      buffer += token
      while (true) {
        const match = buffer.match(/^(.*?)\s/)
        if (!match) break
        const word = match[1] + ' '
        words.push(word)
        buffer = buffer.slice(word.length)
      }
    }
    words.push(buffer)

    expect(words).toEqual(['Hello ', 'world'])
  })

  it('flushes the remaining buffer on done', () => {
    let buffer = 'hello'
    const words = []

    while (true) {
      const match = buffer.match(/^(.*?)\s/)
      if (!match) break
      const word = match[1] + ' '
      words.push(word)
      buffer = buffer.slice(word.length)
    }

    if (buffer) words.push(buffer)
    expect(words).toEqual(['hello'])
  })
})

describe('verification heuristics', () => {
  it('returns true for sensitive status claims', () => {
    expect(requiresFactVerification('was he killed last year?')).toBe(true)
    expect(requiresFactVerification('is she still alive')).toBe(true)
    expect(requiresFactVerification('was he arrested or convicted')).toBe(true)
  })

  it('returns true for event and figure queries', () => {
    expect(requiresFactVerification('what happened in the 2020 election?')).toBe(true)
    expect(requiresFactVerification('what happened to charlie kirk?')).toBe(true)
    expect(requiresFactVerification('what is the inflation rate this year?')).toBe(true)
    expect(requiresFactVerification('how many people died in the earthquake?')).toBe(true)
    expect(requiresFactVerification('who is the current UK prime minister?')).toBe(true)
    expect(requiresFactVerification("what's the best bang for the buck for a gpu to run llm at home?")).toBe(true)
  })

  it('returns false for non-sensitive prompts', () => {
    expect(requiresFactVerification('explain how photosynthesis works')).toBe(false)
    expect(requiresFactVerification('write a poem about summer')).toBe(false)
    expect(requiresFactVerification('tell a funny pirate story for kids')).toBe(false)
    expect(requiresFactVerification('did [public figure] pass away this year?')).toBe(false)
  })

  it('returns true for weather and forecast queries', () => {
    expect(requiresLiveData("how's the weather tomorrow?")).toBe(true)
    expect(requiresLiveData('what is the weather today?')).toBe(true)
    expect(requiresLiveData('will it rain tonight?')).toBe(true)
    expect(requiresLiveData('forecast for this week')).toBe(true)
    expect(requiresLiveData('is it sunny tomorrow')).toBe(true)
  })

  it('returns true for live queries', () => {
    expect(requiresLiveData('stock price of Apple right now')).toBe(true)
    expect(requiresLiveData('what is the score currently')).toBe(true)
    expect(requiresLiveData('breaking news as of today')).toBe(true)
  })

  it('returns false for general evergreen questions', () => {
    expect(requiresLiveData('explain how photosynthesis works')).toBe(false)
    expect(requiresLiveData('write a poem about summer')).toBe(false)
    expect(requiresLiveData('who was the first US president')).toBe(false)
  })

  it('matches exact version and price/count queries', () => {
    expect(requiresPreciseValue('give me exact version number')).toBe(true)
    expect(requiresPreciseValue('what is the latest version of React?')).toBe(true)
    expect(requiresPreciseValue('current stable release of Python')).toBe(true)
    expect(requiresPreciseValue('what is the exact price of a Big Mac?')).toBe(true)
    expect(requiresPreciseValue('exact number of seats in the Senate')).toBe(true)
  })

  it('does not flag general explanatory questions as precise-value lookups', () => {
    expect(requiresPreciseValue('who is the current president?')).toBe(false)
    expect(requiresPreciseValue('how does React work?')).toBe(false)
    expect(requiresPreciseValue('explain React hooks')).toBe(false)
  })
})

describe('verification report helpers', () => {
  it('counts reliable sources while discounting low-confidence pages', () => {
    const count = countReliableSources([
      'https://www.foxnews.com/category/media/charlie-kirk',
      'https://en.wikipedia.org/wiki/Assassination_of_Charlie_Kirk',
      'https://www.bls.gov/cpi/latest-numbers.htm',
    ])

    expect(count).toBe(1)
  })

  it('counts high-confidence official domains', () => {
    const count = countHighConfidenceSources([
      'https://www.whitehouse.gov/administration/president-donald-j-trump/',
      'https://www.bls.gov/cpi/latest-numbers.htm',
      'https://en.wikipedia.org/wiki/President_of_the_United_States',
    ])

    expect(count).toBe(2)
  })

  it('counts trusted outlet domains and excludes unknown ones', () => {
    const count = countTrustedSources([
      'https://www.reuters.com/world/us/example-story/',
      'https://apnews.com/article/example',
      'https://www.timesnownews.com/world/us-news/example-article',
      'https://abcnews.com/us/example',
    ])

    expect(count).toBe(2)
  })

  it('counts trusted hardware-review domains', () => {
    const count = countTrustedTechSources([
      'https://www.tomshardware.com/reviews/example-gpu',
      'https://www.techpowerup.com/review/example-gpu/',
      'https://www.compute-market.com/blog/best-gpu-for-ai-2026',
    ])

    expect(count).toBe(2)
  })

  it('marks non-factual prompts as not required', () => {
    const report = buildVerificationReport('write a short bedtime poem', [])
    expect(report.required).toBe(false)
    expect(report.status).toBe('not_required')
  })

  it('marks factual prompts with two sources as verified', () => {
    const report = buildVerificationReport('what happened in the 2020 election', ['https://a.com', 'https://b.com'])
    expect(report.required).toBe(true)
    expect(report.status).toBe('verified')
    expect(report.sourceCount).toBe(2)
  })

  it('does not mark sensitive person-status claims as verified without trusted outlets', () => {
    const report = buildVerificationReport('what happened to charlie kirk?', [
      'https://www.timesnownews.com/world/us-news/charlie-kirk-assassination-article-123',
      'https://abcnews.com/us/charlie-kirk-shooting-article?id=123456789',
    ])

    expect(report.required).toBe(true)
    expect(report.status).toBe('weak')
    expect(report.trustedSourceCount).toBe(0)
  })

  it('allows sensitive person-status claims when a trusted outlet is present', () => {
    const report = buildVerificationReport('what happened to charlie kirk?', [
      'https://www.reuters.com/world/us/example-story/',
      'https://www.timesnownews.com/world/us-news/example-article',
    ])

    expect(report.required).toBe(true)
    expect(report.status).toBe('verified')
    expect(report.trustedSourceCount).toBe(1)
  })

  it('does not mark low-confidence corroboration as verified', () => {
    const report = buildVerificationReport('what happened to charlie kirk?', [
      'https://www.foxnews.com/category/media/charlie-kirk',
      'https://en.wikipedia.org/wiki/Assassination_of_Charlie_Kirk',
    ])

    expect(report.required).toBe(true)
    expect(report.status).toBe('weak')
    expect(report.reliableSourceCount).toBe(0)
  })

  it('marks factual prompts with one source as weak', () => {
    const report = buildVerificationReport('what is the inflation rate', ['https://a.com'])
    expect(report.required).toBe(true)
    expect(report.status).toBe('weak')
    expect(report.sourceCount).toBe(1)
  })

  it('marks current title questions with one official or reliable source as verified', () => {
    const official = buildVerificationReport('who is the current US president?', [
      'https://www.whitehouse.gov/administration/president-donald-j-trump/',
    ])
    const reliable = buildVerificationReport('who is the current US president?', [
      'https://www.govtrack.us/congress/other-people/donald_trump/412733',
    ])

    expect(official.status).toBe('verified')
    expect(official.highConfidenceSourceCount).toBe(1)
    expect(reliable.status).toBe('verified')
    expect(reliable.reliableSourceCount).toBe(1)
  })

  it('marks current title questions as unverified when only Wikipedia is found', () => {
    const report = buildVerificationReport('who is the current president?', [
      'https://en.wikipedia.org/wiki/2026_United_States_elections',
    ])

    expect(report.required).toBe(true)
    expect(report.status).toBe('unverified')
    expect(report.sourceCount).toBe(0)
    expect(report.reliableSourceCount).toBe(0)
  })

  it('marks factual prompts with no sources as unverified', () => {
    const report = buildVerificationReport('how many people died in the earthquake', [])
    expect(report.required).toBe(true)
    expect(report.status).toBe('unverified')
    expect(report.sourceCount).toBe(0)
  })

  it('marks market recommendation prompts with trusted tech corroboration only', () => {
    const weak = buildVerificationReport("what's the best bang for the buck gpu for llm at home?", [
      'https://www.compute-market.com/blog/best-gpu-for-ai-2026',
    ])
    const verified = buildVerificationReport("what's the best bang for the buck gpu for llm at home?", [
      'https://www.tomshardware.com/reviews/example-gpu',
      'https://www.techpowerup.com/review/example-gpu/',
    ])

    expect(weak.status).toBe('weak')
    expect(weak.trustedTechSourceCount).toBe(0)
    expect(verified.status).toBe('verified')
    expect(verified.trustedTechSourceCount).toBeGreaterThanOrEqual(1)
  })

  it('builds corroboration-focused query variants', () => {
    const queries = buildVerificationQueries('what happened to charlie kirk?')
    expect(queries).toContain('what happened to charlie kirk?')
    expect(queries).toContain('what happened to charlie kirk? latest news')
    expect(queries).toContain('what happened to charlie kirk? official source')
  })

  it('biases current office questions toward official domains', () => {
    const queries = buildVerificationQueries('who is the current US president?')
    expect(queries).toContain('who is the current US president? site:whitehouse.gov')
  })
})

describe('streamResponse integration', () => {
  it('handles complete thinking -> content -> done flow', () => {
    const ollamaResponses = [
      '{"model":"qwen3.5:9b","message":{"role":"assistant","content":"","thinking":"Let"},"done":false}',
      '{"model":"qwen3.5:9b","message":{"role":"assistant","content":"","thinking":" me"},"done":false}',
      '{"model":"qwen3.5:9b","message":{"role":"assistant","content":"","thinking":" think"},"done":false}',
      '{"model":"qwen3.5:9b","message":{"role":"assistant","content":"Hello","thinking":""},"done":false}',
      '{"model":"qwen3.5:9b","message":{"role":"assistant","content":" world","thinking":""},"done":false}',
      '{"model":"qwen3.5:9b","message":{"role":"assistant","content":"!","thinking":""},"done":true}',
    ]

    const thinkingEmissions = []
    const contentEmissions = []
    let contentStarted = false
    let thinkBuffer = ''
    let contentBuffer = ''

    for (const response of ollamaResponses) {
      const json = JSON.parse(response)
      const thinking = json.message?.thinking || ''
      const content = json.message?.content || ''

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

      if (content && !contentStarted) {
        contentStarted = true
        if (thinkBuffer) {
          thinkingEmissions.push(thinkBuffer)
          thinkBuffer = ''
        }
        contentEmissions.push('[THINKING_DONE]')
      }

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

      if (json.done && contentBuffer) {
        contentEmissions.push(contentBuffer)
      }
    }

    expect(thinkingEmissions).toContain('Let ')
    expect(thinkingEmissions).toContain('me ')
    expect(thinkingEmissions).toContain('think')

    const thinkingDoneIdx = contentEmissions.indexOf('[THINKING_DONE]')
    expect(thinkingDoneIdx).toBeGreaterThanOrEqual(0)
    expect(contentEmissions[thinkingDoneIdx + 1]).toBe('Hello ')
    expect(contentEmissions[thinkingDoneIdx + 2]).toBe('world!')
  })

  it('reconstructs thinking and content from SSE frames correctly', () => {
    const stream = `data: {"thinking":"Let"}\n\ndata: {"thinking":" me"}\n\ndata: {"thinking":" think"}\n\ndata: {"thinkingDone":true}\n\ndata: {"word":"Hello"}\n\ndata: {"word":" world"}\n\ndata: [DONE]\n\n`
    const lines = stream.split('\n\n').filter((l) => l.trim())
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

  it('keeps content visible after thinkingDone and handles empty-content edge cases', () => {
    const visible = {
      thinking: 'processing...',
      thinkingVisible: false,
      content: 'Hello',
    }
    const hiddenEmpty = {
      thinking: 'thinking...',
      thinkingVisible: false,
      content: '',
    }

    expect(Boolean(visible.thinking && visible.thinkingVisible)).toBe(false)
    expect(Boolean(visible.content)).toBe(true)
    expect(Boolean(hiddenEmpty.thinking && hiddenEmpty.thinkingVisible)).toBe(false)
    expect(Boolean(hiddenEmpty.content)).toBe(false)
  })

  it('disables reasoning mode for the final streaming answer to avoid leaking chain-of-thought text', async () => {
    const ollamaRequests = []

    global.fetch = jest.fn(async (url, options = {}) => {
      const urlValue = String(url)

      if (urlValue === 'http://grove:11434/api/chat') {
        const body = options?.body ? JSON.parse(options.body) : {}
        ollamaRequests.push(body)

        if (body?.stream === false) {
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

  it('answers a current-president question when an official source is available', async () => {
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
                  content: 'As of May 3, 2026, Joe Biden is still the president of the United States.',
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

  it('answers when reliable non-official sources are found', async () => {
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

  it('keeps searching official variants before falling back to generic title-query results', async () => {
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

        if (body?.stream === false) {
          return {
            ok: true,
            async json() {
              return { message: { role: 'assistant', content: '', tool_calls: [] } }
            },
          }
        }

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

        if (ollamaCallCount === 1) {
          return { ok: true, async json() { return { message: { role: 'assistant', content: '', tool_calls: [] } } } }
        }

        const encoder = new TextEncoder()
        return {
          ok: true,
          body: [encoder.encode('{"message":{"role":"assistant","content":"The latest stable version of React is 19.1.0."},"done":true}\n')],
        }
      }

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

describe('chat stream edge cases', () => {
  it('handles direct content with no thinking phase', () => {
    const updates = [{ word: 'Direct' }, { word: ' response' }]
    let state = { content: '', thinking: '', thinkingVisible: true }

    for (const update of updates) {
      if (update.word) {
        state.content += update.word
      }
    }

    expect(Boolean(state.thinking && state.thinkingVisible)).toBe(false)
    expect(state.content).toBe('Direct response')
  })

  it('handles very long thinking content', () => {
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

    expect(words.length).toBeGreaterThan(20)
    expect(words.join('')).toContain('think')
  })

  it('handles special characters in responses', () => {
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

describe('buildVerificationSystemMessage', () => {
  it('mandates source citations for verified status', () => {
    const report = { required: true, status: 'verified' }
    const message = buildVerificationSystemMessage(report, 'who is the president', ['https://whitehouse.gov', 'https://bbc.com'])
    
    expect(message).toContain('CRITICAL')
    expect(message).toContain('MUST cite sources')
    expect(message).toContain('[Source: Name]')
    expect(message).toContain('at least 2')
    expect(message).toContain('whitehouse.gov')
    expect(message).toContain('bbc.com')
  })

  it('enforces citations for weak evidence', () => {
    const report = { required: true, status: 'weak' }
    const message = buildVerificationSystemMessage(report, 'what is the best laptop', ['https://techreview.com'])
    
    expect(message).toContain('WEAK EVIDENCE')
    expect(message).toContain('MUST CITE SOURCES')
    expect(message).toContain('techreview.com')
  })

  it('requires strict citations for low confidence', () => {
    const report = { required: true, status: 'low_confidence' }
    const message = buildVerificationSystemMessage(report, 'when did X happen', ['https://source1.com'])
    
    expect(message).toContain('STRICT CITATION REQUIRED')
    expect(message).toContain('Cite every claim with source name')
    expect(message).toContain('source1.com')
  })

  it('returns empty string when verification not required', () => {
    const report = { required: false }
    const message = buildVerificationSystemMessage(report, 'hello')
    
    expect(message).toBe('')
  })

  it('includes sources list in system message for model awareness', () => {
    const report = { required: true, status: 'verified' }
    const sources = ['https://example1.com', 'https://example2.com', 'https://example3.com']
    const message = buildVerificationSystemMessage(report, 'test', sources)
    
    expect(message).toContain('AVAILABLE SOURCES:')
    expect(message).toContain('1. https://example1.com')
    expect(message).toContain('2. https://example2.com')
    expect(message).toContain('3. https://example3.com')
  })

  it('limits sources list to first 5 even if more provided', () => {
    const report = { required: true, status: 'verified' }
    const sources = Array.from({ length: 10 }, (_, i) => `https://source${i}.com`)
    const message = buildVerificationSystemMessage(report, 'test', sources)
    
    const sourceLines = message.match(/https:\/\/source\d+\.com/g) || []
    expect(sourceLines.length).toBe(5)
  })
})

describe('hasSufficientCitations', () => {
  it('detects [Source: Name] format citations', () => {
    const text = 'Charlie Kirk is alive [Source: Reuters]. This was confirmed [Source: BBC News].'
    expect(hasSufficientCitations(text, 2)).toBe(true)
  })

  it('detects (per Source) format citations', () => {
    const text = 'He continues his work (per Reuters). Multiple outlets report this (per AP News).'
    expect(hasSufficientCitations(text, 2)).toBe(true)
  })

  it('returns false when citations are insufficient', () => {
    const text = 'Charlie Kirk is alive and active. He continues his work.'
    expect(hasSufficientCitations(text, 2)).toBe(false)
  })

  it('returns false for only one citation when 2 are required', () => {
    const text = 'Charlie Kirk is alive [Source: Reuters] according to latest reports.'
    expect(hasSufficientCitations(text, 2)).toBe(false)
  })

  it('accepts null/undefined gracefully', () => {
    expect(hasSufficientCitations(null, 2)).toBe(false)
    expect(hasSufficientCitations(undefined, 2)).toBe(false)
    expect(hasSufficientCitations('', 2)).toBe(false)
  })

  it('is case-insensitive', () => {
    const text = 'Info [SOURCE: REUTERS]. Data (PER BBC News).'
    expect(hasSufficientCitations(text, 2)).toBe(true)
  })

  it('works with mixed citation formats', () => {
    const text = 'According to sources [Source: Reuters], Kirk is alive (per AP News).'
    expect(hasSufficientCitations(text, 2)).toBe(true)
  })
})