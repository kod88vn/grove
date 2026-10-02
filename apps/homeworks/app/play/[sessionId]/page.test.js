/**
 * P1.8 part 4 of 4 — the session runner, `/homeworks/play/[sessionId]`.
 *
 * §6.7 gives this route a progress bar, one problem at a time, and an end card. The
 * session already exists by the time a child lands here — the id is in the URL — so this
 * page must never open another one; it walks the skill's templates, drawing each into the
 * session it was given.
 *
 * SCOPE NOTE, recorded here because it is the one invention in P1.8: §6.7 names the route
 * with only a `sessionId`, and P1.7 shipped no `GET /sessions/:id`, so there is no way to
 * read back which skill the session is for. This page therefore takes `?skill=` and
 * `?count=` from the query string. The alternative was inventing an API route, which is
 * worse. The real producer of this URL is the Today screen in Phase 3.
 *
 * `count` defaults to 8, which is Band B in §5.2 — not a number picked here.
 */
import { afterEach, beforeEach, describe, expect, it, jest } from '@jest/globals'
import '@testing-library/jest-dom'
import { fireEvent, render, screen } from '@testing-library/react'

import { getProblem, listProblems, render as renderProblem, toInstance } from '@grove/curriculum'

import { SessionRunner } from '@/components/SessionRunner'
import Page from './page'

const SKILL = 'm5.oa.order-of-operations'
const SESSION = 'sess-9'
const PROBLEMS = listProblems().filter((problem) => problem.skill === SKILL)

const PROBLEMS_URL = `/homeworks/api/problems?skill=${SKILL}`
const ITEMS_URL = `/homeworks/api/sessions/${SESSION}/items`
const ATTEMPTS_URL = '/homeworks/api/attempts'
const SESSIONS_URL = '/homeworks/api/sessions'
const FINISH_URL = `/homeworks/api/sessions/${SESSION}/finish`

/** The nth problem a runner of this skill should serve, and the instance it draws. */
const problemAt = (index) => PROBLEMS[index % PROBLEMS.length]
const fullAt = (index) => renderProblem(getProblem(problemAt(index).id), 1000 + index)
const instanceAt = (index) => toInstance(fullAt(index))

function fakeFetch(replies) {
  const calls = []
  const fn = jest.fn(async (url, options = {}) => {
    calls.push({ url, body: options.body ? JSON.parse(options.body) : null, method: options.method ?? 'GET' })
    const reply = replies[url]
    if (!reply) throw new Error(`unexpected request to ${url}`)
    const next = typeof reply === 'function' ? reply(calls) : reply
    if (next instanceof Error) throw next
    return { ok: (next.status ?? 200) < 400, status: next.status ?? 200, json: async () => next.body }
  })
  fn.calls = calls
  return fn
}

/** A server that walks the skill's templates in order and awards a fixed 3, 2, 1, … */
const STARS = [3, 2, 1, 3, 2]
function walkingServer() {
  let drawn = 0
  return {
    [PROBLEMS_URL]: { body: { problems: PROBLEMS } },
    [ITEMS_URL]: () => {
      const instance = instanceAt(drawn)
      drawn += 1
      return { status: 201, body: { seed: instance.seed, instance } }
    },
    [ATTEMPTS_URL]: (calls) => {
      const index = calls.filter((call) => call.url === ATTEMPTS_URL).length - 1
      return {
        body: {
          correct: true,
          stars: STARS[index],
          feedback: 'Great work!',
          explanation: fullAt(index).explanation,
          skillState: null,
        },
      }
    },
    [FINISH_URL]: { body: { finished: true, stars: 6, grew: [], next: null } },
  }
}

const mount = (fetchFn, props = {}) => {
  global.fetch = fetchFn
  return render(<SessionRunner sessionId={SESSION} skill={SKILL} count={3} {...props} />)
}

/** Answer the problem currently on screen, then move on if there is a Next. */
async function solveCurrent(index) {
  const problem = fullAt(index)
  if (problem.widget === 'steps') {
    const fields = await screen.findAllByRole('textbox', { name: /step/i })
    fields.forEach((field, stepIndex) => fireEvent.change(field, { target: { value: problem.answer.steps[stepIndex].expression } }))
  } else {
    const field = await screen.findByLabelText('Your answer')
    fireEvent.change(field, { target: { value: String(problem.answer.value) } })
  }
  fireEvent.click(screen.getByRole('button', { name: /Check/ }))
  await screen.findByText('How Nora solved it')
}

describe('P1.8 — /homeworks/play/[sessionId]', () => {
  beforeEach(() => {
    jest.spyOn(console, 'error').mockImplementation(() => {})
  })

  afterEach(() => {
    jest.restoreAllMocks()
    delete global.fetch
  })

  it('the data this spec leans on holds: several templates, and five distinct prompts', () => {
    expect(PROBLEMS.length).toBeGreaterThan(1)
    const prompts = [0, 1, 2, 3, 4].map((index) => instanceAt(index).prompt)
    expect(new Set(prompts).size).toBe(prompts.length)
  })

  describe('the route file', () => {
    it('hands the session, the skill and the count to the runner', async () => {
      const element = await Page({
        params: Promise.resolve({ sessionId: SESSION }),
        searchParams: Promise.resolve({ skill: SKILL, count: '3' }),
      })

      expect(element.type).toBe(SessionRunner)
      expect(element.props).toEqual({ sessionId: SESSION, skill: SKILL, count: 3 })
    })

    it.each([[undefined], ['abc'], ['0'], ['-2'], ['']])('falls back to the §5.2 eight when count is %p', async (count) => {
      const element = await Page({
        params: Promise.resolve({ sessionId: SESSION }),
        searchParams: Promise.resolve(count === undefined ? { skill: SKILL } : { skill: SKILL, count }),
      })

      expect(element.props.count).toBe(8)
    })
  })

  it('asks which problems this skill has, then draws the first into the session it was given', async () => {
    const fetchFn = fakeFetch(walkingServer())
    mount(fetchFn)

    await screen.findByText(instanceAt(0).prompt)
    expect(fetchFn.calls.map((call) => call.url)).toEqual([PROBLEMS_URL, ITEMS_URL])
    expect(fetchFn.calls[0].method).toBe('GET')
    expect(fetchFn.calls[1].method).toBe('POST')
    expect(fetchFn.calls[1].body).toEqual({ problemId: problemAt(0).id })
  })

  it('never opens a second session — it was handed one', async () => {
    const fetchFn = fakeFetch(walkingServer())
    mount(fetchFn)

    await screen.findByText(instanceAt(0).prompt)
    await solveCurrent(0)
    fireEvent.click(screen.getByRole('button', { name: /Next/ }))
    await screen.findByText(instanceAt(1).prompt)

    expect(fetchFn.calls.some((call) => call.url === SESSIONS_URL)).toBe(false)
  })

  it('says where the child is up to', async () => {
    mount(fakeFetch(walkingServer()))
    await screen.findByText(instanceAt(0).prompt)

    expect(screen.getByText('Problem 1 of 3')).toBeInTheDocument()
    const bar = screen.getByRole('progressbar')
    expect(bar).toHaveAttribute('aria-valuenow', '1')
    expect(bar).toHaveAttribute('aria-valuemin', '1')
    expect(bar).toHaveAttribute('aria-valuemax', '3')
  })

  it('moves on only when the child says so, and starts the next one clean', async () => {
    const view = mount(fakeFetch(walkingServer()))
    await screen.findByText(instanceAt(0).prompt)
    expect(screen.queryByRole('button', { name: /Next/ })).not.toBeInTheDocument()

    await solveCurrent(0)
    fireEvent.click(screen.getByRole('button', { name: /Next/ }))

    await screen.findByText(instanceAt(1).prompt)
    expect(screen.getByText('Problem 2 of 3')).toBeInTheDocument()
    expect(screen.getByRole('progressbar')).toHaveAttribute('aria-valuenow', '2')
    expect(screen.queryByText('How Nora solved it')).not.toBeInTheDocument()
    expect(screen.queryByLabelText(/of 3 stars/)).not.toBeInTheDocument()
    expect(screen.getByLabelText('Your answer')).toHaveValue('')
    expect(view.container.textContent).not.toContain(fullAt(0).explanation)
  })

  it('walks the templates, and wraps round when it runs out', async () => {
    const fetchFn = fakeFetch(walkingServer())
    mount(fetchFn, { count: 5 })

    for (let index = 0; index < 4; index += 1) {
      await screen.findByText(instanceAt(index).prompt)
      await solveCurrent(index)
      fireEvent.click(screen.getByRole('button', { name: /Next/ }))
    }
    await screen.findByText(instanceAt(4).prompt)

    const drawn = fetchFn.calls.filter((call) => call.url === ITEMS_URL).map((call) => call.body.problemId)
    expect(drawn).toEqual([0, 1, 2, 3, 4].map((index) => problemAt(index).id))
    expect(drawn[4]).toBe(drawn[0])
  })

  it('ends with the stars the server handed out, added up', async () => {
    mount(fakeFetch(walkingServer()))

    for (let index = 0; index < 3; index += 1) {
      await screen.findByText(instanceAt(index).prompt)
      await solveCurrent(index)
      if (index < 2) fireEvent.click(screen.getByRole('button', { name: /Next/ }))
    }

    fireEvent.click(screen.getByRole('button', { name: /Finish/ }))

    // The finish endpoint, not the browser's optimistic total, owns this value.
    expect(await screen.findByLabelText('6 stars earned')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /Check/ })).not.toBeInTheDocument()
    expect(screen.queryByRole('progressbar')).not.toBeInTheDocument()
    expect(screen.getByRole('link', { name: /Home/i })).toHaveAttribute('href', '/')
  })

  it('offers Finish, not Next, on the last problem', async () => {
    mount(fakeFetch(walkingServer()))
    await screen.findByText(instanceAt(0).prompt)
    await solveCurrent(0)
    fireEvent.click(screen.getByRole('button', { name: /Next/ }))
    await screen.findByText(instanceAt(1).prompt)
    await solveCurrent(1)
    fireEvent.click(screen.getByRole('button', { name: /Next/ }))
    await screen.findByText(instanceAt(2).prompt)
    await solveCurrent(2)

    expect(screen.getByRole('button', { name: /Finish/ })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /Next/ })).not.toBeInTheDocument()
  })

  it('keeps the answer on the server until the child has solved it', async () => {
    const view = mount(fakeFetch(walkingServer()))
    await screen.findByText(instanceAt(0).prompt)

    expect(view.container.textContent).not.toContain(fullAt(0).explanation)
    expect(screen.queryByText('How Nora solved it')).not.toBeInTheDocument()
    expect(view.container.textContent).not.toMatch(/\bAI\b/)
  })

  it('says so when it cannot get going, and can be told to try again', async () => {
    const walking = walkingServer()
    const fetchFn = fakeFetch({
      ...walking,
      [PROBLEMS_URL]: (calls) =>
        calls.filter((call) => call.url === PROBLEMS_URL).length === 1 ? new Error('offline') : { body: { problems: PROBLEMS } },
    })
    mount(fetchFn)

    await screen.findByText(/Nora couldn't start that right now/)
    expect(screen.queryByRole('button', { name: /Check/ })).not.toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: /Try again/ }))
    await screen.findByText(instanceAt(0).prompt)
  })
})
