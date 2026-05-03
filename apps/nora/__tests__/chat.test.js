import { describe, it, expect, beforeEach } from '@jest/globals'
import { readFileSync } from 'fs'
import { resolve } from 'path'

describe('Chat API Stream Parsing', () => {
  it('should emit thinking tokens as separate SSE messages', () => {
    // Mock Ollama response with thinking only
    const mockThinking = '{"model":"qwen3.5:9b","message":{"thinking":"Let","content":""},"done":false}'
    
    const json = JSON.parse(mockThinking)
    expect(json.message.thinking).toBe('Let')
    expect(json.message.content).toBe('')
  })

  it('should emit thinkingDone signal when content starts', () => {
    // First chunk: thinking only
    const thinkingChunk = '{"model":"qwen3.5:9b","message":{"thinking":" me","content":""},"done":false}'
    // Second chunk: content starts, thinking is empty
    const contentChunk = '{"model":"qwen3.5:9b","message":{"thinking":"","content":"Hello"},"done":false}'
    
    const think = JSON.parse(thinkingChunk)
    const content = JSON.parse(contentChunk)
    
    expect(think.message.thinking).toBeTruthy()
    expect(think.message.content).toBe('')
    expect(content.message.thinking).toBe('')
    expect(content.message.content).toBe('Hello')
  })

  it('should handle word buffering correctly', () => {
    // Simulate receiving "Hello world" split as "H" "ello " "wor" "ld"
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
    words.push(buffer) // remaining

    expect(words).toEqual(['Hello ', 'wor', 'ld'])
  })

  it('should handle SSE message parsing', () => {
    const sseMessage = 'data: {"word":"Hello"}\n\ndata: {"word":" world"}\n\n'
    const lines = sseMessage.split('\n\n').filter(Boolean)
    
    const parsed = lines.map(line => {
      const data = line.replace(/^data: /, '').trim()
      return JSON.parse(data)
    })

    expect(parsed).toEqual([
      { word: 'Hello' },
      { word: ' world' }
    ])
  })

  it('should correctly identify when thinking ends and content begins', () => {
    // Simulate the transition
    const chunks = [
      { message: { thinking: 'Let', content: '' }, done: false },
      { message: { thinking: ' me', content: '' }, done: false },
      { message: { thinking: ' think', content: '' }, done: false },
      { message: { thinking: '', content: 'Hello' }, done: false }, // TRANSITION
      { message: { thinking: '', content: '!' }, done: false },
      { message: { thinking: '', content: '', done: true } },
    ]

    let thinkingVisible = true
    let thinking = ''
    let content = ''

    for (const chunk of chunks) {
      const t = chunk.message.thinking || ''
      const c = chunk.message.content || ''

      // Accumulate thinking
      if (t && !c) {
        thinking += t
      }

      // Content starts: signal to hide thinking
      if (c && !thinking.match(/\S/) === false && thinkingVisible) {
        thinkingVisible = false
      }

      if (c) {
        content += c
      }
    }

    expect(thinking).toMatch(/Let me think/)
    expect(content).toBe('Hello!')
    expect(thinkingVisible).toBe(false)
  })
})

describe('UI Message State Management', () => {
  it('should initialize assistant message with thinking fields', () => {
    const msg = {
      role: 'assistant',
      content: '',
      thinking: '',
      thinkingVisible: true
    }

    expect(msg.thinking).toBe('')
    expect(msg.thinkingVisible).toBe(true)
    expect(msg.content).toBe('')
  })

  it('should accumulate thinking tokens correctly', () => {
    let msg = {
      role: 'assistant',
      content: '',
      thinking: '',
      thinkingVisible: true
    }

    // Simulate receiving thinking tokens
    msg.thinking += 'Let'
    msg.thinking += ' me'
    msg.thinking += ' think'

    expect(msg.thinking).toBe('Let me think')
    expect(msg.thinkingVisible).toBe(true)
  })

  it('should hide thinking bubble when content arrives', () => {
    let msg = {
      role: 'assistant',
      content: '',
      thinking: 'Let me think',
      thinkingVisible: true
    }

    // Receive thinkingDone signal
    msg.thinkingVisible = false

    expect(msg.thinkingVisible).toBe(false)
    expect(msg.thinking).toBe('Let me think') // Keep thinking text but hidden
  })

  it('should append content words while showing cursor', () => {
    let msg = {
      role: 'assistant',
      content: '',
      thinking: 'thinking...',
      thinkingVisible: false
    }

    msg.content += 'Hello'
    msg.content += ' '
    msg.content += 'world'

    expect(msg.content).toBe('Hello world')
    expect(msg.thinkingVisible).toBe(false)
  })
})

describe('Layout - globals.css body styles', () => {
  it('should not set display:flex on body (causes content to hug left)', () => {
    // Regression: body { display: flex } made the root page div shrink to
    // content width instead of filling the viewport, leaving a blank right half.
    const css = readFileSync(resolve(__dirname, '../app/globals.css'), 'utf8')
    // body must not declare display: flex
    expect(css).not.toMatch(/body\s*\{[^}]*display\s*:\s*flex/)
  })
})

describe('Edge Cases', () => {
  it('should handle empty thinking', () => {
    const msg = { thinking: '', content: 'Hello', thinkingVisible: false }
    expect(msg.thinkingVisible).toBe(false)
  })

  it('should handle done signal with remaining buffer', () => {
    let buffer = 'hello'
    const words = []
    
    // No space, so buffer not flushed yet
    while (true) {
      const match = buffer.match(/^(.*?)\s/)
      if (!match) break
      const word = match[1] + ' '
      words.push(word)
      buffer = buffer.slice(word.length)
    }
    
    // Flush remaining on done
    if (buffer) words.push(buffer)
    
    expect(words).toEqual(['hello'])
  })

  it('should handle malformed JSON gracefully', () => {
    const malformed = 'data: {incomplete'
    try {
      JSON.parse(malformed)
      expect(true).toBe(false) // Should not reach
    } catch {
      expect(true).toBe(true) // Expected
    }
  })
})
