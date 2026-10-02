import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import { mkdir, mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { test } from 'node:test'

const root = fileURLToPath(new URL('../..', import.meta.url))
const jest = resolve(root, 'node_modules/jest/bin/jest.js')
const config = resolve(root, 'apps/homeworks/jest.config.cjs')

test('review storage tests run without a pre-existing repository tmp directory', async () => {
  const isolated = await mkdtemp(resolve(tmpdir(), 'u19-fixture-portability-'))
  const cwd = resolve(isolated, 'nested', 'work')
  try {
    await mkdir(cwd, { recursive: true })
    const result = spawnSync(process.execPath, [
      jest, '--config', config, '--ci', '--runInBand', '--silent',
      'lib/contentReview.test.js',
    ], { cwd, encoding: 'utf8', timeout: 60_000 })
    assert.equal(result.status, 0, `${result.stderr}\n${result.stdout}`)
  } finally {
    await rm(isolated, { recursive: true, force: true })
  }
})