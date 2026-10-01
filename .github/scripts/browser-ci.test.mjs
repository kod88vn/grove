import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import path from 'node:path'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..')
const read = relative => readFileSync(path.join(root, relative), 'utf8')
const rootPackage = JSON.parse(read('package.json'))
const homeworks = JSON.parse(read('apps/homeworks/package.json'))
const workflow = read('.github/workflows/pr-ci.yml')

function step(name) {
  const match = workflow.match(new RegExp(`      - name: ${name}\\n([\\s\\S]*?)(?=      - name: |\\n  pr-review:)`))
  assert.ok(match, `missing CI step ${name}`)
  return match[1]
}

test('root declares the Playwright browser used by the browser spec at its locked version', () => {
  assert.equal(rootPackage.devDependencies.playwright, '1.60.0')
  assert.match(read('yarn.lock'), /^playwright@1\.60\.0(?:,|:)/m)
})

test('Homeworks offers a separate browser runner while ordinary Jest excludes it', () => {
  assert.match(homeworks.scripts['test:browser'] ?? '', /run-browser-test/)
  assert.doesNotMatch(homeworks.scripts.test, /browser|playwright/)
  assert.match(read('apps/homeworks/jest.config.cjs'), /testMatch:\s*\['<rootDir>\/\*\*\/\*\.test\.js'\]/)
  assert.doesNotMatch(read('apps/homeworks/jest.config.cjs'), /browser\.test\.cjs/)
})

test('browser runner refuses unsafe database configuration before starting Next', () => {
  const runner = read('apps/homeworks/scripts/run-browser-test.mjs')
  assert.match(runner, /readFile(?:Sync)?[\s\S]*lib\/db\.js/)
  assert.match(runner, /HOMEWORKS_DB_PATH/)
  assert.match(runner, /throw new Error\([\s\S]*HOMEWORKS_DB_PATH/)
  assert.ok(runner.indexOf('throw new Error') < runner.indexOf("spawn('yarn'"), 'check env support before spawning Next')
})

test('CI gates Chromium install and Homeworks browser execution on changed Homeworks files', () => {
  assert.ok(/homeworks=true.*GITHUB_OUTPUT|GITHUB_OUTPUT.*homeworks=true/.test(workflow), 'missing changed-homeworks CI output')
  const install = step('Install Chromium for Homeworks browser tests')
  const browser = step('Test Homeworks in Chromium')
  for (const gated of [install, browser]) {
    assert.match(gated, /if:\s*steps\.changed\.outputs\.homeworks == 'true'/)
  }
  assert.match(install, /npx playwright install --with-deps chromium/)
  assert.match(browser, /yarn workspace @grove\/homeworks test:browser/)
  const testIndex = workflow.indexOf('      - name: Test affected packages')
  assert.ok(testIndex >= 0 && workflow.indexOf('      - name: Install Chromium for Homeworks browser tests') > testIndex)
})
