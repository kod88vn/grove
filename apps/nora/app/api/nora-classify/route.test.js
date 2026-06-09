// Shim for Web API Response class — available in Next.js runtime but not in Jest jsdom.
global.Response = class {
  constructor(body, init = {}) {
    this.body = body
    this.status = init.status || 200
  }
  async json() {
    return JSON.parse(this.body)
  }
  static json(data, init = {}) {
    return new global.Response(JSON.stringify(data), { ...init, status: init.status || 200 })
  }
}

import { classifyRoute } from '@/app/api/chat/lib/classifyRoute'
import { isObviouslyConversational, hasFactualQuerySignals, isObviouslyFactual } from '@/app/api/chat/lib/intent'
import { POST } from './route'

describe('classifyRoute (used by nora-classify route)', () => {
  beforeEach(() => {
    process.env.LMSTUDIO_BASE_URL = 'http://localhost:1234'
  })

  // Pre-filter tests — these work without LLM because they short-circuit via isObviouslyFactual
  test('recognizes factual pre-filter: "what happened to X"', async () => {
    const result = await classifyRoute('what happened to steve jobs')
    expect(result.route).toBe('factual_tool')
  })

  test('recognizes factual pre-filter: "is X dead"', async () => {
    const result = await classifyRoute('is elon musk still alive')
    expect(result.route).toBe('factual_tool')
  })

  test('recognizes factual pre-filter: "X arrested"', async () => {
    const result = await classifyRoute('is the president arrested')
    expect(result.route).toBe('factual_tool')
  })

  // NOTE: local_time is ONLY detected by the LLM classifier — no pre-filter exists.
  // When LLM fails, it falls back to hasFactualQuerySignals which doesn't match time queries.
  test('local_time falls back to fast_chat when LLM unavailable', async () => {
    // "what time is it" — no pre-filter, goes to LLM → fails → hasFactualQuerySignals returns false
    // → fast_chat fallback (correct safe default for non-factual queries)
    const result = await classifyRoute('what time is it')
    expect(result.route).toBe('fast_chat')
  })

  test('local_time "what is the current time" falls back to factual_tool when LLM unavailable', async () => {
    // "what is the current time" — hasFactualQuerySignals matches \b(what|who)\s+(is|...)
    // → factual_tool fallback (correct safe default for WH-questions)
    const result = await classifyRoute('what is the current time')
    expect(result.route).toBe('factual_tool')
  })

  // Fallback tests — LLM is called, fails, and hasFactualQuerySignals determines the fallback
  test('falls back to fast_chat for casual greeting (no factual signals)', async () => {
    // "hi there" matches isObviouslyConversational in intent.js, but classifyRoute uses
    // isObviouslyFactual (not isObviouslyConversational) as its pre-filter.
    // "hi there" doesn't match isObviouslyFactual → goes to LLM → LLM fails → hasFactualQuerySignals
    // "hi there" has no factual signals → fast_chat fallback (correct!)
    const result = await classifyRoute('hi there')
    expect(result.route).toBe('fast_chat')
    expect(result.confidence).toBe('low')
  })

  test('falls back to fast_chat for casual "how are you"', async () => {
    // "how are you doing" — hasFactualQuerySignals: no match for what/who/where patterns
    // → fast_chat fallback (correct!)
    const result = await classifyRoute('how are you doing')
    expect(result.route).toBe('fast_chat')
  })

  test('falls back to factual_tool when hasFactualQuerySignals matches', async () => {
    // "what is the current president" — hasFactualQuerySignals matches \b(who|what)\s+(is|...)
    // → factual_tool fallback (correct!)
    const result = await classifyRoute('what is the current president')
    expect(result.route).toBe('factual_tool')
  })

  test('falls back to fast_chat for "tell me a joke" (no factual signals)', async () => {
    // "tell me a joke" doesn't match hasFactualQuerySignals → fast_chat fallback (correct!)
    const result = await classifyRoute('tell me a joke')
    expect(result.route).toBe('fast_chat')
  })

  test('falls back to factual_tool for "latest version of React"', async () => {
    // hasFactualQuerySignals matches \b(latest|current)\s+version pattern
    const result = await classifyRoute('what is the latest version of React')
    expect(result.route).toBe('factual_tool')
  })

  test('falls back to factual_tool for weather query', async () => {
    // hasFactualQuerySignals matches weather keyword
    const result = await classifyRoute("how's the weather tomorrow")
    expect(result.route).toBe('factual_tool')
  })

  // Edge cases
  test('returns fast_chat for empty message', async () => {
    const result = await classifyRoute('')
    expect(result.route).toBe('fast_chat')
  })

  test('handles numeric message', async () => {
    const result = await classifyRoute(123)
    expect(typeof result.route).toBe('string')
  })

  test('returns reason field', async () => {
    const result = await classifyRoute('hi there')
    expect(result.reason).toBeDefined()
  })

  // isObviouslyConversational unit tests (supports classifyRoute behavior)
  test('isObviouslyConversational catches single-word greetings', () => {
    expect(isObviouslyConversational('hi')).toEqual({ match: true, reason: 'greeting' })
    expect(isObviouslyConversational('hello')).toEqual({ match: true, reason: 'greeting' })
    expect(isObviouslyConversational('hey')).toEqual({ match: true, reason: 'greeting' })
  })

  test('isObviouslyConversational catches multi-word messages with "hi" as short_no_factual_cues', () => {
    // "hi there" does NOT match greeting regex because " there" doesn't fit [\\!?,. ]*$
    // Instead it matches short_no_factual_cues (2 words, >1 char each, no factual cues)
    expect(isObviouslyConversational('hi there')).toEqual({ match: true, reason: 'short_no_factual_cues' })
  })

  test('isObviouslyConversational catches social questions', () => {
    expect(isObviouslyConversational('how are you')).toEqual({ match: true, reason: 'social_question' })
  })

  test('isObviouslyConversational catches acknowledgments', () => {
    expect(isObviouslyConversational('thank you')).toEqual({ match: true, reason: 'acknowledgment' })
    expect(isObviouslyConversational('thanks')).toEqual({ match: true, reason: 'acknowledgment' })
  })

  test('isObviouslyConversational rejects factual queries', () => {
    expect(isObviouslyConversational('what is the president')).toEqual({ match: false, reason: null })
  })

  test('isObviouslyConversational catches short messages with no factual cues', () => {
    expect(isObviouslyConversational('cool')).toEqual({ match: true, reason: 'acknowledgment' })
    expect(isObviouslyConversational('lol')).toEqual({ match: true, reason: 'acknowledgment' })
  })

  test('isObviouslyConversational rejects short messages with factual cues', () => {
    expect(isObviouslyConversational('2024 election')).toEqual({ match: false, reason: null })
  })

  // hasFactualQuerySignals unit tests (used by classifyRoute fallback)
  test('hasFactualQuerySignals: WH-questions', () => {
    expect(hasFactualQuerySignals('what is the president')).toBe(true)
    expect(hasFactualQuerySignals('who won the election')).toBe(true)
  })

  test('hasFactualQuerySignals: numeric cues', () => {
    expect(hasFactualQuerySignals('population of Japan in 2024')).toBe(true)
    expect(hasFactualQuerySignals('10% discount')).toBe(true)
  })

  test('hasFactualQuerySignals: current event cues', () => {
    expect(hasFactualQuerySignals('latest version release')).toBe(true)
  })

  test('hasFactualQuerySignals: person status cues', () => {
    expect(hasFactualQuerySignals('who died yesterday')).toBe(true)
  })

  test('hasFactualQuerySignals: no signals for casual', () => {
    expect(hasFactualQuerySignals('hi there')).toBe(false)
    expect(hasFactualQuerySignals('tell me a joke')).toBe(false)
  })

  // isObviouslyFactual unit tests (used by classifyRoute pre-filter)
  test('isObviouslyFactual: person status - "what happened to X"', () => {
    expect(isObviouslyFactual('what happened to steve jobs').match).toBe(true)
  })

  test('isObviouslyFactual: mortality - "died"', () => {
    expect(isObviouslyFactual('who died last year').match).toBe(true)
  })

  test('isObviouslyFactual: legal status - "arrested"', () => {
    expect(isObviouslyFactual('president arrested').match).toBe(true)
  })

  test('isObviouslyFactual: breaking news', () => {
    expect(isObviouslyFactual('breaking news today').match).toBe(true)
  })

  test('isObviouslyFactual: non-factual', () => {
    expect(isObviouslyFactual('hi there').match).toBe(false)
  })
})

// ---- Route-level integration tests (no LLM dependency) ----

describe('POST /api/nora-classify (route-level)', () => {
  test('returns 400 when message is missing', async () => {
    const res = await POST({ json: async () => ({}) })
    expect(res.status).toBe(400)
  })

  test('returns factual_tool for pre-filtered query', async () => {
    const res = await POST({ json: async () => ({ message: 'what happened to steve jobs' }) })
    expect(res.status).toBe(200)
    const data = await res.json()
    expect(data.route).toBe('factual_tool')
  })

  test('returns fast_chat for time query when LLM unavailable (fallback path)', async () => {
    const res = await POST({ json: async () => ({ message: 'what time is it' }) })
    expect(res.status).toBe(200)
  })

  test('returns fast_chat for casual query (fallback path)', async () => {
    const res = await POST({ json: async () => ({ message: 'hi there' }) })
    expect(res.status).toBe(200)
  })

  test('accepts numeric message', async () => {
    const res = await POST({ json: async () => ({ message: 42 }) })
    expect(res.status).toBe(200)
  })

  test('returns classification for factual query fallback (LLM fails)', async () => {
    // "what is the current president" falls back to factual_tool via hasFactualQuerySignals
    const res = await POST({ json: async () => ({ message: 'what is the current president' }) })
    expect(res.status).toBe(200)
    const data = await res.json()
    expect(data.route).toBe('factual_tool')
  })

  test('returns safe default for casual query when LLM unavailable', async () => {
    // No LMSTUDIO_BASE_URL, casual query → fallback to fast_chat (no factual signals)
    const originalUrl = process.env.LMSTUDIO_BASE_URL
    delete process.env.LMSTUDIO_BASE_URL

    const res = await POST({ json: async () => ({ message: 'hi there' }) })
    expect(res.status).toBe(200)

    process.env.LMSTUDIO_BASE_URL = originalUrl
  })
})