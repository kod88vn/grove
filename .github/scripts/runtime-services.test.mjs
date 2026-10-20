// The Platformatic runtime (`watt start`) loads every service in watt.json
// from the config file in its directory. A service directory without a
// platformatic.json/watt.json is auto-detected as a "generic Node.js
// application" and the runtime tries to import `@platformatic/node`; when
// that package is not an installed dependency the whole runtime exits FATAL
// and the app container crash-loops with nothing on :80 (regression:
// apps/orchestrator was added to watt.json without a config file and every
// deploy after the runtime started included it).
//
// Guard: every watt.json service must have a runtime config file in its
// directory, and services configured with the @platformatic/node module must
// declare it as a dependency of that application.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { existsSync, readFileSync } from 'node:fs'
import path from 'node:path'

const root = path.resolve(import.meta.dirname, '..', '..')
const watt = JSON.parse(readFileSync(path.join(root, 'watt.json'), 'utf8'))

test('every watt.json runtime service has a config file', () => {
  const missing = []
  for (const service of watt.services) {
    const dir = path.join(root, service.path)
    if (!existsSync(path.join(dir, 'platformatic.json')) && !existsSync(path.join(dir, 'watt.json'))) {
      missing.push(service.id)
    }
  }
  assert.deepEqual(
    missing,
    [],
    `watt.json services without a platformatic.json/watt.json config (runtime auto-detection FATALs): ${missing.join(', ')}`
  )
})

test('@platformatic/node services declare the module as a dependency', () => {
  const missing = []
  for (const service of watt.services) {
    const configPath = path.join(root, service.path, 'platformatic.json')
    if (!existsSync(configPath)) continue
    const config = JSON.parse(readFileSync(configPath, 'utf8'))
    const moduleMatch = (config.$schema ?? '').match(/@platformatic\/([a-z0-9-]+)/)
    if (moduleMatch?.[1] !== 'node') continue
    const app = JSON.parse(readFileSync(path.join(root, service.path, 'package.json'), 'utf8'))
    if (!Object.hasOwn(app.dependencies ?? {}, '@platformatic/node')) {
      missing.push(service.id)
    }
  }
  assert.deepEqual(
    missing,
    [],
    `services using @platformatic/node without the dependency declared: ${missing.join(', ')}`
  )
})
