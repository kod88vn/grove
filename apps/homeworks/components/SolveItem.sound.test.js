/**
 * P2.3 part 4 of 4 — the sound a verdict makes, and the four times it must make none.
 *
 * HOMEWORK_PLAN.md §5.1: "Sounds and confetti are parent-toggleable". §10 Phase 2
 * (`:682-683`) lists "sounds toggle" as Phase 2 work, and D7 (`:753`) says sound is on by
 * default for Band A–B. Part 2 shipped the toggle; this is the thing the toggle turns off.
 *
 * THE PLAN NAMES NO AUDIO FILE — not in §5.1, not in D5, not anywhere. Grepping it for
 * `audio` finds only the `audio-spell` widget, which is a different feature. So the sound
 * here is SYNTHESIZED: a short tone built from an oscillator. No binary asset is added to
 * the repo, and no npm package is either.
 *
 * WHAT THIS SPEC IS REALLY ABOUT IS THE FOUR SILENCES, because a noise that fires when it
 * should not is worse than no noise at all:
 *
 *   1. The parent turned sounds off. Nothing is constructed — not a muted context, not a
 *      zero-gain tone. `soundsAllowed === false` means the audio machinery is never touched.
 *   2. There is no Web Audio at all. Server render has no `window`; jsdom has no
 *      `AudioContext`; the locked specs in `SolveItem.test.js` and `SolveItem.inFlight.test.js`
 *      mount this component in exactly that world and must keep passing. Absence is a
 *      no-op, never a throw.
 *   3. Nothing has happened yet. A browser refuses audio before a user gesture and logs a
 *      warning if you try, so no context may be built on import or on mount — only on a
 *      verdict, which is downstream of the child pressing Check. That press IS the gesture.
 *   4. The request failed. A child who is told "Nora couldn't check that right now" is not
 *      told it with a chime.
 *
 * AND ONE NOISE THAT MUST NOT DOUBLE. `next.config.js` sets `reactStrictMode: true`, so
 * every effect runs twice in development. A tone played from an effect would play twice,
 * every time, for every child. It is played from the click path instead, and this spec
 * mounts under `StrictMode` and counts.
 *
 * The fake `AudioContext` below is a recorder, not a mock: it answers like the real API and
 * writes down what was asked of it. Assertions are about what a child would hear — a tone
 * was started, it was stopped, it reached the speakers, and right and wrong sound different.
 */
import { StrictMode } from 'react'

import { afterEach, beforeEach, describe, expect, it, jest } from '@jest/globals'
import '@testing-library/jest-dom'
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react'

import { getProblem, listProblems, render as renderProblem, toInstance } from '@grove/curriculum'

import { KidSettingsProvider } from './KidSettingsProvider'
import { SolveItem } from './SolveItem'
import { SETTINGS_KEY } from '../lib/kidSettings'

const SESSION = 'session-sound'
const SEED = 4242
const REDUCE_QUERY = '(prefers-reduced-motion: reduce)'
const GREAT = 'Great work!'
const AGAIN = 'Keep going—you can try again!'
const RETRY = "Nora couldn't check that right now"

const pick = (widget) => listProblems().find((problem) => problem.widget === widget)
const full = (id) => renderProblem(getProblem(id), SEED)
const instanceOf = (id) => toInstance(full(id))

const MATHS = pick('number').id
const ENGLISH = pick('cloze').id

/**
 * A Web Audio implementation that plays nothing and remembers everything. `instances` is
 * every context that was constructed — which is the number this spec cares about most,
 * because "no sound" has to mean "nothing was built", not "something was built and muted".
 */
function installAudio({ name = 'AudioContext', throwOnConstruct = false } = {}) {
  const instances = []

  class FakeAudioContext {
    constructor() {
      if (throwOnConstruct) throw new Error('Failed to construct AudioContext')
      this.state = 'suspended'
      this.currentTime = 0
      this.sampleRate = 44100
      this.resumes = 0
      this.closes = 0
      this.oscillators = []
      this.gains = []
      this.destination = { label: 'destination' }
      instances.push(this)
    }

    resume() { this.resumes += 1; this.state = 'running'; return Promise.resolve() }
    close() { this.closes += 1; this.state = 'closed'; return Promise.resolve() }

    createOscillator() {
      const node = {
        label: 'oscillator',
        type: 'sine',
        onended: null,
        connectedTo: [],
        started: [],
        stopped: [],
        frequency: {
          value: 0,
          setValueAtTime(value) { node.frequency.value = value; return node.frequency },
          linearRampToValueAtTime(value) { node.frequency.value = value; return node.frequency },
          exponentialRampToValueAtTime(value) { node.frequency.value = value; return node.frequency },
          cancelScheduledValues() { return node.frequency },
        },
        connect(target) { node.connectedTo.push(target); return target },
        disconnect() {},
        addEventListener() {},
        removeEventListener() {},
        start(when = 0) { node.started.push(when) },
        stop(when = 0) { node.stopped.push(when) },
      }
      this.oscillators.push(node)
      return node
    }

    createGain() {
      const node = {
        label: 'gain',
        connectedTo: [],
        gain: {
          value: 1,
          setValueAtTime(value) { node.gain.value = value; return node.gain },
          linearRampToValueAtTime(value) { node.gain.value = value; return node.gain },
          exponentialRampToValueAtTime(value) { node.gain.value = value; return node.gain },
          cancelScheduledValues() { return node.gain },
        },
        connect(target) { node.connectedTo.push(target); return target },
        disconnect() {},
      }
      this.gains.push(node)
      return node
    }
  }

  window[name] = FakeAudioContext
  return instances
}

const tonesOf = (contexts) => contexts.flatMap((context) => context.oscillators)
const pitchesOf = (contexts) => tonesOf(contexts).map((tone) => tone.frequency.value)

function fakeFetch(reply) {
  return jest.fn(async () => {
    const next = typeof reply === 'function' ? reply() : reply
    if (next instanceof Error) throw next
    return { ok: true, status: 200, json: async () => next }
  })
}

const correctReply = (id) => ({
  correct: true, stars: 3, feedback: GREAT, explanation: full(id).explanation, skillState: null,
})
const wrongReply = { correct: false, stars: 0, feedback: AGAIN, skillState: null }

function installMatchMedia(matches) {
  window.matchMedia = () => ({
    media: REDUCE_QUERY,
    matches,
    addEventListener() {},
    removeEventListener() {},
  })
}

function mount(id, fetchFn, { bare = false, strict = false } = {}) {
  global.fetch = fetchFn
  const item = <SolveItem sessionId={SESSION} instance={instanceOf(id)} onSolved={() => {}} />
  const wrapped = bare ? item : <KidSettingsProvider>{item}</KidSettingsProvider>
  return render(strict ? <StrictMode>{wrapped}</StrictMode> : wrapped)
}

const check = () => fireEvent.click(screen.getByRole('button', { name: /Check/ }))
const settle = () => act(async () => { await Promise.resolve() })

beforeEach(() => {
  window.localStorage.clear()
  jest.spyOn(console, 'error').mockImplementation(() => {})
})

afterEach(() => {
  jest.restoreAllMocks()
  delete window.AudioContext
  delete window.webkitAudioContext
  delete window.matchMedia
  delete global.fetch
})

describe.each([['maths', MATHS], ['English', ENGLISH]])('P2.3 — the sound a %s verdict makes', (label, id) => {
  describe('when sounds are on', () => {
    it('plays a tone the child can actually hear when they get it right', async () => {
      installMatchMedia(false)
      const contexts = installAudio()
      mount(id, fakeFetch(correctReply(id)))
      check()

      await screen.findByText(GREAT)
      await waitFor(() => expect(contexts).toHaveLength(1))

      const tones = tonesOf(contexts)
      expect(tones.length).toBeGreaterThanOrEqual(1)
      for (const tone of tones) {
        expect(tone.started).toHaveLength(1)
        // A tone with no stop is a tone that never ends.
        expect(tone.stopped).toHaveLength(1)
        expect(tone.stopped[0]).toBeGreaterThan(tone.started[0])
        // It has to reach the speakers: oscillator -> gain -> destination.
        const gain = tone.connectedTo[0]
        expect(contexts[0].gains).toContain(gain)
        expect(gain.connectedTo).toContain(contexts[0].destination)
      }
    })

    it('pitches the tone somewhere a child would call a sound, not a rumble or a shriek', async () => {
      installMatchMedia(false)
      const contexts = installAudio()
      mount(id, fakeFetch(correctReply(id)))
      check()

      await screen.findByText(GREAT)
      await waitFor(() => expect(tonesOf(contexts).length).toBeGreaterThanOrEqual(1))
      for (const pitch of pitchesOf(contexts)) {
        expect(Number.isFinite(pitch)).toBe(true)
        expect(pitch).toBeGreaterThanOrEqual(100)
        expect(pitch).toBeLessThanOrEqual(2000)
      }
    })

    it('unlocks the audio the browser suspended, because the Check press is the gesture', async () => {
      installMatchMedia(false)
      const contexts = installAudio()
      mount(id, fakeFetch(correctReply(id)))
      check()

      await screen.findByText(GREAT)
      await waitFor(() => expect(contexts).toHaveLength(1))
      expect(contexts[0].resumes).toBeGreaterThanOrEqual(1)
      expect(contexts[0].state).toBe('running')
    })

    it('does not tell a child they were right with the sound for being wrong', async () => {
      installMatchMedia(false)

      const rightContexts = installAudio()
      const right = mount(id, fakeFetch(correctReply(id)))
      check()
      await screen.findByText(GREAT)
      await waitFor(() => expect(tonesOf(rightContexts).length).toBeGreaterThanOrEqual(1))
      const rightPitches = pitchesOf(rightContexts).join(',')
      right.unmount()

      delete window.AudioContext
      const wrongContexts = installAudio()
      mount(id, fakeFetch(wrongReply))
      check()
      await screen.findByText(AGAIN)
      await waitFor(() => expect(tonesOf(wrongContexts).length).toBeGreaterThanOrEqual(1))

      expect(pitchesOf(wrongContexts).join(',')).not.toBe(rightPitches)
    })

    it('builds the audio machinery once and keeps it, however many tries the child takes', async () => {
      installMatchMedia(false)
      const contexts = installAudio()
      mount(id, fakeFetch(wrongReply))

      check()
      await screen.findByText(AGAIN)
      await waitFor(() => expect(tonesOf(contexts).length).toBeGreaterThanOrEqual(1))
      const afterFirst = tonesOf(contexts).length

      check()
      await waitFor(() => expect(tonesOf(contexts).length).toBeGreaterThan(afterFirst))
      // One context per child, not one per answer: browsers cap how many may exist.
      expect(contexts).toHaveLength(1)
    })

    it('falls back to the prefixed constructor old iPads still ship', async () => {
      installMatchMedia(false)
      const contexts = installAudio({ name: 'webkitAudioContext' })
      expect(window.AudioContext).toBeUndefined()

      mount(id, fakeFetch(correctReply(id)))
      check()

      await screen.findByText(GREAT)
      await waitFor(() => expect(contexts).toHaveLength(1))
      expect(tonesOf(contexts).length).toBeGreaterThanOrEqual(1)
    })

    it('stays silent when the device requests reduced motion, even with parent sounds enabled', async () => {
      installMatchMedia(true)
      const contexts = installAudio()
      mount(id, fakeFetch(correctReply(id)))
      check()

      await screen.findByText(GREAT)
      await waitFor(() => expect(contexts).toHaveLength(0))
      expect(screen.getByTestId('verdict')).not.toHaveAttribute('data-animate')
    })

    it('plays once under StrictMode, not once per render pass', async () => {
      installMatchMedia(false)
      const contexts = installAudio()
      mount(id, fakeFetch(correctReply(id)), { strict: true })
      check()

      await screen.findByText(GREAT)
      await waitFor(() => expect(tonesOf(contexts).length).toBeGreaterThanOrEqual(1))
      await settle()
      await settle()

      expect(contexts).toHaveLength(1)
      const played = tonesOf(contexts).length
      await settle()
      expect(tonesOf(contexts)).toHaveLength(played)
    })
  })

  describe('and the silences', () => {
    it('makes no sound at all once a parent has switched sounds off', async () => {
      installMatchMedia(false)
      window.localStorage.setItem(SETTINGS_KEY, JSON.stringify({ sounds: false }))
      const contexts = installAudio()
      mount(id, fakeFetch(correctReply(id)))
      check()

      await screen.findByText(GREAT)
      await settle()
      // Not a muted tone. Nothing was built.
      expect(contexts).toHaveLength(0)
      expect(screen.getByLabelText('3 of 3 stars')).toBeInTheDocument()
    })

    it('says nothing before the child has pressed anything', async () => {
      installMatchMedia(false)
      const contexts = installAudio()
      mount(id, fakeFetch(correctReply(id)))

      await settle()
      expect(contexts).toHaveLength(0)
    })

    it('stays quiet when Nora could not check the answer', async () => {
      installMatchMedia(false)
      const contexts = installAudio()
      mount(id, fakeFetch(() => new Error('offline')))
      check()

      await screen.findByText(RETRY)
      await settle()
      expect(contexts).toHaveLength(0)
      expect(tonesOf(contexts)).toHaveLength(0)
    })

    it('renders and gives the verdict where there is no Web Audio, as in jsdom and on a server', async () => {
      installMatchMedia(false)
      expect(window.AudioContext).toBeUndefined()
      expect(window.webkitAudioContext).toBeUndefined()

      mount(id, fakeFetch(correctReply(id)))
      check()

      await screen.findByText(GREAT)
      expect(screen.getByLabelText('3 of 3 stars')).toBeInTheDocument()
      expect(screen.queryByText(RETRY)).not.toBeInTheDocument()
      expect(console.error).not.toHaveBeenCalled()
    })

    it('survives a browser that refuses to build another AudioContext', async () => {
      installMatchMedia(false)
      installAudio({ throwOnConstruct: true })

      mount(id, fakeFetch(correctReply(id)))
      check()

      // The child still gets told they were right.
      await screen.findByText(GREAT)
      expect(screen.getByLabelText('3 of 3 stars')).toBeInTheDocument()
      expect(screen.queryByText(RETRY)).not.toBeInTheDocument()
    })

    it('behaves the same with no provider above it, which is how the locked specs mount it', async () => {
      const contexts = installAudio()
      mount(id, fakeFetch(correctReply(id)), { bare: true })
      check()

      await screen.findByText(GREAT)
      // Defaults are sounds-on, so a tone is right here — what matters is it does not throw.
      await waitFor(() => expect(contexts).toHaveLength(1))
      expect(screen.getByLabelText('3 of 3 stars')).toBeInTheDocument()
    })
  })
})

describe('P2.3 — one press, one sound', () => {
  it('plays once however many times an impatient child taps Check', async () => {
    installMatchMedia(false)
    const contexts = installAudio()

    let release
    const gate = new Promise((resolve) => { release = resolve })
    global.fetch = jest.fn(async () => {
      await gate
      return { ok: true, status: 200, json: async () => correctReply(MATHS) }
    })
    render(
      <KidSettingsProvider>
        <SolveItem sessionId={SESSION} instance={instanceOf(MATHS)} onSolved={() => {}} />
      </KidSettingsProvider>,
    )

    check()
    check()
    check()
    expect(global.fetch).toHaveBeenCalledTimes(1)

    await act(async () => { release(); await Promise.resolve() })
    await screen.findByText(GREAT)
    await waitFor(() => expect(tonesOf(contexts).length).toBeGreaterThanOrEqual(1))

    const played = tonesOf(contexts).length
    await settle()
    expect(tonesOf(contexts)).toHaveLength(played)
    expect(contexts).toHaveLength(1)
  })
})
