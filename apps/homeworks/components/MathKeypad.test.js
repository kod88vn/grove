/**
 * P2.2 — the maths keypad.
 *
 * HOMEWORK_PROGRESS.md item P2.2 is titled "Maths keypad (fraction, exponent, √, π)".
 * Three of those four symbols have no consumer in the repository today, and this spec
 * says so in a way that can go red the day that stops being true.
 *
 * WHAT IS REACHABLE. `listProblems()` ships four widgets — `number`, `column`,
 * `fraction`, `cloze` — and every correct answer any of them generates is built from the
 * digits `0`–`9` plus, for `fraction`, the bar `/`. `/` is the "fraction" of the box
 * title, and it composes exactly the `{ text: '7/9' }` that `check('fraction', …)` already
 * grades. So the pad offers digits, the bar, a backspace and a clear, and nothing else.
 *
 * WHAT IS NOT. `^`, `√` and `π` are rejected by the shipped checker — `number()` parses
 * through `decimal()`, whose grammar is `-?\d+(\.\d+)?` with optional thousands commas,
 * and `fraction()` parses through `parseFraction`. A key emitting any of them can only
 * ever produce `reason: 'invalid'`, which is a broken key, not a feature. HOMEWORK_PLAN.md
 * §5.2 puts the maths keypad in Band C (grades 6–8); only Grade 5 Band B content exists,
 * and Band B's input rule is "Number pad, column grid, short typing". The widgets that
 * would consume those symbols — `expression`, `table-fill`, `graph` — are unticked Phase 2
 * rows whose content is Phase 5d, and KaTeX (D5) is P2.4, also unticked. `.` and `−` are
 * left out by the same rule: no shipped template has a decimal or a negative answer.
 *
 * The third test below asserts that exclusion against the REAL checker rather than as an
 * opinion, so when a Band C checker learns `π`, this spec fails and forces the key to be
 * added deliberately.
 *
 * WHERE IT LIVES. `components/widgets/AnswerWidget.test.js` requires that the residue of a
 * widget's rendered text — everything the server sent, subtracted — contains no digit at
 * all. A digit pad inside the widget components breaks that, per widget per seed. The pad
 * therefore sits in `SolveItem`, which already owns the draft value and already hosts the
 * P2.1 🔊 button beside 💡 and Check ✅.
 *
 * NO NEW RESPONSE SHAPE. The pad edits the same string the text input edits. `emptyValue`
 * and `toResponse` are untouched, and every grading assertion here runs the posted body
 * through the real `check()` from `@grove/curriculum` against the real rendered answer —
 * no response literal is written down, so a pad that composes the wrong shape is caught by
 * `invalid` rather than by a fixture agreeing with itself.
 */
import { afterEach, describe, expect, it, jest } from '@jest/globals'
import '@testing-library/jest-dom'
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { StrictMode } from 'react'

import { check, getProblem, listProblems, render as renderProblem, toInstance } from '@grove/curriculum'

import { SolveItem } from './SolveItem'
import { keysFor } from './MathKeypad'

const SESSION = 'session-keypad'
const SEEDS = [12345, 7, 999_999]
const ATTEMPTS = '/homeworks/api/attempts'
const DEFERRED = ['^', '\u221a', '\u03c0']

const problems = listProblems()
// Derived, not listed: a widget belongs in the pad suite when the pad offers it keys. A
// hardcoded exclusion list quietly drags every new padless widget (P2.6's `choice`, and
// every Band A widget after it) through the typing tests, where `correctText` has nothing
// to type.
const mathProblems = problems.filter((problem) => keysFor(problem.widget) !== null)
const padlessProblems = problems.filter((problem) => keysFor(problem.widget) === null)

const full = (id, seed) => renderProblem(getProblem(id), seed)
const instanceOf = (id, seed) => toInstance(full(id, seed))
const widgetOf = (id) => getProblem(id).widget

/** The string a kid must end up with, derived from the real answer, never a fixture. */
const correctText = (id, seed) => {
  const answer = full(id, seed).answer
  return widgetOf(id) === 'fraction' ? `${answer.num}/${answer.den}` : String(answer.value)
}

/** Something a kid could plausibly enter that is simply not right — same characters. */
const wrongText = (id, seed) => {
  const answer = full(id, seed).answer
  return widgetOf(id) === 'fraction' ? `${answer.num + 1}/${answer.den}` : String(answer.value + 1)
}

/**
 * A fake /attempts that grades with the shipped checker. The verdict the UI is told is the
 * verdict `check()` produced for the body the component actually posted, so "the kid got it
 * right" and "the checker says right" cannot drift apart.
 */
function gradingFetch(id, seed) {
  const answer = full(id, seed).answer
  const widget = widgetOf(id)
  const posted = []
  const fn = jest.fn(async (url, options) => {
    const body = JSON.parse(options.body)
    posted.push(body)
    const verdict = check(widget, answer, body.response)
    return {
      ok: true,
      status: 200,
      json: async () => ({
        correct: verdict.correct,
        stars: verdict.correct ? 3 : 0,
        feedback: verdict.correct ? 'Great work!' : 'Keep going—you can try again!',
        explanation: verdict.correct ? full(id, seed).explanation : undefined,
        skillState: null,
      }),
    }
  })
  fn.posted = posted
  fn.verdicts = () => posted.map((body) => check(widget, answer, body.response))
  return fn
}

const mount = (id, seed, fetchFn, { strict = false } = {}) => {
  global.fetch = fetchFn ?? gradingFetch(id, seed)
  const item = <SolveItem sessionId={SESSION} instance={instanceOf(id, seed)} />
  return render(strict ? <StrictMode>{item}</StrictMode> : item)
}

const pad = () => screen.getByRole('group', { name: /pad/i })
const padKey = (character) =>
  within(pad()).getByRole('button', { name: character === '/' ? /fraction bar/i : character })
const tap = (characters) => {
  for (const character of characters) fireEvent.click(padKey(character))
}
const backspace = () => fireEvent.click(within(pad()).getByRole('button', { name: /delete last/i }))
const clearAll = () => fireEvent.click(within(pad()).getByRole('button', { name: /clear/i }))
const draft = () => screen.getByLabelText('Your answer').value
const checkIt = () => fireEvent.click(screen.getByRole('button', { name: /Check/ }))

afterEach(() => {
  jest.restoreAllMocks()
  delete global.fetch
})

describe('P2.2 — which keys may exist at all', () => {
  it('still ships only the four Phase 1 widgets, so no Band C key has a consumer', () => {
    expect(new Set(problems.map((problem) => problem.widget))).toEqual(
      new Set(['number', 'column', 'fraction', 'cloze', 'choice', 'order', 'sort']),
    )
  })

  it('offers exactly the characters the shipped answers are built from', () => {
    expect([...keysFor('number')].sort()).toEqual(['0', '1', '2', '3', '4', '5', '6', '7', '8', '9'])
    expect([...keysFor('column')].sort()).toEqual(['0', '1', '2', '3', '4', '5', '6', '7', '8', '9'])
    expect([...keysFor('fraction')].sort()).toEqual(['/', '0', '1', '2', '3', '4', '5', '6', '7', '8', '9'])
    expect(keysFor('cloze')).toBeNull()
    expect(keysFor('choice')).toBeNull()
    // Nothing is typed into an ordering list — a pad under it would be a second, silent
    // way to answer that the checker never sees.
    expect(keysFor('order')).toBeNull()
    expect(keysFor('sort')).toBeNull()
    expect(keysFor('expression')).toBeNull()

    // Every offered character is one the shipped answers actually use — the rule that
    // keeps `π` out is the same rule that keeps `.` and `−` out.
    const used = new Set()
    for (const problem of mathProblems) {
      for (let seed = 1; seed <= 200; seed++) for (const character of correctText(problem.id, seed)) used.add(character)
    }
    for (const widget of ['number', 'column', 'fraction']) {
      for (const character of keysFor(widget)) expect(used.has(character)).toBe(true)
    }
  })

  it('leaves out exponent, √ and π because the shipped checker cannot grade them', () => {
    for (const symbol of DEFERRED) {
      expect(check('number', { value: 12 }, { value: `12${symbol}` })).toEqual({ correct: false, reason: 'invalid' })
      expect(check('fraction', { num: 7, den: 9, simplest: true }, { text: `7/9${symbol}` })).toEqual({
        correct: false,
        reason: 'invalid',
      })
      for (const widget of ['number', 'column', 'fraction']) expect(keysFor(widget)).not.toContain(symbol)
    }
  })

  it('shows no pad at all for a widget that has none', () => {
    expect(padlessProblems.length).toBeGreaterThanOrEqual(2)
    for (const problem of padlessProblems) {
      const view = mount(problem.id, SEEDS[0])
      expect(screen.queryByRole('group', { name: /pad/i })).not.toBeInTheDocument()
      view.unmount()
    }
  })
})

describe.each(mathProblems.map((problem) => [problem.id, problem.widget]))('P2.2 — %s (%s)', (id, widget) => {
  it.each(SEEDS)('a kid who only taps the pad is graded right at seed %i', async (seed) => {
    const fetchFn = gradingFetch(id, seed)
    mount(id, seed, fetchFn)

    tap(correctText(id, seed))
    expect(draft()).toBe(correctText(id, seed))

    checkIt()
    await screen.findByText('How Nora solved it')
    expect(fetchFn.verdicts()).toEqual([{ correct: true, reason: null }])
  })

  it.each(SEEDS)('a wrong tap is wrong, not unreadable, at seed %i', async (seed) => {
    const fetchFn = gradingFetch(id, seed)
    mount(id, seed, fetchFn)

    tap(wrongText(id, seed))
    checkIt()
    await screen.findByText(/Keep going/)
    expect(fetchFn.verdicts()).toEqual([{ correct: false, reason: 'wrong' }])
  })

  it('an untouched pad is not a correct answer', async () => {
    const fetchFn = gradingFetch(id, SEEDS[0])
    mount(id, SEEDS[0], fetchFn)

    expect(draft()).toBe('')
    checkIt()
    await waitFor(() => expect(fetchFn.posted).toHaveLength(1))
    expect(fetchFn.verdicts()[0].correct).toBe(false)
  })

  it('deletes the last character only, and survives a delete on nothing', () => {
    mount(id, SEEDS[0])

    backspace()
    expect(draft()).toBe('')

    tap('123')
    backspace()
    expect(draft()).toBe('12')
  })

  it('clears the whole draft', () => {
    mount(id, SEEDS[0])

    tap('4567')
    clearAll()
    expect(draft()).toBe('')
  })

  it('works alongside the physical keyboard rather than replacing it', () => {
    mount(id, SEEDS[0])
    const field = screen.getByLabelText('Your answer')

    fireEvent.change(field, { target: { value: '12' } })
    tap('3')
    expect(draft()).toBe('123')

    fireEvent.change(field, { target: { value: '45' } })
    expect(draft()).toBe('45')
    backspace()
    expect(draft()).toBe('4')
  })

  it('never submits by itself — only Check ✅ posts, and it posts once', async () => {
    const fetchFn = gradingFetch(id, SEEDS[0])
    mount(id, SEEDS[0], fetchFn)

    tap(correctText(id, SEEDS[0]))
    backspace()
    clearAll()
    expect(fetchFn).not.toHaveBeenCalled()

    tap(correctText(id, SEEDS[0]))
    checkIt()
    await screen.findByText('How Nora solved it')
    expect(fetchFn.posted.filter((body) => body.response !== undefined)).toHaveLength(1)
    expect(fetchFn).toHaveBeenCalledTimes(1)
  })

  it('types nothing on its own, even under StrictMode', () => {
    const fetchFn = gradingFetch(id, SEEDS[0])
    mount(id, SEEDS[0], fetchFn, { strict: true })

    expect(draft()).toBe('')
    expect(fetchFn).not.toHaveBeenCalled()
  })

  it('goes quiet once the problem is solved', async () => {
    mount(id, SEEDS[0])

    tap(correctText(id, SEEDS[0]))
    checkIt()
    await screen.findByText('How Nora solved it')

    const solvedDraft = draft()
    for (const button of within(pad()).getAllByRole('button')) expect(button).toBeDisabled()
    tap('1')
    backspace()
    clearAll()
    expect(draft()).toBe(solvedDraft)
  })

  it('is reachable by thumbs and by screen readers', () => {
    mount(id, SEEDS[0])

    const buttons = within(pad()).getAllByRole('button')
    // digits + backspace + clear, plus the bar for fractions
    expect(buttons).toHaveLength(keysFor(widget).length + 2)

    for (const button of buttons) {
      expect(button).toHaveAttribute('type', 'button')
      // Plan §5.2 asks for ≥56 px targets. jsdom computes no layout, so the closest
      // honest check is that the Tailwind sizing this repo styles with is actually on
      // the element.
      expect(button.className).toContain('min-h-[56px]')
      expect(button.className).toContain('min-w-[56px]')
      const name = button.getAttribute('aria-label') ?? button.textContent
      expect(name.trim().length).toBeGreaterThan(0)
      expect(name).not.toMatch(/\bAI\b/)
    }

    expect(pad().textContent).not.toMatch(/\bAI\b/)
    for (const symbol of DEFERRED) expect(pad().textContent).not.toContain(symbol)
  })
})

describe('P2.2 — the fraction bar', () => {
  const fractionProblem = problems.find((problem) => problem.widget === 'fraction')

  it('gives the fraction widget a bar key', () => {
    mount(fractionProblem.id, SEEDS[0])
    expect(within(pad()).getByRole('button', { name: /fraction bar/i })).toBeInTheDocument()
  })

  it.each(['number', 'column'])('gives no bar key to %s, whose answers have none', (widget) => {
    const problem = problems.find((entry) => entry.widget === widget)
    mount(problem.id, SEEDS[0])
    expect(within(pad()).queryByRole('button', { name: /fraction bar/i })).not.toBeInTheDocument()
    expect(pad().textContent).not.toContain('/')
  })

  it('the bar key inserts the character the fraction checker parses', async () => {
    const seed = SEEDS[1]
    const fetchFn = gradingFetch(fractionProblem.id, seed)
    mount(fractionProblem.id, seed, fetchFn)
    const answer = full(fractionProblem.id, seed).answer

    tap(String(answer.num))
    fireEvent.click(padKey('/'))
    tap(String(answer.den))
    expect(draft()).toBe(`${answer.num}/${answer.den}`)

    checkIt()
    await screen.findByText('How Nora solved it')
    expect(fetchFn.posted[0].response).toEqual({ text: `${answer.num}/${answer.den}` })
    expect(fetchFn.verdicts()).toEqual([{ correct: true, reason: null }])
  })
})
