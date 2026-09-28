/**
 * P1.8 part 2 of 4 — one problem, start to finish: 💡 · Check ✅ · stars · "How Nora
 * solved it".
 *
 * `SolveItem` is the piece the child actually uses. It owns no truth of its own: the seed
 * came from POST /sessions/:id/items, the hint text and the hint count come from
 * POST /hints, and the verdict, the stars and the worked solution come from POST /attempts.
 * Plan §6.6 puts every counter on the server precisely so a kid cannot farm stars, and
 * §3 principle 5 keeps the answer there until the problem is solved.
 *
 * THE FAKE SERVER HERE LIES ON PURPOSE. It returns star counts and hint counts that the
 * real rule would never produce — 2 stars for a clean first-try solve, `hintsUsed: 7` for
 * a first hint. A component that computed either of those itself would render the right
 * number and fail these tests. That is the point: this spec cannot be satisfied by a
 * client that happens to agree with the server, only by one that reports what it was
 * told. Route fidelity is P1.7's business and is already covered by
 * `app/api/practice.flow.test.js`; what is covered here is that the UI does not have a
 * second opinion.
 *
 * The problems, prompts, answers, hints and explanations are all real — rendered from
 * `@grove/curriculum`, never written out as fixtures — so a template whose explanation
 * changes cannot silently stop being checked.
 */
import { afterEach, beforeEach, describe, expect, it, jest } from '@jest/globals'
import '@testing-library/jest-dom'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'

import { getProblem, listProblems, render as renderProblem, toInstance } from '@grove/curriculum'

import { SolveItem } from './SolveItem'

const SESSION = 'session-abc'
const SEED = 4242
const HEADING = 'How Nora solved it'

const pick = (widget) => listProblems().find((problem) => problem.widget === widget)
const full = (id, seed = SEED) => renderProblem(getProblem(id), seed)
const instanceOf = (id, seed = SEED) => toInstance(full(id, seed))

const NUMBER = pick('number').id
const FRACTION = pick('fraction').id
const COLUMN = pick('column').id
const CLOZE = pick('cloze').id
const CHOICE = pick('choice').id
const ORDER = pick('order').id
const SORT = pick('sort').id

/** A fetch that records every call and answers from a table of canned replies. */
function fakeFetch(replies) {
  const calls = []
  const fn = jest.fn(async (url, options) => {
    const body = JSON.parse(options.body)
    calls.push({ url, body })
    const reply = replies[url]
    if (!reply) throw new Error(`unexpected request to ${url}`)
    const next = typeof reply === 'function' ? reply(body, calls) : reply
    if (next instanceof Error) throw next
    return { ok: next.status === undefined || next.status < 400, status: next.status ?? 200, json: async () => next.body }
  })
  fn.calls = calls
  return fn
}

const ATTEMPTS = '/homeworks/api/attempts'
const HINTS = '/homeworks/api/hints'

/** The verdict a real /attempts would send, but with the stars deliberately wrong. */
const solved = (id, stars) => ({
  body: { correct: true, stars, feedback: 'Great work!', explanation: full(id).explanation, skillState: null },
})
const missed = { body: { correct: false, stars: 0, feedback: 'Keep going—you can try again!', skillState: null } }

function enterCorrect(id) {
  const answer = full(id).answer
  const { widget, visual } = instanceOf(id)
  if (widget === 'choice') {
    const option = visual.options.find((entry) => entry.id === answer.id)
    fireEvent.click(screen.getByRole('radio', { name: option.label }))
    return visual
  }
  if (widget === 'order') {
    // Driven through the same move buttons a keyboard user presses.
    const orderedIds = () =>
      [...document.body.querySelectorAll('[data-order-item]')].map((row) => row.dataset.orderItem)
    for (let target = 0; target < answer.sequence.length; target++) {
      let at = orderedIds().indexOf(answer.sequence[target])
      while (at > target) {
        fireEvent.click(document.body.querySelector(`[data-move-up="${answer.sequence[target]}"]`))
        at -= 1
      }
    }
    return visual
  }
  if (widget === 'sort') {
    // Driven through the same place-buttons a keyboard user presses, never a drag.
    for (const [bucketId, ids] of Object.entries(answer.buckets)) {
      for (const itemId of ids) {
        fireEvent.click(
          document.body.querySelector(`[data-sort-place-item="${itemId}"][data-sort-place-bucket="${bucketId}"]`),
        )
      }
    }
    return visual
  }
  if (widget === 'cloze') {
    fireEvent.click(screen.getByRole('radio', { name: answer.blanks[0].accept[0] }))
    return
  }
  const text = widget === 'fraction' ? `${answer.num}/${answer.den}` : String(answer.value)
  fireEvent.change(screen.getByLabelText('Your answer'), { target: { value: text } })
  return visual
}

const mount = (id, fetchFn, props = {}) => {
  global.fetch = fetchFn
  return render(<SolveItem sessionId={SESSION} instance={instanceOf(id)} {...props} />)
}

const check = () => fireEvent.click(screen.getByRole('button', { name: /Check/ }))
const hintButton = () => screen.getByRole('button', { name: /Hint/ })

describe('P1.8 — SolveItem', () => {
  beforeEach(() => {
    jest.spyOn(console, 'error').mockImplementation(() => {})
  })

  afterEach(() => {
    jest.restoreAllMocks()
    delete global.fetch
  })

  describe.each([
    ['number', NUMBER],
    ['column', COLUMN],
    ['fraction', FRACTION],
    ['cloze', CLOZE],
    ['choice', CHOICE],
    ['order', ORDER],
    ['sort', SORT],
  ])('%s', (widget, id) => {
    it('says nothing about the solution before the kid has solved it', () => {
      const view = mount(id, fakeFetch({}))

      expect(screen.queryByText(HEADING)).not.toBeInTheDocument()
      expect(view.container.textContent).not.toContain(full(id).explanation)
      for (const hint of full(id).hints) expect(view.container.textContent).not.toContain(hint)
      expect(view.container.textContent).not.toMatch(/\bAI\b/)
      expect(screen.getByRole('button', { name: /Check/ })).toBeEnabled()
    })

    it('sends the server exactly what /attempts asks for, and nothing else', async () => {
      const fetchFn = fakeFetch({ [ATTEMPTS]: missed })
      mount(id, fetchFn)
      enterCorrect(id)
      check()

      await waitFor(() => expect(fetchFn.calls.length).toBe(1))
      const { url, body } = fetchFn.calls[0]
      expect(url).toBe(ATTEMPTS)
      expect(Object.keys(body).sort()).toEqual(['durationMs', 'problemId', 'response', 'seed', 'sessionId'])
      expect(body.sessionId).toBe(SESSION)
      expect(body.problemId).toBe(id)
      expect(body.seed).toBe(SEED)
      expect(Number.isInteger(body.durationMs)).toBe(true)
      expect(body.durationMs).toBeGreaterThanOrEqual(0)
      expect(fetchFn.mock.calls[0][1].method).toBe('POST')
    })

    it('renders the stars the server sent, not the stars it could have worked out', async () => {
      // A clean first try with no hint: the real rule (§5.1) gives 3. The server says 2.
      mount(id, fakeFetch({ [ATTEMPTS]: solved(id, 2) }))
      enterCorrect(id)
      check()

      await screen.findByText(HEADING)
      expect(screen.getByLabelText('2 of 3 stars')).toBeInTheDocument()
      expect(screen.getByLabelText('2 of 3 stars').textContent).toBe('⭐⭐')
    })

    it('shows the worked solution only once the server has sent it', async () => {
      const explanation = full(id).explanation
      const view = mount(id, fakeFetch({ [ATTEMPTS]: (body, calls) => (calls.length === 1 ? missed : solved(id, 1)) }))

      enterCorrect(id)
      check()
      await screen.findByText('Keep going—you can try again!')
      expect(screen.queryByText(HEADING)).not.toBeInTheDocument()
      expect(view.container.textContent).not.toContain(explanation)

      check()
      await screen.findByText(HEADING)
      expect(screen.getByText(explanation)).toBeInTheDocument()
    })

    it('stops taking answers once the item is solved', async () => {
      const onSolved = jest.fn()
      const fetchFn = fakeFetch({ [ATTEMPTS]: solved(id, 3) })
      mount(id, fetchFn, { onSolved })
      enterCorrect(id)
      check()

      await screen.findByText(HEADING)
      expect(screen.getByRole('button', { name: /Check/ })).toBeDisabled()
      expect(hintButton()).toBeDisabled()
      // Widgets that answer by tapping have no text field to disable — their radios carry it.
      if (widget === 'cloze' || widget === 'choice') {
        for (const radio of screen.getAllByRole('radio')) expect(radio).toBeDisabled()
      } else if (widget === 'order') {
        for (const button of screen.getAllByRole('button', { name: /move/i })) expect(button).toBeDisabled()
      } else if (widget === 'sort') {
        for (const button of document.body.querySelectorAll('[data-sort-place-item]')) expect(button).toBeDisabled()
      } else {
        expect(screen.getByLabelText('Your answer')).toBeDisabled()
      }
      expect(onSolved).toHaveBeenCalledTimes(1)
      expect(onSolved).toHaveBeenCalledWith(expect.objectContaining({ correct: true, stars: 3 }))
      expect(fetchFn.calls.length).toBe(1)
    })
  })

  describe('hints', () => {
    it('asks /hints for the next one and believes the count it is given', async () => {
      const hints = full(NUMBER).hints
      const fetchFn = fakeFetch({ [HINTS]: { body: { hint: hints[0], hintsUsed: 7 } } })
      mount(NUMBER, fetchFn)

      fireEvent.click(hintButton())
      await screen.findByText(hints[0])

      expect(fetchFn.calls[0].url).toBe(HINTS)
      expect(Object.keys(fetchFn.calls[0].body).sort()).toEqual(['problemId', 'seed', 'sessionId'])
      expect(fetchFn.calls[0].body).toEqual({ sessionId: SESSION, problemId: NUMBER, seed: SEED })
      expect(screen.getByText(/Hints used: 7/)).toBeInTheDocument()
    })

    it('keeps the hints it has already been given as more arrive', async () => {
      const hints = full(NUMBER).hints
      const fetchFn = fakeFetch({
        [HINTS]: (body, calls) => ({ body: { hint: hints[calls.length - 1], hintsUsed: calls.length } }),
      })
      mount(NUMBER, fetchFn)

      fireEvent.click(hintButton())
      await screen.findByText(hints[0])
      fireEvent.click(hintButton())
      await screen.findByText(hints[1])
      expect(screen.getByText(hints[0])).toBeInTheDocument()
      expect(screen.getByText(/Hints used: 2/)).toBeInTheDocument()
    })

    it('does not keep asking once the server says there are none left', async () => {
      const fetchFn = fakeFetch({ [HINTS]: { status: 409, body: { error: 'No hints remain' } } })
      mount(NUMBER, fetchFn)

      fireEvent.click(hintButton())
      await waitFor(() => expect(hintButton()).toBeDisabled())
      expect(screen.getByText(/No more hints/)).toBeInTheDocument()
      expect(fetchFn.calls.length).toBe(1)
    })

    it('a hint never carries the answer with it', async () => {
      const hints = full(NUMBER).hints
      const view = mount(NUMBER, fakeFetch({ [HINTS]: { body: { hint: hints[0], hintsUsed: 1 } } }))

      fireEvent.click(hintButton())
      await screen.findByText(hints[0])
      expect(view.container.textContent).not.toContain(full(NUMBER).explanation)
      expect(screen.queryByText(HEADING)).not.toBeInTheDocument()
    })
  })

  describe('when Nora cannot answer', () => {
    it('says so, and lets the kid try again', async () => {
      const fetchFn = fakeFetch({ [ATTEMPTS]: new Error('offline') })
      mount(NUMBER, fetchFn)
      enterCorrect(NUMBER)
      check()

      await screen.findByText(/Nora couldn't check that right now/)
      expect(screen.getByRole('button', { name: /Check/ })).toBeEnabled()
      expect(screen.getByLabelText('Your answer')).toBeEnabled()
      expect(screen.queryByText(HEADING)).not.toBeInTheDocument()
    })

    it('does not invent a verdict out of a 409', async () => {
      const fetchFn = fakeFetch({ [ATTEMPTS]: { status: 409, body: { error: 'Session item is already done' } } })
      mount(NUMBER, fetchFn)
      enterCorrect(NUMBER)
      check()

      await screen.findByText(/Nora couldn't check that right now/)
      expect(screen.queryByText(HEADING)).not.toBeInTheDocument()
      expect(screen.queryByLabelText(/of 3 stars/)).not.toBeInTheDocument()
    })
  })

  describe('the prompt is not repeated back at the kid', () => {
    it.each([
      ['number', NUMBER, (visual) => visual.expression],
      ['fraction', FRACTION, (visual) => visual.addends.map((a) => `${a.num}/${a.den}`).join(` ${visual.operator} `)],
    ])('%s shows its sum once', (widget, id, stringOf) => {
      const view = mount(id, fakeFetch({}))
      const needle = stringOf(instanceOf(id).visual)

      expect(instanceOf(id).prompt).toContain(needle)
      expect(view.container.textContent.split(needle).length - 1).toBe(1)
    })
  })
})
