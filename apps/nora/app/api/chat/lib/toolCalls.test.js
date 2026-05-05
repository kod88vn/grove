import { describe, expect, it } from '@jest/globals'

import { extractToolCalls, normalizeQuery, normalizeUrl, parseXmlToolCalls } from './toolCalls'

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

  it('includes type=function for XML tool calls', () => {
    const content = '<function=web_search>\n<parameter=query>\nReact version\n</parameter>\n</function>'
    const calls = parseXmlToolCalls(content)
    expect(calls).toHaveLength(1)
    expect(calls[0].type).toBe('function')
  })
})

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

  it('preserves an existing type field on structured tool calls', () => {
    const message = {
      tool_calls: [{ type: 'function', function: { name: 'web_search', arguments: { query: 'test' } } }],
    }
    const calls = extractToolCalls(message)
    expect(calls[0].type).toBe('function')
  })
})