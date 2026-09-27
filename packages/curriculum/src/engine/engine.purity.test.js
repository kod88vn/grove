/**
 * P1.2: the engine is pure and deterministic (HOMEWORK_PLAN §6.1: "Pure JS, no React, no DB, no
 * network"; §6.3: "NO eval / new Function").
 *
 * A problem is re-rendered from its seed on the server to grade it, so nothing in the engine may
 * read the clock, a non-seeded random source, or anything outside the package.
 */
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readdirSync, readFileSync } from 'node:fs'

const dir = new URL('./', import.meta.url)
const sources = readdirSync(dir)
  .filter((name) => name.endsWith('.js') && !name.endsWith('.test.js'))
  .sort()

test('the engine has rng.js, fraction.js, render.js and check.js', () => {
  for (const name of ['check.js', 'fraction.js', 'render.js', 'rng.js']) {
    assert.ok(sources.includes(name), `${name} is missing`)
  }
})

test('engine modules never use Math.random, the clock, eval or new Function', () => {
  const banned = [/Math\.random/, /\bDate\b/, /performance\.now/, /\beval\s*\(/, /\bFunction\s*\(/]
  for (const name of sources) {
    const code = readFileSync(new URL(name, dir), 'utf8')
    for (const pattern of banned) {
      assert.doesNotMatch(code, pattern, `${name} uses ${pattern}`)
    }
  }
})

test('engine modules import only sibling engine modules', () => {
  const specifier = /(?:\bimport\b[^'"]*?\bfrom\s*|\bimport\s*\(\s*|\bimport\s+|\brequire\s*\(\s*)['"]([^'"]+)['"]/g
  for (const name of sources) {
    const code = readFileSync(new URL(name, dir), 'utf8')
    for (const [, target] of code.matchAll(specifier)) {
      assert.match(target, /^\.\/[\w.-]+\.js$/, `${name} imports ${target}`)
    }
  }
})
