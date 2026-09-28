/**
 * P1.8 part 3 of 4 — the solo practice page, `/homeworks/q/[skill]/[template]`.
 *
 * §6.7 gives this route one job: let a child work one specific template. §6.6 gives it
 * exactly one legal way to get there — POST /sessions, then POST /sessions/:id/items —
 * because "the only way a seed enters a session" is that second call. The tempting
 * shortcut, GET /problems/:skill/:template, is the read-only preview: it earns no stars,
 * records no attempt, and is bound to no session, so a page built on it would look
 * identical and quietly stop counting. This spec pins the page to the earning path.
 *
 * The page component itself stays a two-line server component that unwraps `params`; all
 * the behaviour lives in `components/SoloPractice.js`, which is what jsdom can drive.
 */
import { afterEach, beforeEach, describe, expect, it, jest } from '@jest/globals'
import '@testing-library/jest-dom'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'

import { getProblem, render as renderProblem, toInstance } from '@grove/curriculum'

import { localDateOf } from '@/lib/localDay'
import { SoloPractice } from '@/components/SoloPractice'
import Page from './page'

const SKILL = 'm5.oa.order-of-operations'
const TEMPLATE = 'precedence'
const PROBLEM = `${SKILL}/${TEMPLATE}`
const SESSION = 'sess-1'

const SESSIONS_URL = '/homeworks/api/sessions'
const ITEMS_URL = `/homeworks/api/sessions/${SESSION}/items`
const ATTEMPTS_URL = '/homeworks/api/attempts'

const full = (seed) => renderProblem(getProblem(PROBLEM), seed)
const instanceOf = (seed) => toInstance(full(seed))

const FIRST = instanceOf(4242)
const SECOND = instanceOf(777)

function fakeFetch(replies) {
  const calls = []
  const fn = jest.fn(async (url, options = {}) => {
    calls.push({ url, body: options.body ? JSON.parse(options.body) : null, method: options.method })
    const reply = replies[url]
    if (!reply) throw new Error(`unexpected request to ${url}`)
    const next = typeof reply === 'function' ? reply(calls) : reply
    if (next instanceof Error) throw next
    return { ok: (next.status ?? 200) < 400, status: next.status ?? 200, json: async () => next.body }
  })
  fn.calls = calls
  return fn
}

const okSession = { body: { sessionId: SESSION } }
const item = (instance) => ({ status: 201, body: { seed: instance.seed, instance } })

const solveIt = async (instance) => {
  fireEvent.change(await screen.findByLabelText('Your answer'), {
    target: { value: String(full(instance.seed).answer.value) },
  })
  fireEvent.click(screen.getByRole('button', { name: /Check/ }))
}

const mount = (fetchFn) => {
  global.fetch = fetchFn
  return render(<SoloPractice skill={SKILL} template={TEMPLATE} />)
}

describe('P1.8 — /homeworks/q/[skill]/[template]', () => {
  beforeEach(() => {
    jest.spyOn(console, 'error').mockImplementation(() => {})
  })

  afterEach(() => {
    jest.restoreAllMocks()
    delete global.fetch
  })

  it('the two seeds this spec relies on really do differ', () => {
    expect(FIRST.prompt).not.toBe(SECOND.prompt)
  })

  it('the route file hands the params straight to SoloPractice', async () => {
    const element = await Page({ params: Promise.resolve({ skill: SKILL, template: TEMPLATE }) })

    expect(element.type).toBe(SoloPractice)
    expect(element.props).toEqual({ skill: SKILL, template: TEMPLATE })
  })

  it('opens a session, then draws a problem into it — in that order', async () => {
    const fetchFn = fakeFetch({ [SESSIONS_URL]: okSession, [ITEMS_URL]: item(FIRST) })
    mount(fetchFn)

    await screen.findByText(FIRST.prompt)
    expect(fetchFn.calls.map((call) => call.url)).toEqual([SESSIONS_URL, ITEMS_URL])
    expect(fetchFn.calls.every((call) => call.method === 'POST')).toBe(true)
  })

  it('asks for the session the way POST /sessions demands', async () => {
    const fetchFn = fakeFetch({ [SESSIONS_URL]: okSession, [ITEMS_URL]: item(FIRST) })
    mount(fetchFn)
    await screen.findByText(FIRST.prompt)

    const { body } = fetchFn.calls[0]
    expect(Object.keys(body).sort()).toEqual(['kind', 'localDate', 'skillId', 'studentId', 'tz'])
    expect(body.studentId).toBe('public')
    expect(body.kind).toBe('skill')
    expect(body.skillId).toBe(SKILL)
    expect(body.tz).toBe(Intl.DateTimeFormat().resolvedOptions().timeZone)
    expect(body.localDate).toMatch(/^\d{4}-\d{2}-\d{2}$/)
    expect(body.localDate).toBe(localDateOf(new Date(), body.tz))
  })

  it('never tries to pick the seed itself', async () => {
    const fetchFn = fakeFetch({ [SESSIONS_URL]: okSession, [ITEMS_URL]: item(FIRST) })
    mount(fetchFn)
    await screen.findByText(FIRST.prompt)

    // POST /sessions/:id/items answers 400 to a body carrying `seed` or `tries`.
    expect(Object.keys(fetchFn.calls[1].body)).toEqual(['problemId'])
    expect(fetchFn.calls[1].body.problemId).toBe(PROBLEM)
  })

  it('says something while it is getting ready', () => {
    const fetchFn = jest.fn(() => new Promise(() => {}))
    global.fetch = fetchFn
    render(<SoloPractice skill={SKILL} template={TEMPLATE} />)

    expect(screen.getByText(/Getting your problem ready/)).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /Check/ })).not.toBeInTheDocument()
  })

  it('hands the drawn problem to the solver, answer still on the server', async () => {
    const view = mount(fakeFetch({ [SESSIONS_URL]: okSession, [ITEMS_URL]: item(FIRST) }))
    await screen.findByText(FIRST.prompt)

    expect(screen.getByRole('button', { name: /Check/ })).toBeEnabled()
    expect(screen.getByRole('button', { name: /Hint/ })).toBeEnabled()
    expect(view.container.textContent).not.toContain(full(4242).explanation)
    expect(screen.queryByText('How Nora solved it')).not.toBeInTheDocument()
    expect(view.container.textContent).not.toMatch(/\bAI\b/)
  })

  it('a miss is not a score', async () => {
    mount(
      fakeFetch({
        [SESSIONS_URL]: okSession,
        [ITEMS_URL]: item(FIRST),
        [ATTEMPTS_URL]: {
          body: { correct: false, stars: 0, feedback: 'Keep going—you can try again!', skillState: null },
        },
      }),
    )
    await screen.findByText(FIRST.prompt)
    fireEvent.change(screen.getByLabelText('Your answer'), { target: { value: '0' } })
    fireEvent.click(screen.getByRole('button', { name: /Check/ }))

    await screen.findByText('Keep going—you can try again!')
    // Zero stars is not a score to show a ten-year-old; §5.1 hands them out on a solve.
    expect(screen.queryByLabelText(/of 3 stars/)).not.toBeInTheDocument()
    expect(screen.queryByText('How Nora solved it')).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Check/ })).toBeEnabled()
  })

  describe('after it is solved', () => {
    const replies = {
      [SESSIONS_URL]: okSession,
      [ITEMS_URL]: (calls) => (calls.filter((call) => call.url === ITEMS_URL).length === 1 ? item(FIRST) : item(SECOND)),
      [ATTEMPTS_URL]: (calls) => ({
        body: {
          correct: true,
          stars: 3,
          feedback: 'Great work!',
          explanation: full(calls.at(-1).body.seed).explanation,
          skillState: null,
        },
      }),
    }

    it('offers another one like it, and only then', async () => {
      const fetchFn = fakeFetch(replies)
      mount(fetchFn)
      await screen.findByText(FIRST.prompt)
      expect(screen.queryByRole('button', { name: /Try another/ })).not.toBeInTheDocument()

      await solveIt(FIRST)
      await screen.findByText('How Nora solved it')
      expect(screen.getByRole('button', { name: /Try another/ })).toBeEnabled()
    })

    it('draws the next one from the same session, never a fresh one', async () => {
      const fetchFn = fakeFetch(replies)
      mount(fetchFn)
      await screen.findByText(FIRST.prompt)
      await solveIt(FIRST)
      await screen.findByText('How Nora solved it')

      fireEvent.click(screen.getByRole('button', { name: /Try another/ }))

      await screen.findByText(SECOND.prompt)
      expect(fetchFn.calls.filter((call) => call.url === SESSIONS_URL).length).toBe(1)
      expect(fetchFn.calls.filter((call) => call.url === ITEMS_URL).length).toBe(2)
      expect(fetchFn.calls.at(-1).body).toEqual({ problemId: PROBLEM })
    })

    it('starts the next one clean — no stars and no solution carried over', async () => {
      const view = mount(fakeFetch(replies))
      await screen.findByText(FIRST.prompt)
      await solveIt(FIRST)
      await screen.findByText('How Nora solved it')

      fireEvent.click(screen.getByRole('button', { name: /Try another/ }))
      await screen.findByText(SECOND.prompt)

      expect(screen.queryByText('How Nora solved it')).not.toBeInTheDocument()
      expect(screen.queryByLabelText(/of 3 stars/)).not.toBeInTheDocument()
      expect(view.container.textContent).not.toContain(full(4242).explanation)
      expect(screen.getByLabelText('Your answer')).toHaveValue('')
      expect(screen.getByRole('button', { name: /Check/ })).toBeEnabled()
    })
  })

  describe('when it cannot get started', () => {
    it('says so in Nora’s voice and offers a retry that actually retries', async () => {
      const fetchFn = fakeFetch({
        [SESSIONS_URL]: (calls) => (calls.length === 1 ? new Error('offline') : okSession),
        [ITEMS_URL]: item(FIRST),
      })
      mount(fetchFn)

      await screen.findByText(/Nora couldn't start that right now/)
      expect(screen.queryByRole('button', { name: /Check/ })).not.toBeInTheDocument()

      fireEvent.click(screen.getByRole('button', { name: /Try again/ }))
      await screen.findByText(FIRST.prompt)
    })

    it('treats a bad status the same as a dead connection', async () => {
      mount(
        fakeFetch({ [SESSIONS_URL]: okSession, [ITEMS_URL]: { status: 400, body: { error: 'Unexpected field' } } }),
      )

      await screen.findByText(/Nora couldn't start that right now/)
      expect(screen.queryByRole('button', { name: /Check/ })).not.toBeInTheDocument()
    })
  })

  it('keeps a way home, relative to the basePath', async () => {
    mount(fakeFetch({ [SESSIONS_URL]: okSession, [ITEMS_URL]: item(FIRST) }))
    await screen.findByText(FIRST.prompt)

    await waitFor(() => expect(screen.getByRole('link', { name: /Home/i })).toHaveAttribute('href', '/'))
  })
})
