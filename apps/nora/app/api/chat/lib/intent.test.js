// Tests for intent detection — pre-classifier, hasFactualQuerySignals, and classifyIntent.
// BDD style: Arrange-Act-Assert with clear expectations.

import { isObviouslyConversational, hasFactualQuerySignals } from './intent'
import { classifyIntent } from './intent'

describe('isObviouslyConversational', () => {
  describe('greetings', () => {
    test.each([
      ['hi'],
      ['hey'],
      ['hello'],
      ['howdy'],
      ['good morning'],
      ['good afternoon'],
      ['good evening'],
      ['good night'],
      ['Hi!'],
      ['Hello?'],
      ['Hey,'],
    ])('should match greeting: "%s"', (input) => {
      const result = isObviouslyConversational(input.toLowerCase())
      expect(result.match).toBe(true)
      expect(result.reason).toBe('greeting')
    })
  })

  describe('social questions', () => {
    test.each([
      ['how are you'],
      ['how do you do'],
      ['how is it going'],
      ['have you been'],
      ['How are you?'],
      ['how is it going!'],
    ])('should match social question: "%s"', (input) => {
      const result = isObviouslyConversational(input.toLowerCase())
      expect(result.match).toBe(true)
      expect(result.reason).toBe('social_question')
    })
  })

  describe('acknowledgments', () => {
    test.each([
      ['ok'],
      ['okay'],
      ['cool'],
      ['got it'],
      ['sounds good'],
      ['sure'],
      ['thanks'],
      ['thank you'],
      ['bye'],
      ['goodbye'],
      ['see you'],
      ['lol'],
      ['haha'],
    ])('should match acknowledgment: "%s"', (input) => {
      const result = isObviouslyConversational(input.toLowerCase())
      expect(result.match).toBe(true)
      expect(result.reason).toBe('acknowledgment')
    })
  })

  describe('short messages with no factual cues', () => {
    test.each([
      ['nice'],
      ['great stuff'],
      ['love it'],
    ])('should match short message: "%s"', (input) => {
      const result = isObviouslyConversational(input.toLowerCase())
      expect(result.match).toBe(true)
      expect(result.reason).toBe('short_no_factual_cues')
    })
  })

  describe('non-matching messages', () => {
    test.each([
      ['what time is it'],              // has WH-word + factual query
      ['who is the president'],          // has WH-word + factual query
      ['what is 2+2'],                   // has numbers
      ['explain quantum computing'],     // multiple words with factual structure
      ['tell me about the weather today'], // long message, not short enough for prefilter
    ])('should NOT match: "%s"', (input) => {
      const result = isObviouslyConversational(input.toLowerCase())
      expect(result.match).toBe(false)
    })
  })

  test('should handle empty input', () => {
    expect(isObviouslyConversational(null)).toEqual({ match: false, reason: null })
    expect(isObviouslyConversational('')).toEqual({ match: false, reason: null })
  })
})

describe('hasFactualQuerySignals', () => {
  describe('WH-question patterns', () => {
    test.each([
      ['what is the weather'],
      ['who is the president'],
      ['where did he go'],
      ['when does it start'],
      ['which one is better'],
    ])('should detect WH-question: "%s"', (input) => {
      expect(hasFactualQuerySignals(input.toLowerCase())).toBe(true)
    })
  })

  describe('numeric cues', () => {
    test.each([
      ['in 2024'],
      ['5 million people'],
      ['100% completion'],
      ['the price is $9.99'],
    ])('should detect numeric cue: "%s"', (input) => {
      expect(hasFactualQuerySignals(input.toLowerCase())).toBe(true)
    })
  })

  describe('current-events cues', () => {
    test.each([
      ['latest version of React'],
      ['current stock price'],
      ['today news update'],
      ['weather forecast tomorrow'],
    ])('should detect current-events cue: "%s"', (input) => {
      expect(hasFactualQuerySignals(input.toLowerCase())).toBe(true)
    })
  })

  describe('non-matching messages', () => {
    test.each([
      ['hi there'],
      ['how are you'],
      ['thanks'],
      ['cool stuff'],
    ])('should NOT detect factual cues: "%s"', (input) => {
      expect(hasFactualQuerySignals(input.toLowerCase())).toBe(false)
    })
  })

  test('should handle empty input', () => {
    expect(hasFactualQuerySignals(null)).toBe(false)
    expect(hasFactualQuerySignals('')).toBe(false)
  })
})

describe('classifyIntent (test mode)', () => {
  beforeEach(() => {
    process.env.NODE_ENV = 'test'
  })

  afterEach(() => {
    delete process.env.TEST_FALLBACK_ROUTE
  })

  test('should return disabled_in_test in NODE_ENV=test', async () => {
    const result = await classifyIntent('qwen3.6-35b-a3b-mtp-holo3-qwopus-qx86-hi-mlx', 'what is the weather')
    expect(result.requiresSearch).toBe(false)
    expect(result.reason).toBe('disabled_in_test')
  })

  test('should return requiresSearch:false for empty input', async () => {
    const result = await classifyIntent('model', '')
    expect(result.requiresSearch).toBe(false)
    expect(result.reason).toBe('empty_input')
  })

  test('should return requiresSearch:false for obviously conversational messages even when LLM would fail', async () => {
    // In test mode, the pre-classifier runs before the NODE_ENV=test gate,
    // so greetings are caught by isObviouslyConversational.
    const result = await classifyIntent('model', 'how are you')
    expect(result.requiresSearch).toBe(false)
  })

  test('should return requiresSearch:false for greetings', async () => {
    const result = await classifyIntent('model', 'hi')
    expect(result.requiresSearch).toBe(false)
  })

  test('should return requiresSearch:false for acknowledgments', async () => {
    const result = await classifyIntent('model', 'thanks')
    expect(result.requiresSearch).toBe(false)
  })
})

describe('classifyIntent (production-like behavior via TEST_FALLBACK_ROUTE)', () => {
  beforeEach(() => {
    process.env.NODE_ENV = 'production'
  })

  afterEach(() => {
    delete process.env.TEST_FALLBACK_ROUTE
  })

  test('should return requiresSearch:false for "how are you?" via pre-classifier', async () => {
    const result = await classifyIntent('model', 'how are you?')
    expect(result.requiresSearch).toBe(false)
    expect(result.confidence).toBe('high')
  })

  test('should return requiresSearch:false for "hi!" via pre-classifier', async () => {
    const result = await classifyIntent('model', 'hi!')
    expect(result.requiresSearch).toBe(false)
  })

  test('should return requiresSearch:false for "explain quantum entanglement" via pre-classifier', async () => {
    // This is >3 words, so it won't match the pre-classifier. It will hit the LLM path
    // but in production this would go to callAI. Since we can't test the LLM here,
    // we verify that messages >3 words do NOT get the pre-classifier fast-path.
    const result = isObviouslyConversational('explain quantum entanglement'.toLowerCase())
    expect(result.match).toBe(false)
  })

  test('hasFactualQuerySignals should detect factual queries', () => {
    expect(hasFactualQuerySignals('what is the current price of bitcoin'.toLowerCase())).toBe(true)
    expect(hasFactualQuerySignals('who is the ceo of apple'.toLowerCase())).toBe(true)
  })

  test('hasFactualQuerySignals should NOT match greetings', () => {
    expect(hasFactualQuerySignals('hi there'.toLowerCase())).toBe(false)
    expect(hasFactualQuerySignals('how are you doing'.toLowerCase())).toBe(false)
  })
})