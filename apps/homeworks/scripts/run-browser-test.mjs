import { mkdir, readFile } from 'node:fs/promises'
import { spawn } from 'node:child_process'
import path from 'node:path'
import { setTimeout as delay } from 'node:timers/promises'
import { fileURLToPath } from 'node:url'
import { runBrowserChild, stopServer } from './runner-lifecycle.mjs'

const homeworksRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const repoRoot = path.resolve(homeworksRoot, '../..')
const scratchRoot = path.join(repoRoot, 'tmp')
const databasePath = path.join(scratchRoot, `homeworks-browser-${process.pid}-${Date.now()}.db`)
const url = 'http://localhost:3005/homeworks/dev/widgets'
const startupTimeoutMs = 60_000
const pollIntervalMs = 250
const browserTimeoutMs = 5 * 60_000

async function assertDatabasePathSupport() {
  const databaseModule = await readFile(path.join(homeworksRoot, 'lib/db.js'), 'utf8')
  if (!databaseModule.includes('process.env.HOMEWORKS_DB_PATH')) {
    throw new Error('HOMEWORKS_DB_PATH is no longer supported by apps/homeworks/lib/db.js')
  }
}

async function waitForServer(server) {
  const deadline = Date.now() + startupTimeoutMs
  let lastError
  while (Date.now() < deadline) {
    if (server.exitCode !== null || server.signalCode !== null) {
      throw new Error(`Next dev exited before startup (code ${server.exitCode ?? server.signalCode})`)
    }
    try {
      const response = await fetch(url)
      if (response.status === 200) {
        await delay(pollIntervalMs)
        if (server.exitCode === null && server.signalCode === null) return
        throw new Error(`Next dev exited after responding (code ${server.exitCode ?? server.signalCode})`)
      }
      lastError = new Error(`HTTP ${response.status}`)
    } catch (error) {
      lastError = error
    }
    await delay(pollIntervalMs)
  }
  throw new Error(`Timed out waiting for ${url}: ${lastError?.message ?? 'no response'}`)
}

await mkdir(scratchRoot, { recursive: true })
await assertDatabasePathSupport()
const server = spawn('yarn', ['dev'], {
  cwd: homeworksRoot,
  env: { ...process.env, HOMEWORKS_DB_PATH: databasePath },
  detached: true,
  stdio: ['ignore', 'pipe', 'pipe'],
})
server.stdout.pipe(process.stdout)
server.stderr.pipe(process.stderr)

try {
  await waitForServer(server)
  await runBrowserChild(process.execPath, ['components/widgets/NumberLineGeometry.browser.test.cjs'], {
    cwd: homeworksRoot,
    env: { ...process.env, HOMEWORKS_DB_PATH: databasePath },
    stdio: ['ignore', 'pipe', 'pipe'],
  }, { timeoutMs: browserTimeoutMs })
} finally {
  await stopServer(server, { timeoutMs: 1000 })
}