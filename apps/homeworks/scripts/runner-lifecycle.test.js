const { spawn } = require('node:child_process')
const path = require('node:path')

const runnerPath = path.join(__dirname, 'run-browser-test.mjs')
const helperPath = path.join(__dirname, 'runner-lifecycle.mjs')
const watchdogMs = 7000

// The pre-extraction branch is the negative control: exercise the actual current
// stopServer/run bodies, not a stand-in that happens to exhibit the same hang.
const loadLifecycle = `
  import { readFileSync, existsSync } from 'node:fs';
  const helperPath = ${JSON.stringify(helperPath)};
  const runnerPath = ${JSON.stringify(runnerPath)};
  const runner = readFileSync(runnerPath, 'utf8');
  function oldFunction(name, following) {
    const start = runner.indexOf('function ' + name + '(');
    const end = runner.indexOf(following, start);
    if (start < 0 || end < 0) throw Error('Missing legacy ' + name);
    const asyncStart = runner.slice(start - 6, start) === 'async ' ? start - 6 : start;
    const declaration = runner.slice(asyncStart, end).trim();
    return new Function('spawn', 'process', 'return (' + declaration + ')')(spawn, process);
  }
  const lifecycle = existsSync(helperPath) ? await import(helperPath) : {
    stopServer: oldFunction('stopServer', '\\n\\nawait mkdir'),
    runBrowserChild: oldFunction('run', '\\n\\nasync function stopServer'),
  };
`

function executeScenario(script) {
  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, ['--input-type=module', '-e', script], {
      detached: true,
      stdio: ['ignore', 'pipe', 'pipe'],
      env: { ...process.env, NODE_OPTIONS: '' },
    })
    let stdout = ''
    let stderr = ''
    const watchdog = setTimeout(() => {
      const serverGroup = Number(stdout.match(/SPAWNED_GROUP_PID=(\d+)/)?.[1])
      if (serverGroup) {
        try { process.kill(-serverGroup, 'SIGKILL') } catch (error) {
          if (error.code !== 'ESRCH') reject(error)
        }
      }
      try { process.kill(-child.pid, 'SIGKILL') } catch (error) {
        if (error.code !== 'ESRCH') reject(error)
      }
    }, watchdogMs)
    child.stdout.on('data', chunk => { stdout += chunk })
    child.stderr.on('data', chunk => { stderr += chunk })
    child.once('error', reject)
    child.once('exit', (code, signal) => {
      clearTimeout(watchdog)
      resolve({ code, signal, stdout, stderr })
    })
  })
}

const serverScenario = (script, childPid) => `
  import { spawn } from 'node:child_process';
  ${loadLifecycle}
  const fakeServer = ${JSON.stringify(script)}.replaceAll('NODE_BIN', process.execPath);
  const server = spawn('sh', ['-c', fakeServer], {
    detached: true, stdio: ['ignore', 'pipe', 'pipe'],
  });
  console.log('SPAWNED_GROUP_PID=' + server.pid);
  let seen = '';
  const pid = await new Promise((resolve, reject) => {
    const startupTimer = setTimeout(() => reject(Error('fake server did not start: ' + fakeServer + ' exec=' + process.execPath + ' PATH=' + process.env.PATH + ' stderr=' + seen)), 2000);
    server.stdout.on('data', chunk => {
      seen += chunk.toString();
      const match = seen.match(/READY:(\\d+)/);
      if (match) {
        clearTimeout(startupTimer);
        resolve(Number(match[1]));
      }
    });
    server.stderr.on('data', chunk => { seen += chunk.toString() });
    server.once('error', reject);
  });
  await new Promise(resolve => setTimeout(resolve, 80));
  try {
    const started = Date.now();
    await lifecycle.stopServer(server, { timeoutMs: 350 });
    const elapsed = Date.now() - started;
    if (elapsed > 2500) throw Error('server shutdown exceeded 2.5s');
    console.log('STOP_ELAPSED_MS=' + elapsed);
    console.log('STOPPED_CHILD_PID=' + (${childPid} ? pid : server.pid));
  } finally {
    try { process.kill(-server.pid, 'SIGKILL'); } catch (error) {
      if (error.code !== 'ESRCH') throw error;
    }
    server.stdout.destroy();
    server.stderr.destroy();
  }
`

function expectPidGone(pid) {
  expect(pid).toBeGreaterThan(0)
  expect(() => process.kill(pid, 0)).toThrow(expect.objectContaining({ code: 'ESRCH' }))
}

describe('real browser runner child lifecycle', () => {
  test('cooperative server exits before the deadline without claiming SIGKILL escalation', async () => {
    const fakeServer = `exec NODE_BIN -e 'process.on("SIGTERM",()=>process.exit(0));console.log("READY:"+process.pid);setInterval(()=>{},1000)'`
    const result = await executeScenario(serverScenario(fakeServer, false))
    if (result.code !== 0) throw new Error(JSON.stringify(result))
    expect(result).toMatchObject({ code: 0, signal: null })
    expect(result.stderr).toContain('server SIGTERM sent')
    expect(result.stderr).toContain('server exited')
    expect(result.stderr).not.toContain('server SIGKILL escalation')
    expect(Number(result.stdout.match(/STOP_ELAPSED_MS=(\d+)/)?.[1])).toBeLessThan(350)
    expectPidGone(Number(result.stdout.match(/STOPPED_CHILD_PID=(\d+)/)?.[1]))
  }, 12000)

  test('terminates a shell-launched grandchild that ignores SIGTERM and holds stdout', async () => {
    const fakeServer = `NODE_BIN -e 'process.on("SIGTERM",()=>{});setInterval(()=>{},1000)' & kid=$!; printf 'READY:%s\\n' "$kid"; wait "$kid"`
    const result = await executeScenario(serverScenario(fakeServer, true))
    if (result.code !== 0) throw new Error(JSON.stringify(result))
    expect(result).toMatchObject({ code: 0, signal: null })
    expect(result.stderr).toContain('server SIGTERM sent')
    expect(result.stderr).toContain('server SIGKILL escalation')
    expect(result.stderr).toContain('server exited')
    expectPidGone(Number(result.stdout.match(/STOPPED_CHILD_PID=(\d+)/)?.[1]))
  }, 12000)

  test('escalates when the server itself ignores SIGTERM', async () => {
    const fakeServer = `exec NODE_BIN -e 'process.on("SIGTERM",()=>{});console.log("READY:"+process.pid);setInterval(()=>{},1000)'`
    const result = await executeScenario(serverScenario(fakeServer, false))
    if (result.code !== 0) throw new Error(JSON.stringify(result))
    expect(result).toMatchObject({ code: 0, signal: null })
    expect(result.stderr).toContain('server SIGKILL escalation')
    expect(result.stderr).toContain('server exited')
    expectPidGone(Number(result.stdout.match(/STOPPED_CHILD_PID=(\d+)/)?.[1]))
  }, 12000)

  test('a browser child that never exits fails the named stage within its deadline', async () => {
    const scenario = `
      import { spawn } from 'node:child_process';
      ${loadLifecycle}
      try {
        await lifecycle.runBrowserChild(process.execPath, ['-e', 'setInterval(()=>{},1000)'], {
          stdio: ['ignore', 'pipe', 'pipe'],
        }, { timeoutMs: 350 });
        throw Error('browser child was reported successful');
      } catch (error) {
        console.error('BROWSER_STAGE_FAILURE:' + error.message);
        process.exitCode = 1;
      }
    `
    const result = await executeScenario(scenario)
    expect(result.code).toBe(1)
    expect(result.signal).toBeNull()
    expect(result.stderr).toMatch(/BROWSER_STAGE_FAILURE:.*browser-test.*timeout/i)
  }, 12000)
})
