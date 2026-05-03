import { describe, it, expect, jest } from '@jest/globals'
import { normalizeQuery, normalizeUrl, parseXmlToolCalls, extractToolCalls } from '../app/api/chat/lib/toolCalls'
import { buildVerificationQueries, buildVerificationReport, requiresFactVerification } from '../app/api/chat/lib/chatStream'
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
  })

  it('returns false for non-sensitive prompts', () => {
    expect(requiresFactVerification('explain how photosynthesis works')).toBe(false)
    expect(requiresFactVerification('write a poem about summer')).toBe(false)
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

  it('marks factual prompts with one source as weak', () => {
    const report = buildVerificationReport('what is the inflation rate', ['https://a.com'])
    expect(report.required).toBe(true)
    expect(report.status).toBe('weak')
    expect(report.sourceCount).toBe(1)
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
    expect(queries).toContain('what happened to charlie kirk? Reuters')
    expect(queries).toContain('what happened to charlie kirk? AP News')
  })
})

describe('system prompt guardrails', () => {
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
