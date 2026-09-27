// The package test script must actually discover the test files. `node --test src/`
// treats the directory as a single entry and runs zero tests, so CI stayed green
// while Gomoku tests failed.

import { describe, it } from 'node:test'
import assert from 'node:assert'
import { readFileSync } from 'node:fs'

const pkg = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8'))

describe('apps/games test script', () => {
  it('runs every *.test.js file under src via a glob', () => {
    assert.strictEqual(pkg.scripts.test, "node --test 'src/**/*.test.js'")
  })
})
