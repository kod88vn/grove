import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

import { scrambleWord } from './wordScramble.js'
import { HANGMAN_DICTIONARY } from './index.js'

// Word Scramble must never show the answer as the "scrambled" puzzle.
// A plain Fisher-Yates shuffle returns the original word whenever every swap
// is the identity (e.g. random() just below 1), and for short words that
// happens often: "AB" came back unscrambled half the time.

function seeded(seed) {
  let s = seed >>> 0
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0
    return s / 4294967296
  }
}

const RANDOM_SOURCES = {
  'always 0': () => 0,
  'always 0.5': () => 0.5,
  'always 0.999999 (every swap is the identity)': () => 0.999999,
  'seeded 1': seeded(1),
  'seeded 42': seeded(42),
}

const sorted = (w) => w.split('').sort().join('')

describe('scrambleWord — never returns the answer', () => {
  for (const [name, random] of Object.entries(RANDOM_SOURCES)) {
    for (const word of ['AB', 'CAT', 'AAB', 'ABAB', 'ZEBRA', 'BANANA', 'MISSISSIPPI']) {
      it(`${word} differs from the answer (${name})`, { timeout: 2000 }, () => {
        const out = scrambleWord(word, random)
        assert.notEqual(out, word, `scrambleWord returned the answer ${word}`)
        assert.equal(sorted(out), sorted(word), 'must use exactly the same letters')
      })
    }
  }

  it('every dictionary word at every level is scrambled, for every random source', { timeout: 5000 }, () => {
    for (const [level, entries] of Object.entries(HANGMAN_DICTIONARY)) {
      for (const { word } of entries) {
        for (const [name, random] of Object.entries(RANDOM_SOURCES)) {
          const out = scrambleWord(word, random)
          assert.notEqual(out, word, `${level} ${word} came back unscrambled (${name})`)
          assert.equal(sorted(out), sorted(word), `${level} ${word} lost letters (${name})`)
        }
      }
    }
  })

  it('defaults to Math.random and still never returns the answer', { timeout: 5000 }, () => {
    for (let i = 0; i < 500; i++) {
      const out = scrambleWord('AB')
      assert.equal(out, 'BA')
    }
  })
})

describe('scrambleWord — words that cannot be scrambled', () => {
  for (const word of ['', 'A', 'AAAA']) {
    it(`returns "${word}" unchanged without hanging`, { timeout: 2000 }, () => {
      assert.equal(scrambleWord(word, () => 0.999999), word)
      assert.equal(scrambleWord(word, () => 0), word)
    })
  }
})

describe('WordScrambleGame uses scrambleWord', () => {
  const source = readFileSync(new URL('./ui/WordScrambleGame.js', import.meta.url), 'utf8')

  it('imports scrambleWord from ../wordScramble.js', () => {
    assert.match(source, /import\s*\{\s*scrambleWord\s*\}\s*from\s*['"]\.\.\/wordScramble\.js['"]/)
  })

  it('scrambles the round word with scrambleWord', () => {
    assert.match(source, /setScrambled\(\s*scrambleWord\(\s*pick\.word\s*\)\s*\)/)
  })

  it('no longer has its own unguarded shuffle', () => {
    assert.doesNotMatch(source, /function\s+shuffle\s*\(/)
  })
})
