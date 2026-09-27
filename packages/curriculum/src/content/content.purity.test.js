/**
 * P1.5 spec — the content tree is as pure as the engine, the catalog and the problems tree
 * (HOMEWORK_PLAN.md §6.1: "Pure JS, no React, no DB, no network"; §6.3: "NO eval / new
 * Function").
 *
 * `src/content/` is the reviewed English content §6.1 reserves — item banks now, passages
 * later. A server route re-renders a problem from its seed to grade it (§6.6), so a bank that
 * read the clock or a non-seeded random source would serve one item and grade another. It is
 * also the tree a parent reads before ticking a review box, which only works if it is plain
 * data: an import of `apps/nora`, a network call or a `new Function` would put content in it
 * that no reviewer can see.
 *
 * This mirrors `../catalog/catalog.purity.test.js` and `../problems/problems.purity.test.js`,
 * which make the same guarantee for their trees, and it carries the end-of-file rule from
 * `../problems/problems.eof.test.js` for the same reason: the tree is new, so it costs nothing
 * to start it clean.
 */
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readdirSync, readFileSync } from 'node:fs'

const contentDir = new URL('./', import.meta.url)
const srcDir = new URL('../', import.meta.url)

/** Every non-test .js file under src/content, as a URL. */
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

const sources = collect(contentDir)
const relative = (url) => url.href.slice(srcDir.href.length)

test('the Grade 5 context-clues item bank is in the content tree', () => {
  assert.ok(
    sources.some((url) => relative(url) === 'content/english/items/g05/context-clues.js'),
    `the bank is missing; found ${sources.map(relative).join(', ') || 'nothing'}`,
  )
})

test('content modules never use Math.random, the clock, eval or new Function', () => {
  const banned = [/Math\.random/, /\bDate\b/, /performance\.now/, /\beval\s*\(/, /\bFunction\s*\(/]
  for (const url of sources) {
    const code = readFileSync(url, 'utf8')
    for (const pattern of banned) {
      assert.doesNotMatch(code, pattern, `${relative(url)} uses ${pattern}`)
    }
  }
})

test('content modules import nothing from outside packages/curriculum/src', () => {
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

test('every file in the content tree ends with exactly one newline', () => {
  const all = []
  const walk = (dir) => {
    for (const entry of readdirSync(dir, { withFileTypes: true }).sort((a, b) =>
      a.name < b.name ? -1 : 1,
    )) {
      if (entry.isDirectory()) walk(new URL(`${entry.name}/`, dir))
      else if (entry.name.endsWith('.js')) all.push(new URL(entry.name, dir))
    }
  }
  walk(contentDir)
  assert.ok(all.length > 0, 'the content tree is empty')
  for (const url of all) {
    const text = readFileSync(url, 'utf8')
    assert.ok(text.endsWith('\n'), `${relative(url)} does not end with a newline`)
    assert.ok(!text.endsWith('\n\n'), `${relative(url)} ends with a blank line`)
  }
})
