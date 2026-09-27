import { describe, it, beforeEach, afterEach, mock } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { JSDOM } from 'jsdom'

const dom = new JSDOM('<!doctype html><html><body></body></html>')
globalThis.window = dom.window
globalThis.document = dom.window.document
globalThis.IS_REACT_ACT_ENVIRONMENT = true

const { createElement, act, useState } = await import('react')
const { createRoot } = await import('react-dom/client')
const { useCountdown } = await import('./useCountdown.js')

// Renders the hook and exposes the latest timeLeft plus a way to re-render
// with new props, the way MathQuizGame re-renders on every keystroke.
function mountCountdown(initialProps) {
  const seen = { timeLeft: undefined }
  function Probe(props) {
    seen.timeLeft = useCountdown(props)
    return null
  }
  const container = document.createElement('div')
  const root = createRoot(container)
  const render = async (props) => {
    await act(async () => {
      root.render(createElement(Probe, props))
    })
  }
  return { seen, render, unmount: () => act(() => root.unmount()) }
}

async function advance(ms, onEachTick = async () => {}) {
  for (let elapsed = 0; elapsed < ms; elapsed += 50) {
    await act(async () => {
      mock.timers.tick(50)
    })
    await onEachTick()
  }
}

describe('useCountdown', () => {
  let mounted

  beforeEach(() => {
    mock.timers.enable({ apis: ['setTimeout', 'setInterval', 'Date'] })
  })

  afterEach(async () => {
    if (mounted) await mounted.unmount()
    mounted = null
    mock.timers.reset()
  })

  it('starts at the full duration and counts down in tenths of a second', async () => {
    mounted = mountCountdown({ duration: 10, running: true, resetKey: 1, onExpire: () => {} })
    await mounted.render({ duration: 10, running: true, resetKey: 1, onExpire: () => {} })
    assert.equal(mounted.seen.timeLeft, 10)

    await advance(1000)
    assert.equal(mounted.seen.timeLeft, 9)
  })

  it('keeps counting while the parent re-renders with a new onExpire on every keystroke', async () => {
    const props = () => ({ duration: 10, running: true, resetKey: 1, onExpire: () => {} })
    mounted = mountCountdown(props())
    await mounted.render(props())

    // A keystroke every 50ms re-renders the parent with a fresh callback.
    await advance(2000, () => mounted.render(props()))
    assert.equal(mounted.seen.timeLeft, 8)
  })

  it('calls onExpire exactly once when time runs out and stops at zero', async () => {
    const onExpire = mock.fn()
    mounted = mountCountdown({ duration: 1, running: true, resetKey: 1, onExpire })
    await mounted.render({ duration: 1, running: true, resetKey: 1, onExpire })

    await advance(1500)
    assert.equal(onExpire.mock.callCount(), 1)
    assert.equal(mounted.seen.timeLeft, 0)
  })

  it('calls the latest onExpire, so the answer typed so far is scored', async () => {
    const stale = mock.fn()
    const latest = mock.fn()
    mounted = mountCountdown({ duration: 1, running: true, resetKey: 1, onExpire: stale })
    await mounted.render({ duration: 1, running: true, resetKey: 1, onExpire: stale })
    await advance(500)
    await mounted.render({ duration: 1, running: true, resetKey: 1, onExpire: latest })

    await advance(1000)
    assert.equal(stale.mock.callCount(), 0)
    assert.equal(latest.mock.callCount(), 1)
  })

  it('restarts from the full duration when resetKey changes', async () => {
    mounted = mountCountdown({ duration: 10, running: true, resetKey: 1, onExpire: () => {} })
    await mounted.render({ duration: 10, running: true, resetKey: 1, onExpire: () => {} })
    await advance(3000)
    assert.equal(mounted.seen.timeLeft, 7)

    await mounted.render({ duration: 6, running: true, resetKey: 2, onExpire: () => {} })
    assert.equal(mounted.seen.timeLeft, 6)
    await advance(1000)
    assert.equal(mounted.seen.timeLeft, 5)
  })

  it('does not count down or expire while not running', async () => {
    const onExpire = mock.fn()
    mounted = mountCountdown({ duration: 1, running: false, resetKey: 1, onExpire })
    await mounted.render({ duration: 1, running: false, resetKey: 1, onExpire })

    await advance(2000)
    assert.equal(mounted.seen.timeLeft, 1)
    assert.equal(onExpire.mock.callCount(), 0)
  })

  // onExpire must run from a timer or effect, never inside a state updater:
  // updaters run during render, so an onExpire that sets another component's
  // state would trigger React's render-phase update warning.
  it('calls onExpire outside render, so it can update other components', async () => {
    const errors = []
    const spy = mock.method(console, 'error', (...args) => errors.push(String(args[0])))
    const seen = { parentExpiries: 0 }
    function Child({ onExpire }) {
      useCountdown({ duration: 0.3, running: true, resetKey: 1, onExpire })
      return null
    }
    function Parent() {
      const [expiries, setExpiries] = useState(0)
      seen.parentExpiries = expiries
      return createElement(Child, { onExpire: () => setExpiries((n) => n + 1) })
    }
    const root = createRoot(document.createElement('div'))
    mounted = { unmount: () => act(() => root.unmount()) }
    await act(async () => {
      root.render(createElement(Parent))
    })

    await advance(1000)
    spy.mock.restore()
    assert.equal(seen.parentExpiries, 1)
    assert.deepEqual(errors.filter((message) => message.includes('while rendering a different component')), [])
  })
})

describe('MathQuizGame timer wiring', () => {
  const source = readFileSync(new URL('./MathQuizGame.js', import.meta.url), 'utf8')

  it('drives its timer with useCountdown', () => {
    assert.match(source, /from '\.\/useCountdown\.js'/)
    assert.match(source, /useCountdown\(/)
  })

  it('no longer runs its own setTimeout countdown keyed on handleAnswer', () => {
    assert.doesNotMatch(source, /setTimeLeft/)
    assert.doesNotMatch(source, /\[timeLeft, gameState, handleAnswer\]/)
  })

  // handleAnswer's dependency list reads timeLeft during render, so the hook
  // call must come first or rendering throws "Cannot access before initialization".
  it('declares timeLeft before handleAnswer reads it', () => {
    const hookAt = source.indexOf('useCountdown({')
    const handleAnswerAt = source.indexOf('const handleAnswer')
    assert.ok(hookAt > 0 && handleAnswerAt > 0, 'both declarations exist')
    assert.ok(hookAt < handleAnswerAt, 'useCountdown must be called before handleAnswer is declared')
  })
})
