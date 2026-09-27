/**
 * P1.4 spec — problem templates are as pure as the engine and the catalog
 * (HOMEWORK_PLAN.md §6.1: "Pure JS, no React, no DB, no network"; §6.3: "NO eval / new
 * Function"; §6.2: "Ids are never reused").
 *
 * A problem is re-rendered from its seed on the server to grade it (§6.6), so a template that
 * reads the clock or a non-seeded random source would render a *different* problem at grade
 * time than the kid saw, and mark a correct answer wrong. Determinism is therefore a
 * correctness property, not a style preference.
 *
 * This mirrors `../engine/engine.purity.test.js` and `../catalog/catalog.purity.test.js`,
 * which make the same guarantee for the engine and the catalog.
 */
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readdirSync, readFileSync } from 'node:fs'

const problemsDir = new URL('./', import.meta.url)
const srcDir = new URL('../', import.meta.url)

/** Every non-test .js file under src/problems, as a URL. */
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

const sources = collect(problemsDir)
const relative = (url) => url.href.slice(srcDir.href.length)

test('the problems tree holds at least one template module', () => {
  assert.ok(sources.length > 0, 'src/problems has no template module')
})

test('template modules never use Math.random, the clock, eval or new Function', () => {
  const banned = [/Math\.random/, /\bDate\b/, /performance\.now/, /\beval\s*\(/, /\bFunction\s*\(/]
  for (const url of sources) {
    const code = readFileSync(url, 'utf8')
    for (const pattern of banned) {
      assert.doesNotMatch(code, pattern, `${relative(url)} uses ${pattern}`)
    }
  }
})

test('template modules import nothing from outside packages/curriculum/src', () => {
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

test('every template module exports a non-empty templates array', async () => {
  for (const url of sources) {
    const module = await import(url.href)
    assert.ok(Array.isArray(module.templates), `${relative(url)} does not export a templates array`)
    assert.ok(module.templates.length > 0, `${relative(url)} exports no templates`)
  }
})

// §6.2: "Ids are never reused; retire with `retired: true`." Uniqueness is the enforceable
// half of that rule, and it has to hold across the whole tree, not per file.
test('problem ids are unique across the whole problems tree', async () => {
  const seen = new Map()
  for (const url of sources) {
    const { templates } = await import(url.href)
    for (const template of templates) {
      assert.ok(!seen.has(template.id), `${template.id} is declared twice: ${seen.get(template.id)} and ${relative(url)}`)
      seen.set(template.id, relative(url))
    }
  }
})
