/**
 * P2.3 part 2 of 4 — the three switches themselves, and the two rules that decide whether
 * a switch is allowed to say yes.
 *
 * HOMEWORK_PLAN.md §5.1: "Sounds and confetti are parent-toggleable; respect
 * `prefers-reduced-motion`." §5.2: "keyboard-accessible … dyslexia-friendly font options
 * in settings." §10 Phase 2 lists "reduced motion, sounds toggle, dyslexia font".
 *
 * THE PRECEDENCE IS NOT NEGOTIABLE AND IS THE POINT OF HALF THIS FILE. "Respect
 * `prefers-reduced-motion`" carries no escape clause, so a device that has asked for
 * reduced motion gets none — whatever the toggle says. The toggle can therefore only ever
 * take motion away, never give it back. `motionAllowed === animations && !prefersReducedMotion`
 * is checked at all four corners below, because three of the four are easy to get right by
 * accident and the fourth (reduce ON, toggle ON) is the one a child with vestibular
 * sensitivity actually lives in.
 *
 * NOTHING HERE MAY BE READ DURING RENDER. The settings live in `localStorage`, which does
 * not exist on the server; a provider that read it while rendering would emit different
 * HTML on the server and the client, and React would throw the subtree away and warn. The
 * falsifier is `firstRenderOf` below: it records what the hook returned on the very first
 * render, with storage saying "everything off", and requires that first answer to be
 * "everything on". `useState(() => readSettings(...))` fails it on the first assertion.
 * (That check used to run through `renderToStaticMarkup`; React 19's browser server build
 * needs `MessageChannel`, which jsdom does not have, so the same property is asserted from
 * the render pass instead.)
 *
 * `useKidSettings()` OUTSIDE A PROVIDER MUST NOT THROW. Three locked specs
 * (`SolveItem.test.js`, `SolveItem.inFlight.test.js`, `startOnce.strictMode.test.js`)
 * mount `SolveItem` bare, and parts 3 and 4 of P2.3 put this hook inside it. A hook that
 * insisted on a provider would turn all three red without anyone touching them.
 *
 * SIX CHECKS READ SOURCE TEXT RATHER THAN BEHAVIOUR, AND SAY SO. `app/layout.js` imports
 * `./globals.css`, which jest has no transform for, so the layout cannot be imported here;
 * and jsdom applies no stylesheet, so the `data-` marks this file asserts on could be inert
 * decoration. Those facts are checked by reading the files. That the font really changes on
 * a real page is proved in a browser during review, not here.
 */
import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'

import { afterEach, beforeEach, describe, expect, it, jest } from '@jest/globals'
import '@testing-library/jest-dom'
import { act, fireEvent, render, screen } from '@testing-library/react'
import { StrictMode } from 'react'

import { SETTINGS_KEY } from '../lib/kidSettings'

import { KidSettingsProvider, useKidSettings } from './KidSettingsProvider'
import { SettingsToggles } from './SettingsToggles'
import SettingsPage from '../app/settings/page'

const REDUCE_QUERY = '(prefers-reduced-motion: reduce)'
const APP = join(__dirname, '..', 'app')

const sourceOf = (...parts) => readFileSync(join(APP, ...parts), 'utf8')

/** Prints the hook's answer, so a test can read it out of the DOM. */
function Probe() {
  const { settings, motionAllowed, soundsAllowed, prefersReducedMotion } = useKidSettings()
  return (
    <pre data-testid="probe">
      {JSON.stringify({ ...settings, motionAllowed, soundsAllowed, prefersReducedMotion })}
    </pre>
  )
}

const probe = () => JSON.parse(screen.getByTestId('probe').textContent)

/** Records what the hook returned on every render pass, first one included. */
function Recorder({ into }) {
  const value = useKidSettings()
  into.push({
    ...value.settings,
    motionAllowed: value.motionAllowed,
    soundsAllowed: value.soundsAllowed,
  })
  return null
}

function firstRenderOf() {
  const passes = []
  render(<KidSettingsProvider><Recorder into={passes} /></KidSettingsProvider>)
  return { first: passes[0], last: passes[passes.length - 1] }
}

/** A media query list that records its listeners and can change its mind. */
function fakeMatchMedia(matches) {
  const listeners = []
  const queries = []
  const mql = {
    media: REDUCE_QUERY,
    matches,
    addEventListener: jest.fn((type, handler) => {
      if (type === 'change') listeners.push(handler)
    }),
    removeEventListener: jest.fn((type, handler) => {
      const at = listeners.indexOf(handler)
      if (at >= 0) listeners.splice(at, 1)
    }),
  }
  const media = {
    queries,
    listeners,
    mql,
    install() {
      window.matchMedia = jest.fn((query) => {
        queries.push(query)
        return mql
      })
      return media
    },
    change(next) {
      mql.matches = next
      act(() => {
        for (const handler of [...listeners]) handler({ matches: next, media: REDUCE_QUERY })
      })
    },
  }
  return media
}

const stored = () => JSON.parse(window.localStorage.getItem(SETTINGS_KEY) ?? 'null')
const html = () => document.documentElement
const box = (name) => screen.getByRole('checkbox', { name })

beforeEach(() => {
  window.localStorage.clear()
  html().removeAttribute('data-font')
  html().removeAttribute('data-motion')
})

afterEach(() => {
  delete window.matchMedia
})

describe('P2.3 — a choice a child makes is still there tomorrow', () => {
  it('starts every child with sound, animation and the ordinary font', () => {
    render(<KidSettingsProvider><Probe /></KidSettingsProvider>)
    expect(probe()).toEqual({
      animations: true,
      sounds: true,
      dyslexiaFont: false,
      motionAllowed: true,
      soundsAllowed: true,
      prefersReducedMotion: false,
    })
  })

  it('reads back each switch after a completely fresh page load', () => {
    for (const key of ['animations', 'sounds', 'dyslexiaFont']) {
      for (const wanted of [true, false]) {
        window.localStorage.clear()
        window.localStorage.setItem(SETTINGS_KEY, JSON.stringify({ [key]: wanted }))
        const view = render(<KidSettingsProvider><Probe /></KidSettingsProvider>)
        expect(probe()[key]).toBe(wanted)
        view.unmount()
      }
    }
  })

  it('turning the sound off on the settings screen is what gets written down', () => {
    render(<KidSettingsProvider><SettingsToggles /></KidSettingsProvider>)
    fireEvent.click(box(/sounds/i))
    expect(stored()).toMatchObject({ sounds: false })
  })

  it('a switch that is flipped and flipped back is written down both times', () => {
    render(<KidSettingsProvider><SettingsToggles /></KidSettingsProvider>)
    fireEvent.click(box(/sounds/i))
    expect(stored().sounds).toBe(false)
    fireEvent.click(box(/sounds/i))
    expect(stored().sounds).toBe(true)
  })

  it('and the settings screen shows that choice again the next time it is opened', () => {
    const first = render(<KidSettingsProvider><SettingsToggles /></KidSettingsProvider>)
    fireEvent.click(box(/easy-read font/i))
    first.unmount()

    render(<KidSettingsProvider><SettingsToggles /></KidSettingsProvider>)
    expect(box(/easy-read font/i)).toBeChecked()
    expect(box(/sounds/i)).toBeChecked()
    expect(box(/animations/i)).toBeChecked()
  })

  it('writes nothing at all until the child actually changes something', () => {
    render(
      <StrictMode>
        <KidSettingsProvider><SettingsToggles /></KidSettingsProvider>
      </StrictMode>,
    )
    expect(window.localStorage.getItem(SETTINGS_KEY)).toBeNull()
  })

  it('a double-mounted tree under StrictMode still reads the stored choice, and correctly', () => {
    window.localStorage.setItem(SETTINGS_KEY, JSON.stringify({ sounds: false, dyslexiaFont: true }))
    render(
      <StrictMode>
        <KidSettingsProvider><Probe /></KidSettingsProvider>
      </StrictMode>,
    )
    expect(probe()).toMatchObject({ sounds: false, dyslexiaFont: true, animations: true })
  })

  it('a scribbled-on storage slot opens the settings screen on the defaults', () => {
    window.localStorage.setItem(SETTINGS_KEY, '{not json')
    render(<KidSettingsProvider><SettingsToggles /></KidSettingsProvider>)
    expect(box(/sounds/i)).toBeChecked()
    expect(box(/easy-read font/i)).not.toBeChecked()
  })
})

describe('P2.3 — the first render is the same on the server and in the browser', () => {
  it('renders the defaults first and the stored choice only afterwards', () => {
    window.localStorage.setItem(
      SETTINGS_KEY,
      JSON.stringify({ animations: false, sounds: false, dyslexiaFont: true }),
    )
    const { first, last } = firstRenderOf()

    // The server has no storage, so this is the only answer it could have given.
    expect(first).toEqual({
      animations: true,
      sounds: true,
      dyslexiaFont: false,
      motionAllowed: true,
      soundsAllowed: true,
    })
    // And the child's real choice still arrives, one pass later.
    expect(last).toMatchObject({ animations: false, sounds: false, dyslexiaFont: true })
  })

  it('renders where reaching for localStorage throws, as it does on a server', () => {
    const real = window.localStorage
    Object.defineProperty(window, 'localStorage', {
      configurable: true,
      get() {
        throw new Error('localStorage is not defined')
      },
    })
    try {
      expect(() =>
        render(<KidSettingsProvider><SettingsToggles /></KidSettingsProvider>),
      ).not.toThrow()
    } finally {
      Object.defineProperty(window, 'localStorage', { configurable: true, value: real })
    }
  })

  it('mounts without React complaining about anything', () => {
    const errors = jest.spyOn(console, 'error').mockImplementation(() => {})
    window.localStorage.setItem(SETTINGS_KEY, JSON.stringify({ dyslexiaFont: true }))
    render(<KidSettingsProvider><SettingsToggles /></KidSettingsProvider>)
    expect(errors).not.toHaveBeenCalled()
    errors.mockRestore()
  })
})

describe('P2.3 — the device has the last word on motion', () => {
  it('gives motion when the toggle is on and the device has not asked for less', () => {
    fakeMatchMedia(false).install()
    render(<KidSettingsProvider><Probe /></KidSettingsProvider>)
    expect(probe()).toMatchObject({ animations: true, prefersReducedMotion: false, motionAllowed: true })
  })

  it('takes motion away when the device asks for less, even though the toggle says yes', () => {
    fakeMatchMedia(true).install()
    render(<KidSettingsProvider><Probe /></KidSettingsProvider>)
    expect(probe()).toMatchObject({ animations: true, prefersReducedMotion: true, motionAllowed: false })
  })

  it('silences sound when the device requests reduced motion', () => {
    fakeMatchMedia(true).install()
    render(<KidSettingsProvider><Probe /></KidSettingsProvider>)
    expect(probe()).toMatchObject({ prefersReducedMotion: true, motionAllowed: false, soundsAllowed: false })
  })

  it('takes motion away when the toggle says no and the device has no opinion', () => {
    fakeMatchMedia(false).install()
    window.localStorage.setItem(SETTINGS_KEY, JSON.stringify({ animations: false }))
    render(<KidSettingsProvider><Probe /></KidSettingsProvider>)
    expect(probe()).toMatchObject({ prefersReducedMotion: false, motionAllowed: false })
  })

  it('keeps motion away when both say no', () => {
    fakeMatchMedia(true).install()
    window.localStorage.setItem(SETTINGS_KEY, JSON.stringify({ animations: false }))
    render(<KidSettingsProvider><Probe /></KidSettingsProvider>)
    expect(probe()).toMatchObject({ motionAllowed: false })
  })

  it('never lets the toggle buy motion back from a device that asked for less', () => {
    fakeMatchMedia(true).install()
    render(
      <KidSettingsProvider>
        <SettingsToggles />
        <Probe />
      </KidSettingsProvider>,
    )
    fireEvent.click(box(/animations/i))
    fireEvent.click(box(/animations/i))
    expect(box(/animations/i)).toBeChecked()
    expect(probe().motionAllowed).toBe(false)
  })

  it('asks the browser the reduced-motion question, in those words', () => {
    const media = fakeMatchMedia(false).install()
    render(<KidSettingsProvider><Probe /></KidSettingsProvider>)
    expect(media.queries).toContain(REDUCE_QUERY)
  })

  it('stops animating the moment the child turns Reduce Motion on mid-session', () => {
    const media = fakeMatchMedia(false).install()
    render(<KidSettingsProvider><Probe /></KidSettingsProvider>)
    expect(probe().motionAllowed).toBe(true)

    media.change(true)
    expect(probe()).toMatchObject({ prefersReducedMotion: true, motionAllowed: false })

    media.change(false)
    expect(probe()).toMatchObject({ prefersReducedMotion: false, motionAllowed: true })
  })

  it('lets go of the device listener when the page goes away', () => {
    const media = fakeMatchMedia(false).install()
    const view = render(<KidSettingsProvider><Probe /></KidSettingsProvider>)
    expect(media.listeners.length).toBeGreaterThan(0)
    view.unmount()
    expect(media.listeners).toHaveLength(0)
  })

  it('works in a browser too old to answer the question at all', () => {
    expect(window.matchMedia).toBeUndefined()
    expect(() => render(<KidSettingsProvider><Probe /></KidSettingsProvider>)).not.toThrow()
    expect(probe()).toMatchObject({ prefersReducedMotion: false, motionAllowed: true })
  })
})

describe('P2.3 — what the page itself is told', () => {
  it('marks the document for the easy-read font only when the child asked for it', () => {
    render(<KidSettingsProvider><SettingsToggles /></KidSettingsProvider>)
    expect(html().hasAttribute('data-font')).toBe(false)

    fireEvent.click(box(/easy-read font/i))
    expect(html().getAttribute('data-font')).toBe('dyslexic')

    fireEvent.click(box(/easy-read font/i))
    expect(html().hasAttribute('data-font')).toBe(false)
  })

  it('marks the document as reduced whenever motion is not allowed, by either route', () => {
    const media = fakeMatchMedia(false).install()
    render(<KidSettingsProvider><SettingsToggles /></KidSettingsProvider>)
    expect(html().hasAttribute('data-motion')).toBe(false)

    fireEvent.click(box(/animations/i))
    expect(html().getAttribute('data-motion')).toBe('reduced')

    fireEvent.click(box(/animations/i))
    expect(html().hasAttribute('data-motion')).toBe(false)

    media.change(true)
    expect(html().getAttribute('data-motion')).toBe('reduced')
  })

  it('cleans both marks off the document when it unmounts', () => {
    window.localStorage.setItem(SETTINGS_KEY, JSON.stringify({ animations: false, dyslexiaFont: true }))
    const view = render(<KidSettingsProvider><Probe /></KidSettingsProvider>)
    expect(html().getAttribute('data-font')).toBe('dyslexic')
    expect(html().getAttribute('data-motion')).toBe('reduced')
    view.unmount()
    expect(html().hasAttribute('data-font')).toBe(false)
    expect(html().hasAttribute('data-motion')).toBe(false)
  })
})

describe('P2.3 — the marks are backed by real rules (read from globals.css)', () => {
  it('backs the easy-read mark with a typeface rule, so the mark is not decoration', () => {
    const rule = sourceOf('globals.css').match(/\[data-font=['"]?dyslexic['"]?\][^{]*\{[^}]*\}/)
    expect(rule).not.toBeNull()
    expect(rule[0]).toMatch(/font-family\s*:/)
  })

  it('backs the reduced mark with a rule that actually stops animation', () => {
    const rule = sourceOf('globals.css').match(/\[data-motion=['"]?reduced['"]?\][^{]*\{[^}]*\}/)
    expect(rule).not.toBeNull()
    expect(rule[0]).toMatch(/animation[^:]*:\s*none/)
    expect(rule[0]).toMatch(/transition[^:]*:\s*none/)
  })

  it('honours the media query itself, for the frames before the provider has mounted', () => {
    expect(sourceOf('globals.css')).toMatch(/@media\s*\(\s*prefers-reduced-motion\s*:\s*reduce\s*\)/)
  })

  it('ships no font binary, because the plan names no font', () => {
    const css = sourceOf('globals.css')
    expect(css).not.toMatch(/@font-face/)
    expect(css).not.toMatch(/\.(woff2?|otf|ttf)\b/)
  })
})

describe('P2.3 — the settings screen', () => {
  it('offers exactly three switches, each a real checkbox a keyboard can reach', () => {
    render(<KidSettingsProvider><SettingsPage /></KidSettingsProvider>)
    const boxes = screen.getAllByRole('checkbox')
    expect(boxes).toHaveLength(3)
    for (const each of boxes) expect(each.tagName).toBe('INPUT')
    expect(box(/animations/i)).toBeInTheDocument()
    expect(box(/sounds/i)).toBeInTheDocument()
    expect(box(/easy-read font/i)).toBeInTheDocument()
  })

  it('tells a parent why animations are off when the toggle plainly says on', () => {
    fakeMatchMedia(true).install()
    render(<KidSettingsProvider><SettingsPage /></KidSettingsProvider>)
    expect(box(/animations/i)).toBeChecked()
    expect(screen.getByText(/reduced motion/i)).toBeInTheDocument()
  })

  it('says nothing about reduced motion when the device has not asked for it', () => {
    fakeMatchMedia(false).install()
    render(<KidSettingsProvider><SettingsPage /></KidSettingsProvider>)
    expect(screen.queryByText(/reduced motion/i)).toBeNull()
  })

  it('never calls Nora "AI"', () => {
    fakeMatchMedia(true).install()
    const view = render(<KidSettingsProvider><SettingsPage /></KidSettingsProvider>)
    expect(view.container.textContent).not.toMatch(/\bAI\b/)
  })
})

describe('P2.3 — the switches reach every screen (read from layout.js and page.js)', () => {
  it('is installed once, around the whole app', () => {
    const layout = sourceOf('layout.js')
    expect(layout).toMatch(
      /import\s*\{[^}]*KidSettingsProvider[^}]*\}\s*from\s*['"][^'"]*KidSettingsProvider['"]/,
    )
    expect(layout.match(/<KidSettingsProvider[\s>]/g)).toHaveLength(1)
    expect(layout).toMatch(/<KidSettingsProvider>[\s\S]*\{children\}[\s\S]*<\/KidSettingsProvider>/)
  })

  it('a child can get to the settings screen from the front page', () => {
    // The locked `app/page.links.test.js` already proves every home-page <Link> resolves to
    // a real route, so a link here plus that test is a reachable screen rather than a
    // dead end. The route file is checked directly for the same reason.
    expect(sourceOf('page.js')).toMatch(/<Link[^>]*href=\{?\s*['"]\/settings['"]/)
    expect(existsSync(join(APP, 'settings', 'page.js'))).toBe(true)
  })

  it('a component mounted with no provider still works, on the defaults', () => {
    expect(() => render(<Probe />)).not.toThrow()
    expect(probe()).toMatchObject({
      animations: true,
      sounds: true,
      dyslexiaFont: false,
      motionAllowed: true,
      soundsAllowed: true,
    })
  })
})
