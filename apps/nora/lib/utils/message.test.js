import {
  createAssistantPlaceholder,
  applyStreamEvent,
  formatTimestamp,
  extractSources,
  dedupeSources,
  formatVerificationLabel,
} from './message.js'

describe('createAssistantPlaceholder', () => {
  it('returns an assistant message with given timestamp', () => {
    const ts = '2024-01-01T12:00:00.000Z'
    const msg = createAssistantPlaceholder(ts)
    expect(msg.role).toBe('assistant')
    expect(msg.timestamp).toBe(ts)
    expect(msg.content).toBe('')
  })

  it('applies overrides', () => {
    const msg = createAssistantPlaceholder('ts', { isGreeting: true })
    expect(msg.isGreeting).toBe(true)
  })
})

describe('applyStreamEvent', () => {
  const base = createAssistantPlaceholder('2024-01-01T00:00:00.000Z')

  it('appends a word to content', () => {
    const next = applyStreamEvent([base], { word: 'Hello' })
    expect(next[0].content).toBe('Hello')
  })

  it('concatenates consecutive words', () => {
    const step1 = applyStreamEvent([base], { word: 'Hello' })
    const step2 = applyStreamEvent(step1, { word: ' world' })
    expect(step2[0].content).toBe('Hello world')
  })

  it('appends thinking text', () => {
    const next = applyStreamEvent([base], { thinking: 'reasoning...' })
    expect(next[0].thinking).toBe('reasoning...')
  })

  it('updates status', () => {
    const next = applyStreamEvent([base], { status: 'Searching…' })
    expect(next[0].status).toBe('Searching…')
  })

  it('clears status with empty string', () => {
    const next = applyStreamEvent([{ ...base, status: 'Old' }], { status: '' })
    expect(next[0].status).toBe('')
  })

  it('sets sources', () => {
    const sources = ['https://example.com']
    const next = applyStreamEvent([base], { sources })
    expect(next[0].sources).toEqual(sources)
  })

  it('sets verification', () => {
    const verification = { status: 'verified', sourceCount: 2 }
    const next = applyStreamEvent([base], { verification })
    expect(next[0].verification).toEqual(verification)
  })

  it('hides thinking on thinkingDone', () => {
    const withThinking = { ...base, thinking: 'some thought' }
    const next = applyStreamEvent([withThinking], { thinkingDone: true })
    expect(next[0].thinkingVisible).toBe(false)
  })

  it('resets content and thinking on retract', () => {
    const msg = { ...base, content: 'oops', thinking: 'bad thought', thinkingVisible: false }
    const next = applyStreamEvent([msg], { retract: true })
    expect(next[0].content).toBe('')
    expect(next[0].thinking).toBe('')
    expect(next[0].thinkingVisible).toBe(true)
  })

  it('returns unchanged array for unknown events', () => {
    const msgs = [base]
    const next = applyStreamEvent(msgs, { unknownKey: 42 })
    expect(next).toBe(msgs)
  })

  it('returns unchanged array when messages is empty', () => {
    const result = applyStreamEvent([], { word: 'hi' })
    expect(result).toEqual([])
  })

  it('starts with thinking fields ready for streaming', () => {
    const msg = createAssistantPlaceholder('ts')
    expect(msg.thinking).toBe('')
    expect(msg.thinkingVisible).toBe(true)
    expect(msg.content).toBe('')
  })

  it('preserves accumulated thinking until thinkingDone hides it', () => {
    const withThinking = applyStreamEvent([base], { thinking: 'Let me think' })
    const hidden = applyStreamEvent(withThinking, { thinkingDone: true })
    expect(hidden[0].thinking).toBe('Let me think')
    expect(hidden[0].thinkingVisible).toBe(false)
  })

  it('appends content after thinking is hidden', () => {
    const hidden = applyStreamEvent([{ ...base, thinking: 'thinking...', thinkingVisible: false }], { word: 'Hello world' })
    expect(hidden[0].content).toBe('Hello world')
    expect(hidden[0].thinkingVisible).toBe(false)
  })

  it('does not render any visible thinking state when thinking is empty and hidden', () => {
    const msg = { thinking: '', content: 'Hello', thinkingVisible: false }
    expect(msg.thinkingVisible).toBe(false)
  })
})

describe('formatTimestamp', () => {
  it('returns empty string for null/undefined', () => {
    expect(formatTimestamp(null)).toBe('')
    expect(formatTimestamp(undefined)).toBe('')
    expect(formatTimestamp('')).toBe('')
  })

  it('returns empty string for invalid dates', () => {
    expect(formatTimestamp('not-a-date')).toBe('')
  })

  it('returns a time string for valid ISO date', () => {
    const result = formatTimestamp('2024-06-15T09:30:00.000Z')
    expect(typeof result).toBe('string')
    expect(result.length).toBeGreaterThan(0)
  })
})

describe('extractSources', () => {
  it('returns empty array for falsy input', () => {
    expect(extractSources('')).toEqual([])
    expect(extractSources(null)).toEqual([])
  })

  it('extracts URLs from text', () => {
    const text = 'See https://example.com and https://other.org for details.'
    const result = extractSources(text)
    expect(result).toContain('https://example.com')
    expect(result).toContain('https://other.org')
  })

  it('deduplicates URLs', () => {
    const text = 'https://example.com and https://example.com again'
    expect(extractSources(text)).toHaveLength(1)
  })

  it('strips trailing punctuation', () => {
    const text = 'Visit https://example.com.'
    const result = extractSources(text)
    expect(result[0]).toBe('https://example.com')
  })
})

describe('dedupeSources', () => {
  it('removes duplicate entries', () => {
    const result = dedupeSources(['https://a.com', 'https://a.com', 'https://b.com'])
    expect(result).toEqual(['https://a.com', 'https://b.com'])
  })

  it('ignores empty/falsy entries', () => {
    const result = dedupeSources(['https://a.com', '', null, undefined])
    expect(result).toEqual(['https://a.com'])
  })
})

describe('formatVerificationLabel', () => {
  it('returns empty for null/invalid input', () => {
    expect(formatVerificationLabel(null)).toBe('')
    expect(formatVerificationLabel('string')).toBe('')
  })

  it('formats verified label', () => {
    const label = formatVerificationLabel({ status: 'verified', sourceCount: 3 })
    expect(label).toBe('Verification: verified (3 sources)')
  })

  it('uses singular for one source', () => {
    const label = formatVerificationLabel({ status: 'verified', sourceCount: 1 })
    expect(label).toBe('Verification: verified (1 source)')
  })

  it('formats weak label', () => {
    const label = formatVerificationLabel({ status: 'weak', sourceCount: 1 })
    expect(label).toBe('Verification: limited (1 source)')
  })

  it('formats unverified label', () => {
    const label = formatVerificationLabel({ status: 'unverified', sourceCount: 0 })
    expect(label).toBe('Verification: unverified')
  })

  it('returns empty for unknown status', () => {
    expect(formatVerificationLabel({ status: 'unknown', sourceCount: 0 })).toBe('')
  })
})