// The Dockerfile deps stage copies only package manifests (one per workspace)
// so the `yarn install` layer caches across source-only changes. Workspace
// packages resolve locally only when their manifest is in the build context;
// a missing manifest makes yarn fall back to the npm registry and the image
// build fails (regression: packages/curriculum was added without its COPY
// line and every grove-host deploy failed on `yarn install`).
//
// Guard: every workspace directory that contains a package.json must have a
// matching COPY line in the Dockerfile.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { existsSync, readFileSync, readdirSync } from 'node:fs'
import path from 'node:path'

const root = path.resolve(import.meta.dirname, '..', '..')
const dockerfile = readFileSync(path.join(root, 'Dockerfile'), 'utf8')

const workspaces = JSON.parse(readFileSync(path.join(root, 'package.json'), 'utf8')).workspaces
const dirs = workspaces
  .filter((pattern) => !pattern.includes('*'))
  .concat(workspaces.filter((pattern) => pattern.endsWith('/*')).map((p) => p.slice(0, -2)))

test('Dockerfile deps stage copies every workspace manifest', () => {
  const missing = []
  for (const dir of dirs) {
    for (const name of readdirSync(path.join(root, dir), { withFileTypes: true })) {
      if (!name.isDirectory()) continue
      const manifest = path.join(root, dir, name.name, 'package.json')
      if (!existsSync(manifest)) continue
      if (!dockerfile.includes(`COPY ${dir}/${name.name}/package.json `)) {
        missing.push(`${dir}/${name.name}`)
      }
    }
  }
  assert.deepEqual(missing, [], `Dockerfile is missing COPY lines for workspace manifests: ${missing.join(', ')}`)
})
