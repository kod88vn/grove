/**
 * P1.1: the @grove/curriculum package exists and resolves by its own name.
 *
 * HOMEWORK_PLAN.md §6.1: "type": "module", "exports": { ".": "./src/index.js" } and
 * "test": "node --test", like packages/grove-shell, with no test dependencies. Without the
 * exports entry Node looks for a root index.js and `import '@grove/curriculum'` fails.
 * The package is pure JS: no React, no DB, no network, so it has no dependencies.
 */
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

import * as byName from '@grove/curriculum'
import * as byPath from './index.js'

const pkg = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8'))

test('importing @grove/curriculum by name loads src/index.js', () => {
  assert.equal(byName, byPath)
})

test('package.json is a private ES module package with one exports entry and node --test', () => {
  assert.equal(pkg.name, '@grove/curriculum')
  assert.equal(pkg.private, true)
  assert.equal(pkg.type, 'module')
  assert.deepEqual(pkg.exports, { '.': './src/index.js' })
  assert.equal(pkg.scripts.test, 'node --test')
})

test('package.json declares no dependencies of any kind', () => {
  for (const field of ['dependencies', 'devDependencies', 'peerDependencies', 'optionalDependencies']) {
    assert.equal(pkg[field], undefined, `${field} must be absent`)
  }
})
