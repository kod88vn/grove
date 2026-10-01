import { execFile, spawn } from 'node:child_process'
import { setTimeout as delay } from 'node:timers/promises'
import { writeSync } from 'node:fs'
import { promisify } from 'node:util'

const execFileAsync = promisify(execFile)

function writeMarker(marker) {
  writeSync(2, `${marker}\n`)
}

function signalProcessGroup(server, signal) {
  try {
    process.kill(-server.pid, signal)
    return true
  } catch (error) {
    if (error.code === 'ESRCH') return false
    throw error
  }
}

function processGroupExists(pid) {
  try {
    process.kill(-pid, 0)
    return true
  } catch (error) {
    if (error.code === 'ESRCH') return false
    if (error.code === 'EPERM') return true
    throw error
  }
}

async function waitForProcessGroupExit(pid, timeoutMs) {
  const deadline = Date.now() + timeoutMs
  while (processGroupExists(pid) && Date.now() < deadline) {
    await delay(25)
  }
  return processGroupExists(pid)
}

async function processGroupHasLiveMember(pid) {
  try {
    const { stdout } = await execFileAsync('ps', ['-o', 'stat=', '-g', String(pid)])
    return stdout.split('\n').some(status => status.trim() && !status.trim().startsWith('Z'))
  } catch (error) {
    if (error.code === 'ESRCH' || error.code === 1) return false
    throw error
  }
}

export async function stopServer(server, { timeoutMs }) {
  const wasRunning = server.exitCode === null && server.signalCode === null
  let exitedBeforeDeadline = false
  const exited = wasRunning
    ? new Promise(resolve => server.once('exit', resolve))
    : Promise.resolve()
  let escalated = false
  signalProcessGroup(server, 'SIGTERM')
  writeMarker('server SIGTERM sent')
  if (wasRunning) {
    exitedBeforeDeadline = await Promise.race([
      exited.then(() => true),
      delay(timeoutMs).then(() => false),
    ])
    const hasLiveDescendant = exitedBeforeDeadline && await processGroupHasLiveMember(server.pid)
    if (processGroupExists(server.pid) && (!exitedBeforeDeadline || hasLiveDescendant)) {
      writeMarker('server SIGKILL escalation')
      signalProcessGroup(server, 'SIGKILL')
      escalated = true
    }
    await exited
  }
  if (escalated) await waitForProcessGroupExit(server.pid, Math.min(timeoutMs, 250))
  if (!exitedBeforeDeadline && !escalated && await waitForProcessGroupExit(server.pid, timeoutMs)) {
    writeMarker('server SIGKILL escalation')
    signalProcessGroup(server, 'SIGKILL')
  }
  writeMarker('server exited')
  server.stdout?.destroy()
  server.stderr?.destroy()
}

export function runBrowserChild(command, args, options, { timeoutMs }) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, options)
    child.stdout?.pipe(process.stdout)
    child.stderr?.pipe(process.stderr)
    let timedOut = false
    let escalation
    const timeout = setTimeout(() => {
      timedOut = true
      child.kill('SIGTERM')
      escalation = setTimeout(() => child.kill('SIGKILL'), 100)
    }, timeoutMs)

    child.once('error', reject)
    child.once('exit', (code, signal) => {
      clearTimeout(timeout)
      if (escalation) clearTimeout(escalation)
      child.stdout?.destroy()
      child.stderr?.destroy()
      if (timedOut) {
        reject(new Error(`browser-test timeout after ${timeoutMs}ms`))
        return
      }
      if (signal) {
        writeMarker(`browser-test exited signal=${signal}`)
        reject(new Error(`browser-test exited signal=${signal}`))
        return
      }
      writeMarker(`browser-test exited code=${code}`)
      if (code !== 0) {
        reject(new Error(`browser-test exited code=${code}`))
        return
      }
      resolve({ code, signal })
    })
  })
}