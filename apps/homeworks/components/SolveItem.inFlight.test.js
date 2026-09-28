/**
 * PR #84 review, thread 3 — one press of Check, one attempt.
 *
 * `Check ✅` is `disabled={solved}`, and `solved` only becomes true once the POST has come
 * back. Between the press and the response the button is live, so a child who double-taps
 * — and children do — sends the same answer twice. The second request is not harmless:
 * `app/api/attempts/route.js:49-51` answers **409** once the item is done, `postJson`
 * throws on a non-ok response, and the catch in `SolveItem.js:48-51` runs
 * `setAttempt(null)` without looking at the status. Measured on this branch: the stars,
 * the worked solution and "Great work!" were all on screen after the 200 and all gone
 * after the 409, replaced by the retry message. The child solved it and was told they had
 * not.
 *
 * `💡 Hint` has the identical gap, and it costs more than a repaint: `POST /hints` calls
 * `incrementSessionItemHints` on every request, and `hints_used` feeds the star rule in
 * `app/api/attempts/route.js:63-68`. Measured on this branch, two taps burned two hints,
 * revealed both at once and jumped the counter to 2 — quietly costing a star. One root
 * cause, one fix, so both buttons are specified here.
 *
 * What is pinned is what the child sees and what the server is asked to do. The mechanism
 * is free: a ref, a piece of state or a disabled attribute all pass, provided a second
 * press while a request is outstanding reaches no route and destroys no solved state.
 *
 * THE OBVIOUS OVERCORRECTION IS PINNED TOO. A guard that never releases would leave Check
 * dead after a wrong answer and the child unable to try again, and would cap hints at one
 * forever. Both of those are tests below, and both pass today — they must still pass after.
 */
import { afterEach, beforeEach, describe, expect, it, jest } from '@jest/globals'
import '@testing-library/jest-dom'
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react'

import { getProblem, listProblems, render as renderProblem, toInstance } from '@grove/curriculum'

import { SolveItem } from './SolveItem'

const SESSION = 'sess-inflight'
const SEED = 4242
const ATTEMPTS = '/homeworks/api/attempts'
const HINTS = '/homeworks/api/hints'
const HEADING = 'How Nora solved it'
const RETRY = "Nora couldn't check that right now"

const PROBLEM = listProblems().find((problem) => problem.widget === 'number').id
const full = () => renderProblem(getProblem(PROBLEM), SEED)
const instance = () => toInstance(full())

/**
 * A server that answers nothing until it is told to. Requests queue in arrival order, so a
 * test can land two clicks while the first is still outstanding — which is the whole point.
 */
function gatedServer(handler) {
  const calls = []
  const gates = []

  const fn = jest.fn(async (url, options = {}) => {
    const body = options.body ? JSON.parse(options.body) : null
    const index = calls.filter((call) => call.url === url).length
    calls.push({ url, body })
    await new Promise((resolve) => { gates.push(resolve) })
    const next = handler(url, index)
    return { ok: (next.status ?? 200) < 400, status: next.status ?? 200, json: async () => next.body }
  })

  fn.calls = calls
  fn.to = (url) => calls.filter((call) => call.url === url)
  /**
   * Settles each request completely before releasing the next. The real routes are
   * synchronous better-sqlite3 handlers on a single-threaded server, so request 2 cannot
   * see the item marked done until request 1 has finished — releasing them together would
   * model an ordering the server cannot produce.
   */
  fn.release = async () => {
    while (gates.length) {
      gates.shift()()
      for (let i = 0; i < 3; i += 1) {
        // eslint-disable-next-line no-await-in-loop
        await act(async () => { await Promise.resolve() })
      }
    }
  }
  return fn
}

/** Exactly what the real routes send: the item is done, so a repeat attempt is a 409. */
const attemptsHandler = (index) => (index === 0
  ? { body: { correct: true, stars: 3, feedback: 'Great work!', explanation: full().explanation, skillState: null } }
  : { status: 409, body: { error: 'Session item is already done' } })

/** Every hint request burns a hint, so a repeat costs the child a real one. */
const hintsHandler = (index) => ({ body: { hint: full().hints[index], hintsUsed: index + 1 } })

const bothRoutes = (url, index) => (url === ATTEMPTS ? attemptsHandler(index) : hintsHandler(index))

const checkButton = () => screen.getByRole('button', { name: /Check/ })
const hintButton = () => screen.getByRole('button', { name: /Hint/ })

function mount(fetchFn) {
  global.fetch = fetchFn
  const view = render(<SolveItem sessionId={SESSION} instance={instance()} onSolved={() => {}} />)
  const { answer } = full()
  fireEvent.change(screen.getByLabelText('Your answer'), { target: { value: String(answer.value) } })
  return view
}

beforeEach(() => {
  jest.spyOn(console, 'error').mockImplementation(() => {})
})

afterEach(() => {
  jest.restoreAllMocks()
  delete global.fetch
})

describe('Check ✅ survives a double-tap', () => {
  it('sends one attempt, however many times the child presses', async () => {
    const server = gatedServer(bothRoutes)
    mount(server)

    fireEvent.click(checkButton())
    fireEvent.click(checkButton())
    fireEvent.click(checkButton())

    expect(server.to(ATTEMPTS)).toHaveLength(1)
    await server.release()
  })

  it('keeps the stars a double-tap used to erase', async () => {
    const server = gatedServer(bothRoutes)
    mount(server)

    fireEvent.click(checkButton())
    fireEvent.click(checkButton())
    await server.release()

    expect(screen.getByLabelText('3 of 3 stars')).toBeInTheDocument()
  })

  it('keeps the worked solution and the verdict a double-tap used to erase', async () => {
    const server = gatedServer(bothRoutes)
    mount(server)

    fireEvent.click(checkButton())
    fireEvent.click(checkButton())
    await server.release()

    expect(screen.getByText(HEADING)).toBeInTheDocument()
    expect(screen.getByText(full().explanation)).toBeInTheDocument()
    expect(screen.getByText('Great work!')).toBeInTheDocument()
  })

  it('never tells a child who solved it that it could not be checked', async () => {
    const server = gatedServer(bothRoutes)
    mount(server)

    fireEvent.click(checkButton())
    fireEvent.click(checkButton())
    await server.release()

    expect(screen.queryByText(RETRY)).not.toBeInTheDocument()
  })

  it('lets the child try again after a wrong answer', async () => {
    const server = gatedServer(() => ({
      body: { correct: false, stars: 0, feedback: 'Keep going—you can try again!', skillState: null },
    }))
    mount(server)

    fireEvent.click(checkButton())
    await server.release()

    expect(checkButton()).toBeEnabled()
    fireEvent.click(checkButton())
    expect(server.to(ATTEMPTS)).toHaveLength(2)
    await server.release()
  })

  it('still reports a genuine failure', async () => {
    const server = gatedServer(() => ({ status: 500, body: { error: 'boom' } }))
    mount(server)

    fireEvent.click(checkButton())
    await server.release()

    await waitFor(() => expect(screen.getByText(RETRY)).toBeInTheDocument())
    expect(checkButton()).toBeEnabled()
  })
})

describe('💡 Hint survives a double-tap', () => {
  it('burns one hint, however many times the child presses', async () => {
    const server = gatedServer(bothRoutes)
    mount(server)

    fireEvent.click(hintButton())
    fireEvent.click(hintButton())
    fireEvent.click(hintButton())

    expect(server.to(HINTS)).toHaveLength(1)
    await server.release()
  })

  it('shows one hint and a count of one, not two of each', async () => {
    const server = gatedServer(bothRoutes)
    mount(server)

    fireEvent.click(hintButton())
    fireEvent.click(hintButton())
    await server.release()

    expect(screen.getByText('Hints used: 1')).toBeInTheDocument()
    expect(screen.getByText(full().hints[0])).toBeInTheDocument()
    expect(screen.queryByText(full().hints[1])).not.toBeInTheDocument()
  })

  it('still gives a second hint to a child who deliberately asks again', async () => {
    const server = gatedServer(bothRoutes)
    mount(server)

    fireEvent.click(hintButton())
    await server.release()

    expect(hintButton()).toBeEnabled()
    fireEvent.click(hintButton())
    await server.release()

    expect(server.to(HINTS)).toHaveLength(2)
    expect(screen.getByText('Hints used: 2')).toBeInTheDocument()
    expect(screen.getByText(full().hints[1])).toBeInTheDocument()
  })
})
