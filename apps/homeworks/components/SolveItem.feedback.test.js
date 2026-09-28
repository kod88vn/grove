/**
 * P2.3 part 3 of 4 — the verdict moves, unless the child's device asked it not to.
 *
 * HOMEWORK_PLAN.md §5.1 is the whole requirement: "Sounds and confetti are
 * parent-toggleable; respect `prefers-reduced-motion`." §10 Phase 2 (`:682-683`) lists
 * "feedback animations, reduced motion" as Phase 2 work. The animated trees and the
 * confetti in §5.1 belong to the **end-of-session card**, which is Phase 3 — so what
 * Phase 2 owes is the feedback the child gets on a single item: the verdict line and the
 * stars.
 *
 * THE ONE THING THAT MUST NOT HAPPEN IS THE OBVIOUS IMPLEMENTATION. The natural way to
 * animate something in is to mount it invisible and fade it up — `opacity: 0`, or a
 * `setTimeout` before it is rendered at all. Either of those costs the child who is using
 * a screen reader the verdict entirely, and breaks the locked specs in `SolveItem.test.js`
 * and `SolveItem.inFlight.test.js`, which read "Great work!" and "3 of 3 stars" the moment
 * the POST resolves. So the rule pinned here is: **the text is in the DOM, visible, in the
 * very same commit that starts the animation.** The motion is decoration laid over text
 * that is already there — never a gate in front of it.
 *
 * The second rule is precedence, and it is the same one part 2 pinned: the device wins.
 * `motionAllowed = settings.animations && !prefersReducedMotion`. A child who switched
 * Reduce Motion on in iPadOS gets a still verdict even with the Animations box ticked.
 *
 * WHY THE MARKER IS A `data-` ATTRIBUTE AND NOT A CLASS NAME. jsdom applies no stylesheet,
 * so asserting on a Tailwind class would assert on a string, not on behaviour. A
 * `data-animate` attribute is the hook the CSS keys off, and this spec also reads
 * `app/globals.css` from disk to prove a real `@keyframes` sits behind the marker — a
 * marker with no animation behind it would pass every DOM assertion and animate nothing.
 *
 * Both a maths item and an English item run the whole matrix, because the verdict is
 * rendered once for every widget and a gate written into one branch only would pass a
 * one-widget spec.
 */
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

import { afterEach, beforeEach, describe, expect, it, jest } from '@jest/globals'
import '@testing-library/jest-dom'
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react'

import { getProblem, listProblems, render as renderProblem, toInstance } from '@grove/curriculum'

import { KidSettingsProvider } from './KidSettingsProvider'
import { SolveItem } from './SolveItem'
import { SETTINGS_KEY } from '../lib/kidSettings'

const SESSION = 'session-feedback'
const SEED = 4242
const ATTEMPTS = '/homeworks/api/attempts'
const REDUCE_QUERY = '(prefers-reduced-motion: reduce)'
const GREAT = 'Great work!'
const AGAIN = 'Keep going—you can try again!'

const pick = (widget) => listProblems().find((problem) => problem.widget === widget)
const full = (id) => renderProblem(getProblem(id), SEED)
const instanceOf = (id) => toInstance(full(id))

/** One maths widget and one English widget: the verdict is shared code, so both must gate. */
const MATHS = pick('number').id
const ENGLISH = pick('cloze').id

function fakeFetch(reply) {
  return jest.fn(async () => {
    const next = typeof reply === 'function' ? reply() : reply
    return { ok: true, status: 200, json: async () => next }
  })
}

const correctReply = (id, stars = 3) => ({
  correct: true, stars, feedback: GREAT, explanation: full(id).explanation, skillState: null,
})
const wrongReply = { correct: false, stars: 0, feedback: AGAIN, skillState: null }

/** A media query list the provider can subscribe to, exactly as part 2's spec builds one. */
function installMatchMedia(matches) {
  const listeners = []
  const mql = {
    media: REDUCE_QUERY,
    matches,
    addEventListener: (type, handler) => { if (type === 'change') listeners.push(handler) },
    removeEventListener: (type, handler) => {
      const at = listeners.indexOf(handler)
      if (at >= 0) listeners.splice(at, 1)
    },
  }
  window.matchMedia = () => mql
  return {
    change(next) {
      mql.matches = next
      act(() => { for (const handler of [...listeners]) handler({ matches: next, media: REDUCE_QUERY }) })
    },
  }
}

/**
 * Mounts the item the way the app does — inside the provider — unless `bare` is asked for,
 * which is how the locked specs mount it and therefore how the defaults must behave.
 */
function mount(id, fetchFn, { bare = false } = {}) {
  global.fetch = fetchFn
  const element = <SolveItem sessionId={SESSION} instance={instanceOf(id)} onSolved={() => {}} />
  return render(bare ? element : <KidSettingsProvider>{element}</KidSettingsProvider>)
}

const check = () => fireEvent.click(screen.getByRole('button', { name: /Check/ }))
const verdict = () => screen.getByTestId('verdict')
const maybeVerdict = () => screen.queryByTestId('verdict')

/** Nothing in this app may hide text in order to animate it. */
function expectReadable(element) {
  expect(element).toBeInTheDocument()
  expect(element).not.toHaveAttribute('hidden')
  expect(element).not.toHaveAttribute('aria-hidden', 'true')
  expect(element.style.opacity).not.toBe('0')
  expect(element.style.visibility).not.toBe('hidden')
  expect(element.style.display).not.toBe('none')
}

beforeEach(() => {
  window.localStorage.clear()
  jest.spyOn(console, 'error').mockImplementation(() => {})
})

afterEach(() => {
  jest.restoreAllMocks()
  delete window.matchMedia
  delete global.fetch
})

describe.each([['maths', MATHS], ['English', ENGLISH]])('P2.3 — the verdict on a %s item', (label, id) => {
  describe('when the child may have motion', () => {
    it('marks the verdict for animation the moment it arrives, without hiding a word of it', async () => {
      installMatchMedia(false)
      mount(id, fakeFetch(correctReply(id)))
      check()

      await waitFor(() => expect(maybeVerdict()).not.toBeNull())
      // Same commit: the element the animation is attached to IS the element holding the text.
      expect(verdict()).toHaveTextContent(GREAT)
      expect(verdict()).toHaveAttribute('data-animate', 'correct')
      expectReadable(verdict())
    })

    it('animates the stars too, and the stars say how many the server sent', async () => {
      installMatchMedia(false)
      mount(id, fakeFetch(correctReply(id, 2)))
      check()

      const stars = await screen.findByLabelText('2 of 3 stars')
      expect(stars.textContent).toBe('⭐⭐')
      expect(stars).toHaveAttribute('data-animate', 'stars')
      expectReadable(stars)
    })

    it('marks a wrong answer differently from a right one, and never awards it stars', async () => {
      installMatchMedia(false)
      mount(id, fakeFetch(wrongReply))
      check()

      await waitFor(() => expect(maybeVerdict()).not.toBeNull())
      expect(verdict()).toHaveTextContent(AGAIN)
      expect(verdict()).toHaveAttribute('data-animate', 'wrong')
      expect(screen.queryByLabelText(/of 3 stars/)).not.toBeInTheDocument()
    })

    it('replays on the next try instead of sitting still after the first', async () => {
      installMatchMedia(false)
      mount(id, fakeFetch(wrongReply))

      check()
      await waitFor(() => expect(maybeVerdict()).not.toBeNull())
      const first = verdict()

      check()
      await waitFor(() => expect(screen.getByTestId('verdict')).not.toBe(first))
      // A CSS animation only runs again if the node is genuinely a new one.
      expect(first.isConnected).toBe(false)
      expect(verdict()).toHaveAttribute('data-animate', 'wrong')
      expect(verdict()).toHaveTextContent(AGAIN)
    })

    it('behaves this way with no provider at all, which is how the locked specs mount it', async () => {
      mount(id, fakeFetch(correctReply(id)), { bare: true })
      check()

      await waitFor(() => expect(maybeVerdict()).not.toBeNull())
      expect(verdict()).toHaveAttribute('data-animate', 'correct')
      expect(verdict()).toHaveTextContent(GREAT)
    })
  })

  describe('when motion is refused', () => {
    it('still says the verdict when the Animations box is unticked, it just does not move', async () => {
      installMatchMedia(false)
      window.localStorage.setItem(SETTINGS_KEY, JSON.stringify({ animations: false }))
      mount(id, fakeFetch(correctReply(id)))
      check()

      await waitFor(() => expect(maybeVerdict()).not.toBeNull())
      expect(verdict()).toHaveTextContent(GREAT)
      expect(verdict()).not.toHaveAttribute('data-animate')
      expectReadable(verdict())
      const stars = screen.getByLabelText('3 of 3 stars')
      expect(stars.textContent).toBe('⭐⭐⭐')
      expect(stars).not.toHaveAttribute('data-animate')
    })

    it('obeys the device even with the Animations box ticked — the device has the last word', async () => {
      installMatchMedia(true)
      mount(id, fakeFetch(correctReply(id)))
      check()

      await waitFor(() => expect(maybeVerdict()).not.toBeNull())
      expect(verdict()).toHaveTextContent(GREAT)
      expect(verdict()).not.toHaveAttribute('data-animate')
      expect(screen.getByLabelText('3 of 3 stars')).not.toHaveAttribute('data-animate')
    })

    it('stops animating the moment the device changes its mind mid-session', async () => {
      const media = installMatchMedia(false)
      mount(id, fakeFetch(wrongReply))

      check()
      await waitFor(() => expect(maybeVerdict()).not.toBeNull())
      expect(verdict()).toHaveAttribute('data-animate', 'wrong')

      media.change(true)
      expect(verdict()).not.toHaveAttribute('data-animate')
      expect(verdict()).toHaveTextContent(AGAIN)
    })
  })

  it('says the verdict exactly once, however it is marked', async () => {
    installMatchMedia(false)
    const view = mount(id, fakeFetch(correctReply(id)))
    check()

    await waitFor(() => expect(maybeVerdict()).not.toBeNull())
    expect(view.container.textContent.split(GREAT).length - 1).toBe(1)
    expect(screen.getAllByTestId('verdict')).toHaveLength(1)
  })

  it('marks nothing at all while there is no verdict to mark', () => {
    installMatchMedia(false)
    mount(id, fakeFetch(correctReply(id)))

    expect(maybeVerdict()).toBeNull()
    expect(document.querySelector('[data-animate]')).toBeNull()
  })
})

describe('the marker has a real animation behind it', () => {
  const css = readFileSync(join(__dirname, '..', 'app', 'globals.css'), 'utf8')

  it.each(['correct', 'wrong', 'stars'])('globals.css styles data-animate="%s"', (name) => {
    expect(css).toContain(`data-animate='${name}'`)
  })

  it('declares keyframes, so the marker is not decoration on nothing', () => {
    expect(css).toMatch(/@keyframes\s+[\w-]+/)
  })

  it('still lets the reduced-motion rule from part 2 switch everything off', () => {
    expect(css).toContain("html[data-motion='reduced']")
    expect(css).toContain('prefers-reduced-motion: reduce')
  })
})
