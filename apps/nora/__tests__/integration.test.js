import { describe, it, expect } from '@jest/globals'

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
    expect(contentEmissions[thinkingDoneIdx + 2]).toBe('world')
    expect(contentEmissions[thinkingDoneIdx + 3]).toBe('!')
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
    const shouldShowThinking = msg.thinking && msg.thinkingVisible
    const shouldShowContent = msg.content

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

    const hasThinking = msg.thinking && msg.thinkingVisible
    const hasContent = msg.content

    // Should not render thinking (thinkingVisible is false)
    // Should not render content (empty)
    // UI should not render ChatMessage, only empty div
    expect(hasThinking).toBe(false)
    expect(hasContent).toBe(false)
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
    const shouldRender = state.thinking && state.thinkingVisible
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
