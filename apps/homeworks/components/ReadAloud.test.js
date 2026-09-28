/**
 * P2.1 — 🔊 read-aloud, from the browser's own `speechSynthesis`.
 *
 * WHY THIS EXISTS. HOMEWORK_PLAN.md §5.2 gives Band A (grades 1–2) "🔊 read-aloud
 * auto-offered on every prompt" and Band B (grades 3–5) a "🔊 button", and adds the one
 * architectural constraint: "Read-aloud uses the browser's `speechSynthesis`; no server, no
 * Nora call." §6.7 lays the solve page out as "prompt · 🔊 · widget · 💡 · Check ✅". Every
 * mention of 🔊 in the plan attaches it to the PROMPT, so that — and only that — is what this
 * spec says the button speaks. Reading a hint or the worked solution aloud is not in the
 * plan and is not built here.
 *
 * THE FAKE ENGINE RECORDS, IT DOES NOT ASSERT. jsdom ships no `speechSynthesis` and no
 * `SpeechSynthesisUtterance` at all, so both are installed per test as plain objects that
 * append to an ordered event log. Nothing here spies on the component; the tests read the
 * log the way a child's ear would — what was said, in what order, and when it stopped.
 *
 * THE FOUR THINGS THAT CAN GO WRONG, and why each is a test below:
 *
 *   1. It leaks the answer. Plan §3 principle 5: the client does not hold the answer until
 *      the problem is solved. A read-aloud that helpfully narrates the page could say the
 *      worked solution out loud the moment /attempts replies. Every utterance, at every
 *      point in the flow, must be the prompt and nothing else.
 *   2. It crashes where speech does not exist. The solve page is server-rendered before it
 *      hydrates, and `speechSynthesis` is absent on the server, absent in jsdom, and absent
 *      in older browsers. Rendering must survive that — and must not leave behind a button
 *      that does nothing when a child presses it.
 *   3. It talks over itself. A second press, or moving to the next problem, must stop what
 *      is already being spoken. `speechSynthesis.speak()` queues; without `cancel()` a
 *      child who taps twice hears the question twice, overlapping.
 *   4. It speaks twice per press under StrictMode. PR #84's lesson: React 19 runs effects
 *      twice in development. Speaking must be driven by the press, not by an effect.
 *
 * AND ONE THING THAT MUST NOT REGRESS. `SolveItem.test.js` → "the prompt is not repeated
 * back at the kid" counts occurrences of the sum in `container.textContent` and requires
 * exactly one. A 🔊 button that carries the prompt as its visible label would double it.
 * That count is asserted again here, from this side, so the two specs cannot drift apart.
 */
import { afterEach, describe, expect, it, jest } from '@jest/globals'
import '@testing-library/jest-dom'
import { StrictMode } from 'react'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'

import { getProblem, listProblems, render as renderProblem, toInstance } from '@grove/curriculum'

import { ReadAloudButton } from './ReadAloudButton'
import { SolveItem } from './SolveItem'

const SESSION = 'session-read-aloud'
const SEED = 8181

const pick = (widget) => listProblems().find((problem) => problem.widget === widget)
const full = (id, seed = SEED) => renderProblem(getProblem(id), seed)
const instanceOf = (id, seed = SEED) => toInstance(full(id, seed))

/** One maths problem and one English problem, both real, neither written out as a fixture. */
const NUMBER = pick('number').id
const CLOZE = pick('cloze').id

/**
 * A recording stand-in for the platform's speech engine.
 *
 * `events` is the whole story in order — 'cancel' and 'speak:<text>' — because the bugs this
 * spec is about are ordering bugs: speaking without having cancelled, or cancelling too late.
 * `spoken` is just the texts, for the cheaper assertions.
 */
function installSpeech() {
  const spoken = []
  const events = []
  let speaking = false

  class FakeUtterance {
    constructor(text) {
      this.text = String(text)
      this.lang = undefined
      this.rate = undefined
    }
  }

  const engine = {
    get speaking() {
      return speaking
    },
    get pending() {
      return false
    },
    get paused() {
      return false
    },
    speak(utterance) {
      spoken.push(utterance.text)
      events.push(`speak:${utterance.text}`)
      speaking = true
    },
    cancel() {
      events.push('cancel')
      speaking = false
    },
    pause() {},
    resume() {},
    getVoices: () => [],
  }

  window.speechSynthesis = engine
  window.SpeechSynthesisUtterance = FakeUtterance
  return { spoken, events, engine }
}

function removeSpeech() {
  delete window.speechSynthesis
  delete window.SpeechSynthesisUtterance
}

/** Every `speak` must sit directly behind a `cancel`; that is what stops overlapping speech. */
function everySpeakWasPrecededByCancel(events) {
  return events.every((event, index) => !event.startsWith('speak:') || events[index - 1] === 'cancel')
}

const readButton = () => screen.getByRole('button', { name: /read .*aloud/i })
const queryReadButton = () => screen.queryByRole('button', { name: /read .*aloud/i })

/** A fetch that answers from a table of canned replies and records what it was asked. */
function fakeFetch(replies) {
  const calls = []
  const fn = jest.fn(async (url, options) => {
    const body = JSON.parse(options.body)
    calls.push({ url, body })
    const reply = replies[url]
    if (!reply) throw new Error(`unexpected request to ${url}`)
    const next = typeof reply === 'function' ? reply(body, calls) : reply
    return {
      ok: next.status === undefined || next.status < 400,
      status: next.status ?? 200,
      json: async () => next.body,
    }
  })
  fn.calls = calls
  return fn
}

const ATTEMPTS = '/homeworks/api/attempts'
const HINTS = '/homeworks/api/hints'

const solvedReply = (id) => ({
  body: { correct: true, stars: 3, feedback: 'Great work!', explanation: full(id).explanation, skillState: null },
})
const missedReply = { body: { correct: false, stars: 0, feedback: 'Keep going—you can try again!', skillState: null } }
const hintReply = (id) => ({ body: { hint: full(id).hints[0], hintsUsed: 1 } })

function enterCorrect(id) {
  const answer = full(id).answer
  const { widget } = instanceOf(id)
  if (widget === 'cloze') {
    fireEvent.click(screen.getByRole('radio', { name: answer.blanks[0].accept[0] }))
    return
  }
  const text = widget === 'fraction' ? `${answer.num}/${answer.den}` : String(answer.value)
  fireEvent.change(screen.getByLabelText('Your answer'), { target: { value: text } })
}

afterEach(() => {
  removeSpeech()
  jest.restoreAllMocks()
  delete global.fetch
})

describe('P2.1 — the 🔊 button', () => {
  it('is a real button a child can reach with the keyboard, and says nothing about AI', () => {
    installSpeech()
    render(<ReadAloudButton text="What is 24 × 38?" />)

    const button = readButton()
    expect(button).toBeEnabled()
    expect(button).toHaveAttribute('type', 'button')
    expect(button.textContent).toContain('🔊')
    expect(button.textContent).not.toMatch(/\bAI\b/)
    expect(button).toHaveAccessibleName(expect.stringMatching(/read/i))
  })

  it('speaks the text it was handed, once per press', () => {
    const speech = installSpeech()
    render(<ReadAloudButton text="What is 24 × 38?" />)

    fireEvent.click(readButton())

    expect(speech.spoken).toEqual(['What is 24 × 38?'])
  })

  it('stops what it was already saying before it starts again, so a double-tap is not two voices', () => {
    const speech = installSpeech()
    render(<ReadAloudButton text="What is 24 × 38?" />)

    fireEvent.click(readButton())
    fireEvent.click(readButton())

    expect(speech.spoken).toEqual(['What is 24 × 38?', 'What is 24 × 38?'])
    expect(everySpeakWasPrecededByCancel(speech.events)).toBe(true)
    expect(speech.engine.speaking).toBe(true)
  })

  it('falls silent when the child moves on, rather than finishing the old question over the new one', () => {
    const speech = installSpeech()
    const view = render(<ReadAloudButton text="What is 24 × 38?" />)

    fireEvent.click(readButton())
    view.rerender(<ReadAloudButton text="What is 51 × 17?" />)

    expect(speech.events[speech.events.length - 1]).toBe('cancel')
    expect(speech.engine.speaking).toBe(false)
    expect(speech.spoken).toEqual(['What is 24 × 38?'])
  })

  it('falls silent when it is unmounted, and never speaks after that', () => {
    const speech = installSpeech()
    const view = render(<ReadAloudButton text="What is 24 × 38?" />)

    fireEvent.click(readButton())
    const saidBefore = speech.spoken.length
    view.unmount()

    expect(speech.events[speech.events.length - 1]).toBe('cancel')
    expect(speech.engine.speaking).toBe(false)
    expect(speech.spoken).toHaveLength(saidBefore)
  })

  it('offers nothing at all where the browser cannot speak, rather than a button that does nothing', () => {
    removeSpeech()

    expect(() => render(<ReadAloudButton text="What is 24 × 38?" />)).not.toThrow()
    expect(queryReadButton()).not.toBeInTheDocument()
  })

  it('speaks once per press under StrictMode, and not at all just for having mounted', () => {
    const speech = installSpeech()
    render(
      <StrictMode>
        <ReadAloudButton text="What is 24 × 38?" />
      </StrictMode>,
    )

    expect(speech.spoken).toEqual([])

    fireEvent.click(readButton())

    expect(speech.spoken).toEqual(['What is 24 × 38?'])
  })
})

describe.each([
  ['a maths problem', NUMBER],
  ['an English problem', CLOZE],
])('P2.1 — reading %s aloud on the solve page', (_label, id) => {
  const mount = (fetchFn, props = {}) => {
    global.fetch = fetchFn
    return render(<SolveItem sessionId={SESSION} instance={instanceOf(id)} {...props} />)
  }

  it('reads the question the child is looking at', () => {
    const speech = installSpeech()
    mount(fakeFetch({}))

    fireEvent.click(readButton())

    expect(speech.spoken).toEqual([instanceOf(id).prompt])
  })

  it('never says the worked solution or a hint, at any point in the whole problem', async () => {
    const speech = installSpeech()
    mount(fakeFetch({ [HINTS]: hintReply(id), [ATTEMPTS]: (body, calls) => (calls.filter((call) => call.url === ATTEMPTS).length === 1 ? missedReply : solvedReply(id)) }))
    const { prompt } = instanceOf(id)
    const { hints, explanation } = full(id)

    fireEvent.click(readButton())
    fireEvent.click(screen.getByRole('button', { name: /Hint/ }))
    await screen.findByText(hints[0])
    fireEvent.click(readButton())

    fireEvent.click(screen.getByRole('button', { name: /Check/ }))
    await screen.findByText(/Keep going/)
    fireEvent.click(readButton())

    enterCorrect(id)
    fireEvent.click(screen.getByRole('button', { name: /Check/ }))
    await screen.findByText('How Nora solved it')
    fireEvent.click(readButton())

    expect(speech.spoken).toEqual([prompt, prompt, prompt, prompt])
    for (const said of speech.spoken) {
      expect(said).not.toContain(explanation)
      for (const hint of hints) expect(said).not.toContain(hint)
    }
  })

  it('goes quiet when the child is moved to the next problem', () => {
    const speech = installSpeech()
    const view = mount(fakeFetch({}))

    fireEvent.click(readButton())
    view.unmount()

    expect(speech.events[speech.events.length - 1]).toBe('cancel')
    expect(speech.engine.speaking).toBe(false)
  })

  it('still lets the child solve the problem on a browser with no speech at all', async () => {
    removeSpeech()
    mount(fakeFetch({ [ATTEMPTS]: solvedReply(id) }))

    expect(queryReadButton()).not.toBeInTheDocument()

    enterCorrect(id)
    fireEvent.click(screen.getByRole('button', { name: /Check/ }))

    await screen.findByText('How Nora solved it')
  })

  it('does not print the question a second time to have something to read', () => {
    installSpeech()
    const view = mount(fakeFetch({}))
    const { prompt } = instanceOf(id)

    expect(view.container.textContent.split(prompt).length - 1).toBe(1)
    expect(view.container.textContent).not.toMatch(/\bAI\b/)
  })
})
