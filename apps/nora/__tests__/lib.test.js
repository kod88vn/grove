import { describe, it, expect, jest } from '@jest/globals'
import { normalizeQuery, normalizeUrl, parseXmlToolCalls, extractToolCalls } from '../app/api/chat/lib/toolCalls'
import {
  buildVerificationQueries,
  buildVerificationReport,
  countHighConfidenceSources,
  countReliableSources,
  countTrustedSources,
  requiresFactVerification,
  requiresLiveData,
  requiresPreciseValue,
} from '../app/api/chat/lib/chatStream'
import { withSystemMessage } from '../app/api/chat/lib/prompt'

// ---------------------------------------------------------------------------
// normalizeQuery
// ---------------------------------------------------------------------------
describe('normalizeQuery', () => {
  it('returns empty string for null/undefined', () => {
    expect(normalizeQuery(null)).toBe('')
    expect(normalizeQuery(undefined)).toBe('')
  })

  it('parses JSON string argument', () => {
    expect(normalizeQuery(JSON.stringify({ query: 'what is rust' }))).toBe('what is rust')
  })

  it('falls back to raw string when not JSON', () => {
    expect(normalizeQuery('plain query')).toBe('plain query')
  })

  it('handles object argument directly', () => {
    expect(normalizeQuery({ query: 'hello world' })).toBe('hello world')
  })

  it('returns empty string when query key is missing', () => {
    expect(normalizeQuery({})).toBe('')
  })
})

// ---------------------------------------------------------------------------
// normalizeUrl
// ---------------------------------------------------------------------------
describe('normalizeUrl', () => {
  it('returns empty string for null/undefined', () => {
    expect(normalizeUrl(null)).toBe('')
    expect(normalizeUrl(undefined)).toBe('')
  })

  it('parses a valid URL from JSON string', () => {
    const result = normalizeUrl(JSON.stringify({ url: 'https://example.com' }))
    expect(result).toBe('https://example.com/')
  })

  it('parses a valid URL from object', () => {
    expect(normalizeUrl({ url: 'https://example.com/page' })).toBe('https://example.com/page')
  })

  it('rejects non-http protocols', () => {
    expect(normalizeUrl({ url: 'ftp://example.com' })).toBe('')
    expect(normalizeUrl({ url: 'javascript:alert(1)' })).toBe('')
  })

  it('returns empty string for a malformed URL', () => {
    expect(normalizeUrl({ url: 'not-a-url' })).toBe('')
  })

  it('returns empty string when url key is missing', () => {
    expect(normalizeUrl({})).toBe('')
  })
})

// ---------------------------------------------------------------------------
// parseXmlToolCalls
// ---------------------------------------------------------------------------
describe('parseXmlToolCalls', () => {
  it('returns empty array for empty/null content', () => {
    expect(parseXmlToolCalls('')).toEqual([])
    expect(parseXmlToolCalls(null)).toEqual([])
  })

  it('parses a single XML tool call', () => {
    const xml = `<function=web_search><parameter=query>latest news</parameter></function>`
    const result = parseXmlToolCalls(xml)
    expect(result).toHaveLength(1)
    expect(result[0].function.name).toBe('web_search')
    expect(result[0].function.arguments.query).toBe('latest news')
  })

  it('parses multiple XML tool calls', () => {
    const xml = `
      <function=web_search><parameter=query>foo</parameter></function>
      <function=read_webpage><parameter=url>https://example.com</parameter></function>
    `
    const result = parseXmlToolCalls(xml)
    expect(result).toHaveLength(2)
    expect(result[0].function.name).toBe('web_search')
    expect(result[1].function.name).toBe('read_webpage')
  })

  it('returns empty array when no function tags present', () => {
    expect(parseXmlToolCalls('some plain text response')).toEqual([])
  })
})

// ---------------------------------------------------------------------------
// extractToolCalls
// ---------------------------------------------------------------------------
describe('extractToolCalls', () => {
  it('returns empty array for null/undefined message', () => {
    expect(extractToolCalls(null)).toEqual([])
    expect(extractToolCalls(undefined)).toEqual([])
  })

  it('prefers structured tool_calls over XML content', () => {
    const message = {
      tool_calls: [{ type: 'function', function: { name: 'web_search', arguments: { query: 'hi' } } }],
      content: '<function=read_webpage><parameter=url>https://x.com</parameter></function>',
    }
    const result = extractToolCalls(message)
    expect(result).toHaveLength(1)
    expect(result[0].function.name).toBe('web_search')
  })

  it('falls back to XML parsing when tool_calls is absent', () => {
    const message = {
      content: '<function=web_search><parameter=query>hello</parameter></function>',
    }
    const result = extractToolCalls(message)
    expect(result).toHaveLength(1)
    expect(result[0].function.name).toBe('web_search')
  })

  it('adds missing type field from structured tool_calls', () => {
    const message = {
      tool_calls: [{ function: { name: 'get_current_time', arguments: {} } }],
    }
    const result = extractToolCalls(message)
    expect(result[0].type).toBe('function')
  })
})

// ---------------------------------------------------------------------------
// factual verification guardrails
// ---------------------------------------------------------------------------
describe('requiresFactVerification', () => {
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
  })

  it('returns false for non-sensitive prompts', () => {
    expect(requiresFactVerification('explain how photosynthesis works')).toBe(false)
    expect(requiresFactVerification('write a poem about summer')).toBe(false)
    expect(requiresFactVerification('tell a funny pirate story for kids')).toBe(false)
    expect(requiresFactVerification('did [public figure] pass away this year?')).toBe(false)
  })
})

describe('requiresLiveData', () => {
  it('returns true for weather and forecast queries', () => {
    expect(requiresLiveData("how's the weather tomorrow?")).toBe(true)
    expect(requiresLiveData('what is the weather today?')).toBe(true)
    expect(requiresLiveData('will it rain tonight?')).toBe(true)
    expect(requiresLiveData('forecast for this week')).toBe(true)
    expect(requiresLiveData('is it sunny tomorrow')).toBe(true)
  })

  it('returns true for live/real-time queries', () => {
    expect(requiresLiveData('stock price of Apple right now')).toBe(true)
    expect(requiresLiveData('what is the score currently')).toBe(true)
    expect(requiresLiveData('breaking news as of today')).toBe(true)
  })

  it('returns false for general queries', () => {
    expect(requiresLiveData('explain how photosynthesis works')).toBe(false)
    expect(requiresLiveData('write a poem about summer')).toBe(false)
    expect(requiresLiveData('who was the first US president')).toBe(false)
  })
})

describe('narration detection pattern', () => {
  const narrationRe = /\b(i should|i will|i'll|i need to|let me)\b.{0,60}\b(search|look up|find|check|use the \w+_\w+ tool)\b/i

  it('matches planning narration phrases', () => {
    expect(narrationRe.test("I should use the web_search tool to get the weather forecast.")).toBe(true)
    expect(narrationRe.test("I'll search for weather information for tomorrow.")).toBe(true)
    expect(narrationRe.test("Let me search for the latest news.")).toBe(true)
    expect(narrationRe.test("I need to look up the current stock price.")).toBe(true)
  })

  it('does not match normal answer content', () => {
    expect(narrationRe.test("The weather tomorrow will be sunny with a high of 22°C.")).toBe(false)
    expect(narrationRe.test("Here is what I found about the topic.")).toBe(false)
    expect(narrationRe.test("You should check the official website for updates.")).toBe(false)
  })
})

describe('requiresPreciseValue', () => {
  it('matches exact version queries', () => {
    expect(requiresPreciseValue('give me exact version number')).toBe(true)
    expect(requiresPreciseValue('what is the latest version of React?')).toBe(true)
    expect(requiresPreciseValue('what version of Node is current?')).toBe(true)
    expect(requiresPreciseValue('current stable release of Python')).toBe(true)
  })

  it('matches exact price/count queries', () => {
    expect(requiresPreciseValue('what is the exact price of a Big Mac?')).toBe(true)
    expect(requiresPreciseValue('exact number of seats in the Senate')).toBe(true)
  })

  it('does not match general questions', () => {
    expect(requiresPreciseValue('who is the current president?')).toBe(false)
    expect(requiresPreciseValue('how does React work?')).toBe(false)
    expect(requiresPreciseValue('explain React hooks')).toBe(false)
  })
})

describe('countReliableSources', () => {
  it('discounts low-confidence sources and category pages', () => {
    const count = countReliableSources([
      'https://www.foxnews.com/category/media/charlie-kirk',
      'https://en.wikipedia.org/wiki/Assassination_of_Charlie_Kirk',
      'https://www.bls.gov/cpi/latest-numbers.htm',
    ])

    expect(count).toBe(1)
  })
})

describe('countHighConfidenceSources', () => {
  it('counts authoritative official domains', () => {
    const count = countHighConfidenceSources([
      'https://www.whitehouse.gov/administration/president-donald-j-trump/',
      'https://www.bls.gov/cpi/latest-numbers.htm',
      'https://en.wikipedia.org/wiki/President_of_the_United_States',
    ])

    expect(count).toBe(2)
  })
})

describe('countTrustedSources', () => {
  it('counts trusted outlet domains and excludes unknown outlets', () => {
    const count = countTrustedSources([
      'https://www.reuters.com/world/us/example-story/',
      'https://apnews.com/article/example',
      'https://www.timesnownews.com/world/us-news/example-article',
      'https://abcnews.com/us/example',
    ])

    expect(count).toBe(2)
  })
})

describe('buildVerificationReport', () => {
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

  it('marks current title questions with one official source as verified', () => {
    const report = buildVerificationReport('who is the current US president?', [
      'https://www.whitehouse.gov/administration/president-donald-j-trump/',
    ])

    expect(report.required).toBe(true)
    expect(report.status).toBe('verified')
    expect(report.highConfidenceSourceCount).toBe(1)
  })

  it('marks current title questions with one reliable (non-official) source as verified', () => {
    const report = buildVerificationReport('who is the current US president?', [
      'https://www.govtrack.us/congress/other-people/donald_trump/412733',
    ])

    expect(report.required).toBe(true)
    expect(report.status).toBe('verified')
    expect(report.reliableSourceCount).toBe(1)
  })

  it('marks current title questions as unverified when only Wikipedia is found', async () => {
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
})

describe('buildVerificationQueries', () => {
  it('expands a base question into corroboration-focused search variants', () => {
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

describe('system prompt guardrails', () => {
  it('does not treat injected current time as evidence for real-world event claims', () => {
    const [{ content }] = withSystemMessage([{ role: 'user', content: 'test' }])

    expect(content).not.toContain('Use this as the authoritative current date for all searches and answers')
    expect(content).toContain('Never infer that an event happened "today" from this clock value alone')
  })

  it('includes verification and no-guessing policy for sensitive people claims', () => {
    const [{ content }] = withSystemMessage([{ role: 'user', content: 'test' }])

    expect(content).toContain('strict process: Plan what facts are needed, Execute tool calls, then Verify evidence')
    expect(content).toContain('ALWAYS attempt to verify with web_search first')
    expect(content).toContain('events or figures')
    expect(content).toContain('never guess or invent details')
    expect(content).toContain('avoid vague meta-commentary')
    expect(content).toContain('do not present definitive conclusions')
    expect(content).toContain('If verification is inconclusive, explicitly say you cannot verify')
  })
})
