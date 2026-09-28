/**
 * P2.3 part 1 of 4 — where a kid's three preferences live, and what happens when the place
 * they live in is empty, stale, scribbled on, or not there at all.
 *
 * HOMEWORK_PLAN.md §5.1 makes sounds and confetti "parent-toggleable", §5.2 asks for
 * "dyslexia-friendly font options in settings", and §10 Phase 2 lists "reduced motion,
 * sounds toggle, dyslexia font" as one box. §6.4 gives `students.settings_json` as the
 * eventual home of "sounds, font, read-aloud, tz" — but §10 Phase 7 is where the
 * settings-per-kid screen is scheduled, `app/api/students/route.js` has only GET and POST,
 * and the solve flow (`SessionRunner` → `SolveItem`) never receives a student id. So the
 * Phase 2 home is the browser, and this module is the whole of it. Phase 7 migrates.
 *
 * THIS MODULE MUST NOT TOUCH A GLOBAL. It never reads `window`, never reads `localStorage`,
 * never reads `matchMedia`. The storage is passed in. That is not tidiness: this code runs
 * during server render, where none of those exist, and inside Safari private mode, where
 * `localStorage.getItem` is present and throws. Both are exercised below, and a module that
 * reached for a global would pass in jsdom and fail a child on an iPad.
 *
 * The rule for a bad value is DEFAULT, NOT COERCE. `Boolean('yes')` is `true` and
 * `Boolean(0)` is `false`, so a coercing reader would silently turn a corrupted byte into a
 * preference the kid never chose — the dyslexia font switching itself on, or the sound
 * switching itself off. Two tests below pin exactly that pair.
 */
import { describe, expect, it, jest } from '@jest/globals'

import {
  DEFAULT_SETTINGS,
  SETTINGS_KEY,
  normalizeSettings,
  readSettings,
  writeSettings,
} from './kidSettings'

const ALL_OFF = { animations: false, sounds: false, dyslexiaFont: true }

/** A storage that records every call, so a test can prove which key was touched. */
function fakeStorage(initial = {}) {
  const data = { ...initial }
  const calls = []
  return {
    calls,
    data,
    getItem: jest.fn((key) => {
      calls.push(['getItem', key])
      return Object.prototype.hasOwnProperty.call(data, key) ? data[key] : null
    }),
    setItem: jest.fn((key, value) => {
      calls.push(['setItem', key, value])
      data[key] = String(value)
    }),
  }
}

/** Safari in private browsing: the methods exist and throw. */
function hostileStorage() {
  return {
    getItem: jest.fn(() => {
      throw new DOMException('The quota has been exceeded.')
    }),
    setItem: jest.fn(() => {
      throw new DOMException('The quota has been exceeded.')
    }),
  }
}

/** A storage already holding a settings payload. */
const storedAs = (payload) => fakeStorage({ [SETTINGS_KEY]: payload })

describe('P2.3 — kid settings, defaults', () => {
  it('a child who has never opened settings gets sound, animation and the ordinary font', () => {
    expect(readSettings(fakeStorage())).toEqual({
      animations: true,
      sounds: true,
      dyslexiaFont: false,
    })
  })

  it('sound is on by default, which is what D7 says for a Grade 5 kid', () => {
    expect(DEFAULT_SETTINGS.sounds).toBe(true)
  })

  it('the dyslexia font is off by default, so nobody gets an unasked-for typeface', () => {
    expect(DEFAULT_SETTINGS.dyslexiaFont).toBe(false)
  })

  it('there are exactly three preferences, so a fourth cannot appear without a spec change', () => {
    expect(Object.keys(DEFAULT_SETTINGS).sort()).toEqual(['animations', 'dyslexiaFont', 'sounds'])
  })

  it('a caller that mutates what it was given cannot change what the next caller reads', () => {
    const storage = fakeStorage()
    const first = readSettings(storage)
    first.sounds = false
    first.dyslexiaFont = true
    expect(readSettings(storage)).toEqual({
      animations: true,
      sounds: true,
      dyslexiaFont: false,
    })
    expect(DEFAULT_SETTINGS.sounds).toBe(true)
    expect(DEFAULT_SETTINGS.dyslexiaFont).toBe(false)
  })
})

describe('P2.3 — kid settings, what is turned off stays off', () => {
  it('survives the round trip through storage, all three at once', () => {
    const storage = fakeStorage()
    writeSettings(storage, ALL_OFF)
    expect(readSettings(storage)).toEqual(ALL_OFF)
  })

  it('survives the round trip one preference at a time', () => {
    for (const key of ['animations', 'sounds', 'dyslexiaFont']) {
      const storage = fakeStorage()
      const wanted = { ...DEFAULT_SETTINGS, [key]: !DEFAULT_SETTINGS[key] }
      writeSettings(storage, wanted)
      expect(readSettings(storage)).toEqual(wanted)
    }
  })

  it('writes one key and only one key, and it is the exported one', () => {
    const storage = fakeStorage()
    writeSettings(storage, ALL_OFF)
    expect(storage.calls.filter(([verb]) => verb === 'setItem')).toHaveLength(1)
    expect(Object.keys(storage.data)).toEqual([SETTINGS_KEY])
  })

  it('stores JSON carrying exactly the three preferences, so nothing else rides along', () => {
    const storage = fakeStorage()
    writeSettings(storage, { ...ALL_OFF, studentId: 'public', token: 'secret' })
    const payload = JSON.parse(storage.data[SETTINGS_KEY])
    expect(Object.keys(payload).sort()).toEqual(['animations', 'dyslexiaFont', 'sounds'])
    expect(payload).toEqual(ALL_OFF)
  })

  it('hands back a fresh object each time, so two screens cannot share one mutable copy', () => {
    const storage = storedAs(JSON.stringify(ALL_OFF))
    const a = readSettings(storage)
    const b = readSettings(storage)
    expect(a).toEqual(b)
    expect(a).not.toBe(b)
  })

  it('returns the settings it actually stored, so the screen can show the new state', () => {
    expect(writeSettings(fakeStorage(), { sounds: false })).toEqual({
      animations: true,
      sounds: false,
      dyslexiaFont: false,
    })
  })
})

describe('P2.3 — kid settings, a stored payload that is not what we left there', () => {
  it('keeps the preferences that are present and defaults the one that is missing', () => {
    expect(readSettings(storedAs(JSON.stringify({ animations: false, sounds: false })))).toEqual({
      animations: false,
      sounds: false,
      dyslexiaFont: false,
    })
  })

  it('defaults only the preference whose value is junk, never the neighbours', () => {
    expect(
      readSettings(storedAs(JSON.stringify({ animations: 'maybe', sounds: false, dyslexiaFont: true }))),
    ).toEqual({ animations: true, sounds: false, dyslexiaFont: true })
  })

  it('drops a key it does not know, so a retired preference cannot leak back in', () => {
    const settings = readSettings(storedAs(JSON.stringify({ ...ALL_OFF, readAloudAuto: true })))
    expect(settings).toEqual(ALL_OFF)
    expect('readAloudAuto' in settings).toBe(false)
  })

  it('does not turn a truthy string into a yes — the font stays off', () => {
    expect(normalizeSettings({ dyslexiaFont: 'yes' }).dyslexiaFont).toBe(false)
  })

  it('does not turn a falsy number into a no — the sound stays on', () => {
    expect(normalizeSettings({ sounds: 0, animations: 0 })).toEqual({
      animations: true,
      sounds: true,
      dyslexiaFont: false,
    })
  })

  it('a scribbled-on payload loads the page with defaults instead of throwing', () => {
    expect(readSettings(storedAs('{not json'))).toEqual(DEFAULT_SETTINGS)
  })

  it('an array, a null and a bare string are all treated as no payload at all', () => {
    for (const payload of ['[]', '[1,2,3]', 'null', '"true"', '42', '']) {
      expect(readSettings(storedAs(payload))).toEqual(DEFAULT_SETTINGS)
    }
  })

  it('normalizing leaves the caller’s object untouched', () => {
    const input = { sounds: false, mystery: 1 }
    normalizeSettings(input)
    expect(input).toEqual({ sounds: false, mystery: 1 })
  })

  it('normalizing nothing at all gives the defaults', () => {
    for (const input of [undefined, null, 'nope', 7, []]) {
      expect(normalizeSettings(input)).toEqual(DEFAULT_SETTINGS)
    }
  })
})

describe('P2.3 — kid settings, when there is no storage to read', () => {
  it('renders on the server, where localStorage does not exist', () => {
    expect(readSettings(null)).toEqual(DEFAULT_SETTINGS)
    expect(readSettings(undefined)).toEqual(DEFAULT_SETTINGS)
  })

  it('survives a storage that exists but refuses to be read', () => {
    const storage = hostileStorage()
    expect(readSettings(storage)).toEqual(DEFAULT_SETTINGS)
    expect(storage.getItem).toHaveBeenCalled()
  })

  it('a storage that refuses to be written still lets the kid change the setting', () => {
    const storage = hostileStorage()
    expect(writeSettings(storage, ALL_OFF)).toEqual(ALL_OFF)
    expect(storage.setItem).toHaveBeenCalled()
  })

  it('writing with no storage at all is a no-op, not a crash', () => {
    expect(writeSettings(null, ALL_OFF)).toEqual(ALL_OFF)
    expect(writeSettings(undefined, { sounds: false })).toEqual({
      animations: true,
      sounds: false,
      dyslexiaFont: false,
    })
  })

  it('a storage missing setItem entirely is still safe to write to', () => {
    const readOnly = { getItem: () => null }
    expect(writeSettings(readOnly, ALL_OFF)).toEqual(ALL_OFF)
  })

  it('the storage key is a namespaced string, so it cannot collide with another app', () => {
    expect(typeof SETTINGS_KEY).toBe('string')
    expect(SETTINGS_KEY).toContain('homeworks')
  })
})
