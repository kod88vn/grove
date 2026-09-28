/**
 * PR #84 review, threads 1 and 2 — one page load, one session, one item.
 *
 * `next.config.js` sets `reactStrictMode: true`, so in development React mounts, unmounts
 * and remounts every component once, running each effect twice. Both entry points in this
 * PR kick off their work from an unguarded effect, and the work is not idempotent:
 *
 *   - `POST /sessions` mints a fresh `randomUUID()` on every call (app/api/sessions/route.js).
 *   - `POST /sessions/:id/items` rehashes its seed while a row already exists
 *     (app/api/sessions/[id]/items/route.js), so a repeat call inserts a SECOND item with a
 *     DIFFERENT seed rather than returning the first.
 *
 * Measured on this branch before the fix: `SessionRunner` bound seeds 1000 and 1001 to the
 * same session and displayed only 1001, orphaning 1000; `SoloPractice` created two sessions
 * and drew an item into each, leaving the first abandoned with a live item.
 *
 * What is pinned here is the count of non-idempotent requests, not the mechanism of the
 * guard — a ref, a module flag or an AbortController all pass if the child only ever gets
 * one session and one problem.
 *
 * THE REGRESSIONS THIS FIX CAN CAUSE ARE PINNED TOO, and they are the reason this file is
 * long. A guard placed inside `start()` / `startSession()` rather than around the effect
 * would satisfy the counts above and silently break the "Try again" button, which calls the
 * very same function from an onClick. A guard keyed on nothing would freeze the component
 * when the skill changes. A guard that keys off mount alone would suppress the single
 * legitimate run in production. Each of those is a test below.
 */
import { afterEach, beforeEach, describe, expect, it, jest } from '@jest/globals'
import '@testing-library/jest-dom'
import { StrictMode } from 'react'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'

import { getProblem, listProblems, render as renderProblem, toInstance } from '@grove/curriculum'

import { SessionRunner } from './SessionRunner'
import { SoloPractice } from './SoloPractice'

const SKILL = 'm5.oa.order-of-operations'
const OTHER_SKILL = 'm5.nbt.long-multiplication'
const SESSION = 'sess-strict'
const SESSIONS_URL = '/homeworks/api/sessions'
const READY = /Getting your problem ready/
const START_ERROR = "Nora couldn't start that right now"

const problemsOf = (skill) => listProblems().filter((problem) => problem.skill === skill)
const templateOf = (skill) => problemsOf(skill)[0].id.split('/')[1]

/**
 * A server that behaves like the real routes: never an upsert, always a new id and a new
 * seed. It records every request so a duplicate cannot hide behind an identical response.
 */
function fakeServer({ failDraws = false } = {}) {
  const calls = []
  const sessions = []
  const items = []
  let draws = 0
  let failing = failDraws

  const respond = (body, status = 200) => ({
    ok: status < 400,
    status,
    json: async () => body,
  })

  const fn = jest.fn(async (url, options = {}) => {
    const method = options.method ?? 'GET'
    const body = options.body ? JSON.parse(options.body) : null
    calls.push({ url, method, body })

    const problemsMatch = url.match(/^\/homeworks\/api\/problems\?skill=(.+)$/)
    if (problemsMatch) {
      return respond({ problems: problemsOf(decodeURIComponent(problemsMatch[1])) })
    }

    if (url === SESSIONS_URL && method === 'POST') {
      const sessionId = `sess-${sessions.length + 1}`
      sessions.push(sessionId)
      return respond({ sessionId }, 201)
    }

    const itemsMatch = url.match(/^\/homeworks\/api\/sessions\/([^/]+)\/items$/)
    if (itemsMatch && method === 'POST') {
      if (failing) return respond({ error: 'nope' }, 500)
      draws += 1
      const seed = 1000 + draws
      const problemId = body.problemId
      items.push({ sessionId: itemsMatch[1], problemId, seed })
      return respond({ seed, instance: toInstance(renderProblem(getProblem(problemId), seed)) }, 201)
    }

    throw new Error(`unexpected request ${method} ${url}`)
  })

  // Lets a test stop the failure without counting draws, so it is valid both before the
  // fix (two failed draws on mount) and after it (one).
  fn.heal = () => { failing = false }
  fn.calls = calls
  fn.sessions = sessions
  fn.items = items
  fn.countOf = (predicate) => calls.filter(predicate).length
  fn.itemPosts = () => calls.filter((call) => call.url.endsWith('/items') && call.method === 'POST')
  fn.sessionPosts = () => calls.filter((call) => call.url === SESSIONS_URL && call.method === 'POST')
  fn.problemGets = () => calls.filter((call) => call.url.includes('/api/problems?'))
  return fn
}

/** The prompt text the child can actually read on screen. */
const promptOf = (seed, problemId) => toInstance(renderProblem(getProblem(problemId), seed)).prompt

let server

beforeEach(() => {
  server = fakeServer()
  global.fetch = server
})

afterEach(() => {
  jest.restoreAllMocks()
  delete global.fetch
})

describe('SessionRunner starts exactly one problem per page load', () => {
  const renderRunner = (props = {}) => render(
    <StrictMode>
      <SessionRunner sessionId={SESSION} skill={SKILL} count={3} {...props} />
    </StrictMode>,
  )

  it('draws one item, not one per StrictMode effect invocation', async () => {
    renderRunner()
    await waitFor(() => expect(screen.queryByText(READY)).toBeNull())

    expect(server.itemPosts()).toHaveLength(1)
    expect(server.items).toHaveLength(1)
  })

  it('asks the server for the problem list once', async () => {
    renderRunner()
    await waitFor(() => expect(screen.queryByText(READY)).toBeNull())

    expect(server.problemGets()).toHaveLength(1)
  })

  it('shows the one seed it bound, so no drawn problem is orphaned', async () => {
    renderRunner()
    await waitFor(() => expect(screen.queryByText(READY)).toBeNull())

    const [only] = server.items
    expect(screen.getByText(promptOf(only.seed, only.problemId))).toBeInTheDocument()
  })

  it('still draws when the skill changes, so the guard does not freeze the runner', async () => {
    const view = renderRunner()
    await waitFor(() => expect(screen.queryByText(READY)).toBeNull())

    view.rerender(
      <StrictMode>
        <SessionRunner sessionId={SESSION} skill={OTHER_SKILL} count={3} />
      </StrictMode>,
    )
    await waitFor(() => expect(server.itemPosts()).toHaveLength(2))

    expect(server.items[1].problemId.startsWith(OTHER_SKILL)).toBe(true)
  })

  it('still retries when the child presses Try again after a failure', async () => {
    server = fakeServer({ failDraws: true })
    global.fetch = server

    renderRunner()
    await screen.findByText(START_ERROR)
    const before = server.itemPosts().length
    server.heal()

    fireEvent.click(screen.getByRole('button', { name: /Try again/ }))
    await waitFor(() => expect(screen.queryByText(READY)).toBeNull())

    expect(screen.queryByText(START_ERROR)).toBeNull()
    expect(server.itemPosts().length).toBeGreaterThan(before)
  })

  it('draws exactly one item outside StrictMode too, the way production runs', async () => {
    render(<SessionRunner sessionId={SESSION} skill={SKILL} count={3} />)
    await waitFor(() => expect(screen.queryByText(READY)).toBeNull())

    expect(server.itemPosts()).toHaveLength(1)
  })
})

describe('SoloPractice opens exactly one session per page load', () => {
  const TEMPLATE = templateOf(SKILL)
  const OTHER_TEMPLATE = problemsOf(SKILL)[1].id.split('/')[1]

  const renderSolo = (props = {}) => render(
    <StrictMode>
      <SoloPractice skill={SKILL} template={TEMPLATE} {...props} />
    </StrictMode>,
  )

  it('creates one session, not one per StrictMode effect invocation', async () => {
    renderSolo()
    await waitFor(() => expect(screen.queryByText(READY)).toBeNull())

    expect(server.sessionPosts()).toHaveLength(1)
    expect(server.sessions).toEqual(['sess-1'])
  })

  it('draws one item, into the session it just created', async () => {
    renderSolo()
    await waitFor(() => expect(screen.queryByText(READY)).toBeNull())

    expect(server.itemPosts()).toHaveLength(1)
    expect(server.items).toEqual([expect.objectContaining({ sessionId: 'sess-1' })])
  })

  it('leaves no abandoned session holding a live item', async () => {
    renderSolo()
    await waitFor(() => expect(screen.queryByText(READY)).toBeNull())

    const used = new Set(server.items.map((item) => item.sessionId))
    expect([...used]).toEqual(server.sessions)
  })

  it('starts a new session when the template changes', async () => {
    const view = renderSolo()
    await waitFor(() => expect(screen.queryByText(READY)).toBeNull())

    view.rerender(<StrictMode><SoloPractice skill={SKILL} template={OTHER_TEMPLATE} /></StrictMode>)
    await waitFor(() => expect(server.sessionPosts()).toHaveLength(2))

    expect(server.items[1].problemId).toBe(`${SKILL}/${OTHER_TEMPLATE}`)
  })

  it('is per mount, not module-wide, so the next visit still opens a session', async () => {
    const first = renderSolo()
    await waitFor(() => expect(screen.queryByText(READY)).toBeNull())
    first.unmount()

    renderSolo()
    await waitFor(() => expect(screen.queryByText(READY)).toBeNull())

    expect(server.sessionPosts()).toHaveLength(2)
    expect(server.sessions).toEqual(['sess-1', 'sess-2'])
  })

  it('still retries when the child presses Try again after a failure', async () => {
    server = fakeServer({ failDraws: true })
    global.fetch = server

    renderSolo()
    await screen.findByText(START_ERROR)
    const before = server.itemPosts().length
    server.heal()

    fireEvent.click(screen.getByRole('button', { name: /Try again/ }))
    await waitFor(() => expect(screen.queryByText(READY)).toBeNull())

    expect(screen.queryByText(START_ERROR)).toBeNull()
    expect(server.itemPosts().length).toBeGreaterThan(before)
  })

  it('opens exactly one session outside StrictMode too, the way production runs', async () => {
    render(<SoloPractice skill={SKILL} template={TEMPLATE} />)
    await waitFor(() => expect(screen.queryByText(READY)).toBeNull())

    expect(server.sessionPosts()).toHaveLength(1)
    expect(server.itemPosts()).toHaveLength(1)
  })
})
