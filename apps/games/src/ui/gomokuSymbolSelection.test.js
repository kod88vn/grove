import { describe, it } from 'node:test'
import assert from 'node:assert'

describe('Gomoku Symbol Selection', () => {
  const AVAILABLE_SYMBOLS = [
    { emoji: '🦊', name: 'Fox' },
    { emoji: '🐼', name: 'Panda' },
    { emoji: '🐰', name: 'Bunny' },
    { emoji: '🦁', name: 'Lion' },
    { emoji: '🐯', name: 'Tiger' },
    { emoji: '🐻', name: 'Bear' },
    { emoji: '🐺', name: 'Wolf' },
    { emoji: '🦅', name: 'Eagle' },
    { emoji: '🐢', name: 'Turtle' },
    { emoji: '🦗', name: 'Cricket' },
  ]

  function getRandomAiSymbol(humanEmoji) {
    const available = AVAILABLE_SYMBOLS.filter((s) => s.emoji !== humanEmoji)
    return available[Math.floor(Math.random() * available.length)]
  }

  it('should have at least 10 available symbols', () => {
    assert.ok(AVAILABLE_SYMBOLS.length >= 10)
  })

  it('should not pick the same symbol as the human player', () => {
    const humanEmoji = '🦊'
    for (let i = 0; i < 100; i++) {
        const aiSymbol = getRandomAiSymbol(humanEmoji)
        assert.notStrictEqual(aiSymbol.emoji, humanEmoji)
    }
  })

  it('should pick a valid symbol from the available pool', () => {
    const humanEmoji = '🐼'
    const aiSymbol = getRandomAiSymbol(humanEmoji)
    assert.ok(AVAILABLE_SYMBOLS.some(s => s.emoji === aiSymbol.emoji))
  })
})
