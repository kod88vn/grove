import test from 'node:test'
import assert from 'node:assert/strict'

import { GAME_SLUGS } from './index.js'
import { GAME_META, getGameModule } from './gameCatalog.js'

// Grove's assistant is called Nora. User-facing copy must say "Nora", never
// "AI" (the Gomoku card said "Get five in a row before the AI does.").

test('no game card copy says "AI"', () => {
  for (const slug of GAME_SLUGS) {
    const meta = GAME_META[slug]
    for (const field of ['label', 'title', 'summary']) {
      assert.doesNotMatch(meta[field], /\bAI\b/, `${slug}.${field} says "AI": ${meta[field]}`)
    }
  }
})

test('the Gomoku card names Nora as the opponent', () => {
  assert.equal(getGameModule('gomoku').summary, 'Get five in a row before Nora does.')
})
