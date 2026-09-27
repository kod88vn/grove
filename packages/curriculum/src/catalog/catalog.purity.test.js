/**
 * P1.3 spec — the catalog is as pure as the engine (HOMEWORK_PLAN.md §6.1: "Pure JS, no React,
 * no DB, no network"; §6.3: "NO eval / new Function").
 *
 * The catalog is metadata that a server route and the UI both read, and P1.6/P1.7 will render
 * and grade problems from it, so it must not reach the clock, a non-seeded random source, or
 * anything outside `packages/curriculum/src` — in particular not `apps/nora`, whose legacy
 * catalog is the *source* of the port but must not become a runtime dependency of it.
 *
 * This mirrors `../engine/engine.purity.test.js`, which makes the same guarantee for the engine.
 */
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readdirSync, readFileSync } from 'node:fs'

const catalogDir = new URL('./', import.meta.url)
const srcDir = new URL('../', import.meta.url)

/** Every non-test .js file under src/catalog, as a URL. */
const collect = (dir) => {
  const found = []
  for (const entry of readdirSync(dir, { withFileTypes: true }).sort((a, b) =>
    a.name < b.name ? -1 : 1,
  )) {
    if (entry.isDirectory()) found.push(...collect(new URL(`${entry.name}/`, dir)))
    else if (entry.name.endsWith('.js') && !entry.name.endsWith('.test.js')) {
      found.push(new URL(entry.name, dir))
    }
  }
  return found
}

const sources = collect(catalogDir)
const relative = (url) => url.href.slice(srcDir.href.length)

test('the Grade 5 maths catalog module exists', () => {
  assert.ok(
    sources.some((url) => relative(url) === 'catalog/math/grade-05.js'),
    `catalog/math/grade-05.js is missing; found ${sources.map(relative).join(', ') || 'nothing'}`,
  )
})

test('catalog modules never use Math.random, the clock, eval or new Function', () => {
  const banned = [/Math\.random/, /\bDate\b/, /performance\.now/, /\beval\s*\(/, /\bFunction\s*\(/]
  for (const url of sources) {
    const code = readFileSync(url, 'utf8')
    for (const pattern of banned) {
      assert.doesNotMatch(code, pattern, `${relative(url)} uses ${pattern}`)
    }
  }
})

test('catalog modules import nothing from outside packages/curriculum/src', () => {
  const specifier =
    /(?:\bimport\b[^'"]*?\bfrom\s*|\bimport\s*\(\s*|\bimport\s+|\brequire\s*\(\s*)['"]([^'"]+)['"]/g
  for (const url of sources) {
    const code = readFileSync(url, 'utf8')
    for (const [, target] of code.matchAll(specifier)) {
      assert.match(target, /^\.{1,2}\//, `${relative(url)} imports the bare specifier ${target}`)
      const resolved = new URL(target, url)
      assert.ok(
        resolved.href.startsWith(srcDir.href),
        `${relative(url)} imports ${target}, which escapes src/`,
      )
    }
  }
})
