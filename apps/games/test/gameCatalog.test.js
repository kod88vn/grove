import test from 'node:test'
import assert from 'node:assert/strict'

import { GAME_SLUGS } from '../src/index.js'
import { getGameModule } from '../src/gameCatalog.js'

test('every game slug resolves to a real route module', () => {
  for (const slug of GAME_SLUGS) {
    const module = getGameModule(slug)
    assert.ok(module)
    assert.equal(module.slug, slug)
    assert.equal(typeof module.title, 'string')
    assert.equal(typeof module.summary, 'string')
  }
})

test('unknown slugs are rejected', () => {
  assert.equal(getGameModule('not-a-game'), null)
})