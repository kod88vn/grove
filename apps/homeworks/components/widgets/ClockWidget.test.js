/**
 * P2.10 — the `clock` widget: move the hands to show a time.
 *
 * Plan §6.3 gives `clock` one line, and it is the whole contract:
 *
 *   | `clock` | telling time | hh:mm equality | A |
 *
 * "hh:mm equality" means the response carries an hour and a minute and the checker compares
 * both — so the kid's job is to PUT THE HANDS somewhere, not to read a time off a face and
 * type it. A read-and-type exercise would have to print the time it is asking about before
 * the child answers, which is the answer, and it would be the `number` widget anyway.
 * `check.clock.test.js` pins the engine side; this file pins the control the kid touches.
 *
 * THE FACE IS SET TO THE TIME THE PROBLEM STARTS AT. That is the question, not the answer:
 * the template guarantees the duration is never a whole number of hours, so BOTH hands
 * always have to move and an untouched face can never be graded correct. It also means the
 * start may legitimately be on screen, which is why `toInstance()` ships `visual.start`.
 *
 * WHAT IS SNAPPED, AND WHY. The finest granularity the plan ever asks for is five minutes
 * (§6.2 Grade 2, `time-5-minutes`), so the minute hand snaps to the twelve five-minute
 * marks — a child dragging with a finger cannot be asked to land on 4:21, and a widget that
 * let them would manufacture wrong answers out of motor control rather than arithmetic. The
 * hour hand is NOT independently positionable: dragging it chooses the hour SECTOR the
 * finger is released in, and the hand is then drawn from the hour and the minute together,
 * so it sits proportionally between the numerals the way a real clock does. That is 144
 * reachable times, every one of them a time a Grade 1 child is taught to read.
 *
 * The engine knows none of this. `check.clock.test.js` requires 4:21 against 4:20 to be
 * `wrong`, not `invalid` — the grid is a property of this control, and a second control
 * (or a tablet's own time picker) may reach times this one cannot.
 *
 * Four things are pinned here that `AnswerWidget.test.js` deliberately cannot reach.
 *
 * 1. THE DRAG ACTUALLY WORKS, AND SNAPS. A pointer sequence has to be hand-built in jsdom:
 *    `PointerEvent`, `setPointerCapture` and `hasPointerCapture` are all `undefined` there
 *    and `fireEvent.pointerDown` silently drops `clientX`, `clientY` and `pointerId`. The
 *    events below are constructed with `new Event(...)` and `Object.assign`, exactly as
 *    `SortWidget.test.js` and `MatchWidget.test.js` do, and the face gets a stubbed
 *    `getBoundingClientRect` so an angle can be turned into a real coordinate.
 *
 * 2. THE POINTER-CAPTURE TRAP FROM P2.7 IS NOT REPEATED. `setPointerCapture` retargets the
 *    compatibility mouse events that follow, so a button inside a captured element stops
 *    receiving clicks entirely — dead for mouse and touch, still working for a keyboard,
 *    which is the worst way for it to break because every jsdom test still passes. jsdom
 *    cannot observe the retargeting, so what is asserted is the CONSEQUENCE: capture is
 *    never taken when the press lands on a button, it IS taken when it lands on a hand, and
 *    a finger that slides off a button does not drag a hand with it.
 *
 * 3. THE KEYBOARD REACHES EVERY TIME THE DRAG DOES. Four steppers, and the wrap rules that
 *    are easy to get wrong: fifty-five plus five minutes is o'clock WITHOUT carrying an
 *    hour — the child is setting two hands, not adding to a timestamp — and twelve plus one
 *    hour is one. A stepper pair that carried would make some of the 144 times unreachable
 *    by keyboard while remaining reachable by drag.
 *
 * 4. NOTHING PRINTS THE TIME. P2.9's explanation leak and P2.8's give-away position both
 *    began as "it is only showing what the child already knows". The only digits this
 *    widget is allowed to put on screen are the twelve dial numerals — asserted here as
 *    exactly the numbers one to twelve and IDENTICAL AT EVERY SEED, which is a stronger
 *    statement than any exemption, because a dial that cannot vary cannot carry a message.
 *    The time the hands are currently set to reaches assistive technology through the
 *    group's accessible name and `data-clock-time`, never as text.
 *
 * WHAT MUST NOT APPEAR: a text field. P2.6 shipped a hidden `sr-only` "Your answer" box
 * that satisfied every helper in the suite and ate the kid's attempts, so the absence of
 * any typeable control is asserted here rather than assumed.
 */
import { afterEach, describe, expect, it, jest } from '@jest/globals'
import { TextEncoder } from 'node:util'
import '@testing-library/jest-dom'
import { fireEvent, render, screen } from '@testing-library/react'
import { useState } from 'react'

import { check, getProblem, listProblems, render as renderProblem, toInstance } from '@grove/curriculum'

import { AnswerWidget } from './AnswerWidget'
import { emptyValue, toResponse } from './response'

const SEEDS = [12345, 7, 999_999, 2505]

// Shift the floating-point result itself, not its scale: EPSILON multiplication
// often rounds back to the original value at small angles.
function nextUp(number) {
  if (!Number.isFinite(number)) return number
  if (number === 0) return Number.MIN_VALUE
  const bits = new BigUint64Array(new ArrayBuffer(8))
  const floats = new Float64Array(bits.buffer)
  floats[0] = number
  bits[0] += number > 0 ? 1n : -1n
  return floats[0]
}

function dialCoordinates(container) {
  const labels = [...container.querySelectorAll('[data-clock-dial] text')]
  expect(labels.map((label) => label.textContent.trim())).toEqual(
    Array.from({ length: 12 }, (_, index) => String(index + 1)),
  )
  return labels.flatMap((label) => [label.getAttribute('x'), label.getAttribute('y')])
}

// Every module participating in the render uses the same isolated React instance.
function isolatedDial(perturb = false) {
  let result
  jest.isolateModules(() => {
    const react = require('react')
    const { renderToString } = require('react-dom/server')
    const { hydrateRoot } = require('react-dom/client')
    const { ClockWidget } = require('./widgets')
    const properties = { instance: instanceAt(2505), value: [3, 25], onChange: () => {}, disabled: false }
    const element = () => react.createElement(ClockWidget, properties)
    const server = document.createElement('div')
    server.innerHTML = renderToString(element())
    const expected = dialCoordinates(server)

    const sin = Math.sin
    const cos = Math.cos
    try {
      if (perturb) {
        Math.sin = (angle) => nextUp(sin(angle))
        Math.cos = (angle) => nextUp(cos(angle))
      }
      const client = document.createElement('div')
      client.innerHTML = renderToString(element())
      const actual = dialCoordinates(client)
      const rawDiffer = Array.from({ length: 12 }, (_, index) => {
        const angle = ((index + 1) * 30 * Math.PI) / 180
        return 100 + 70 * sin(angle) !== 100 + 70 * Math.sin(angle)
          || 100 - 70 * cos(angle) !== 100 - 70 * Math.cos(angle)
      })
      result = { react, hydrateRoot, element, expected, actual, rawDiffer, server }
    } finally {
      Math.sin = sin
      Math.cos = cos
    }
  })
  return result
}

describe('Clock dial SSR and hydration coordinates', () => {
  const originalMessageChannel = globalThis.MessageChannel
  const originalTextEncoder = globalThis.TextEncoder

  beforeAll(() => {
    globalThis.MessageChannel ??= class {
      constructor() {
        this.port1 = { onmessage: null }
        this.port2 = { postMessage: () => queueMicrotask(() => this.port1.onmessage?.()) }
      }
    }
    globalThis.TextEncoder ??= TextEncoder
  })

  afterAll(() => {
    globalThis.MessageChannel = originalMessageChannel
    globalThis.TextEncoder = originalTextEncoder
  })

  it('serializes all 24 coordinates concisely and within 0.01 of independent geometry', () => {
    const { expected } = isolatedDial()
    expect(expected).toHaveLength(24)
    expected.forEach((coordinate, index) => {
      expect(coordinate).toMatch(/^-?\d+(\.\d{1,2})?$/)
      const angle = (Math.floor(index / 2) + 1) * Math.PI / 6
      const ideal = index % 2 === 0
        ? 100 + 70 * Math.sin(angle)
        : 100 - 70 * Math.cos(angle)
      expect(Math.abs(Number(coordinate) - ideal)).toBeLessThanOrEqual(0.01)
    })
  })

  it('emits the same 24 SVG coordinate strings when trigonometry shifts by one ulp', () => {
    const render = isolatedDial(true)
    expect(render.rawDiffer).toContain(true)
    expect(render.expected).toHaveLength(24)
    expect(render.actual).toEqual(render.expected)
  })

  it('hydrates the server SVG without warnings under a one-ulp trig shift', async () => {
    const previousAct = globalThis.IS_REACT_ACT_ENVIRONMENT
    globalThis.IS_REACT_ACT_ENVIRONMENT = true
    let root
    let render
    const errors = []
    const warnings = []
    const recoverable = []
    const errorSpy = jest.spyOn(console, 'error').mockImplementation((...args) => errors.push(args))
    const warnSpy = jest.spyOn(console, 'warn').mockImplementation((...args) => warnings.push(args))
    try {
      render = isolatedDial(true)
      expect(render.rawDiffer).toContain(true)
      expect(render.expected).toHaveLength(24)

      const sin = Math.sin
      const cos = Math.cos
      try {
        Math.sin = (angle) => nextUp(sin(angle))
        Math.cos = (angle) => nextUp(cos(angle))
        await render.react.act(async () => {
          root = render.hydrateRoot(render.server, render.element(), {
            onRecoverableError: (error) => recoverable.push(error),
          })
        })
      } finally {
        Math.sin = sin
        Math.cos = cos
      }

      expect(dialCoordinates(render.server)).toEqual(render.expected)
      expect(errors).toEqual([])
      expect(warnings).toEqual([])
      expect(recoverable).toEqual([])
    } finally {
      if (root) await render.react.act(async () => root.unmount())
      errorSpy.mockRestore()
      warnSpy.mockRestore()
      globalThis.IS_REACT_ACT_ENVIRONMENT = previousAct
    }
  })
})

/** The face is two hundred units square, so its centre is (100, 100). */
const CENTRE = 100
const REACH = 80

const problem = listProblems().find((meta) => meta.widget === 'clock')
const rendered = (seed) => renderProblem(getProblem(problem.id), seed)
const instanceAt = (seed) => toInstance(rendered(seed))

function Harness({ instance, spy, disabled }) {
  const [value, setValue] = useState(() => emptyValue(instance))
  spy.value = value
  return <AnswerWidget instance={instance} value={value} onChange={setValue} disabled={disabled} />
}

const mount = (instance, { disabled = false } = {}) => {
  const spy = { value: undefined }
  const view = render(<Harness instance={instance} spy={spy} disabled={disabled} />)
  return { spy, view }
}

/** jest-dom's accessible-name matcher takes a string or a regex, never an asymmetric one. */
const containing = (text) => new RegExp(text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'))

const fmt = ({ hour, minute }) => `${hour}:${String(minute).padStart(2, '0')}`

const root = () => document.body.querySelector('[data-clock]')
const face = () => document.body.querySelector('[data-clock-face]')
const dial = () => document.body.querySelector('[data-clock-dial]')
const hand = (which) => document.body.querySelector(`[data-clock-hand="${which}"]`)
const stepper = (which) => document.body.querySelector(`[data-clock-step="${which}"]`)
const steppers = () => [...document.body.querySelectorAll('[data-clock-step]')]

/** What the hands are showing, read off the control rather than out of React. */
const showing = () => root().dataset.clockTime

/** jsdom has no PointerEvent, and fireEvent.pointerDown drops the coordinates. Build it. */
function pointer(target, type, properties = {}) {
  const event = new Event(type, { bubbles: true, cancelable: true })
  Object.assign(event, {
    pointerId: 1,
    pointerType: 'touch',
    isPrimary: true,
    button: 0,
    buttons: type === 'pointerup' ? 0 : 1,
    ...properties,
  })
  fireEvent(target, event)
  return event
}

/**
 * Give the face a real size and the hands the capture methods jsdom does not implement.
 * Returns the capture spies so the P2.7 consequence can be asserted directly.
 */
function layOut() {
  jest.spyOn(face(), 'getBoundingClientRect').mockImplementation(() => ({
    top: 0, bottom: 200, left: 0, right: 200, width: 200, height: 200, x: 0, y: 0,
  }))
  const captures = {}
  for (const which of ['hour', 'minute']) {
    const node = hand(which)
    node.setPointerCapture = jest.fn()
    node.releasePointerCapture = jest.fn()
    captures[which] = node.setPointerCapture
  }
  return captures
}

/** A point on the face at this many degrees clockwise from twelve. */
const pointAt = (degrees) => ({
  clientX: CENTRE + REACH * Math.sin((degrees * Math.PI) / 180),
  clientY: CENTRE - REACH * Math.cos((degrees * Math.PI) / 180),
})

/** Take hold of a hand and let go of it at an angle, the way a finger would. */
function dragTo(which, degrees, { pointerType = 'touch' } = {}) {
  const node = hand(which)
  const to = { ...pointAt(degrees), pointerType }
  pointer(node, 'pointerdown', { clientX: CENTRE, clientY: CENTRE - 10, pointerType })
  pointer(node, 'pointermove', to)
  pointer(node, 'pointerup', to)
}

const press = (which, times = 1) => {
  for (let index = 0; index < times; index++) fireEvent.click(stepper(which))
}

/** Walk the steppers round to a time, using only the controls a keyboard user has. */
function setHandsTo(target) {
  const [hourNow, minuteNow] = showing().split(':').map(Number)
  press('hour-forward', (target.hour - hourNow + 12) % 12)
  press('minute-forward', ((target.minute - minuteNow + 60) % 60) / 5)
}

afterEach(() => {
  jest.restoreAllMocks()
})

describe('P2.10 — the face', () => {
  it.each(SEEDS)('starts with the hands on the time the problem starts at, at seed %i', (seed) => {
    const instance = instanceAt(seed)
    const { spy } = mount(instance)

    expect(showing()).toBe(fmt(instance.visual.start))
    expect(spy.value).toEqual([instance.visual.start.hour, instance.visual.start.minute])
    expect(hand('hour')).not.toBeNull()
    expect(hand('minute')).not.toBeNull()
  })

  it('draws the twelve numerals and nothing else, the same twelve at every seed', () => {
    const dials = SEEDS.map((seed) => {
      const view = render(<Harness instance={instanceAt(seed)} spy={{}} />)
      const text = dial().textContent
      view.unmount()
      return text
    })

    // A dial that cannot vary with the seed cannot be carrying a message about the answer.
    expect(new Set(dials).size).toBe(1)
    const numerals = dials[0].match(/\d+/g).map(Number)
    expect(numerals).toHaveLength(12)
    expect([...numerals].sort((a, b) => a - b)).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12])
  })

  it('puts no digit on screen outside the dial — not even the time the hands are showing', () => {
    const instance = instanceAt(SEEDS[0])
    const { view } = mount(instance)
    setHandsTo({ hour: 7, minute: 35 })

    const clone = view.container.cloneNode(true)
    for (const numerals of clone.querySelectorAll('[data-clock-dial]')) numerals.remove()
    expect(clone.textContent.replace(instance.prompt, ' ')).not.toMatch(/\d/)
  })

  it('announces the time the hands are showing, and keeps announcing it as they move', () => {
    const instance = instanceAt(SEEDS[0])
    mount(instance)

    expect(root()).toHaveAttribute('role', 'group')
    expect(root()).toHaveAttribute('aria-live', 'polite')
    expect(root()).toHaveAccessibleName(containing(fmt(instance.visual.start)))

    setHandsTo({ hour: 2, minute: 45 })
    expect(root()).toHaveAccessibleName(containing('2:45'))
    expect(root()).not.toHaveAccessibleName(containing(fmt(instance.visual.start)))
  })

  it('leaves the hands to the sighted reader — they are not announced and not focusable', () => {
    mount(instanceAt(SEEDS[0]))
    for (const which of ['hour', 'minute']) {
      expect(hand(which)).toHaveAttribute('aria-hidden', 'true')
      expect(hand(which)).not.toHaveAttribute('tabindex')
    }
  })

  it('offers no way to type an answer — the P2.6 hidden field must not come back', () => {
    const { view } = mount(instanceAt(SEEDS[0]))
    expect(screen.queryByLabelText('Your answer')).toBeNull()
    expect(view.container.querySelectorAll('input, textarea, select, [contenteditable]')).toHaveLength(0)
    expect(screen.queryAllByRole('textbox')).toHaveLength(0)
    expect(screen.queryAllByRole('spinbutton')).toHaveLength(0)
  })
})

describe('P2.10 — dragging the hands', () => {
  it.each([
    [0, 0],
    [90, 15],
    [180, 30],
    [270, 45],
    [358, 0],
  ])('the minute hand released at %i° snaps to the nearest five-minute mark, %i', (degrees, minute) => {
    const instance = instanceAt(SEEDS[0])
    const { spy } = mount(instance)
    layOut()

    dragTo('minute', degrees)

    expect(spy.value[1]).toBe(minute)
    // The minute hand is the minute hand. Moving it must not quietly move the hour too.
    expect(spy.value[0]).toBe(instance.visual.start.hour)
  })

  it.each([
    [5, 12],
    [95, 3],
    [185, 6],
    [359, 11],
  ])('the hour hand released at %i° chooses the hour that sector belongs to, %i', (degrees, hour) => {
    const instance = instanceAt(SEEDS[0])
    const { spy } = mount(instance)
    layOut()

    dragTo('hour', degrees)

    expect(spy.value[0]).toBe(hour)
    expect(spy.value[1]).toBe(instance.visual.start.minute)
  })

  it('works for a mouse as well as a finger, and takes capture so the drag survives the edge', () => {
    mount(instanceAt(SEEDS[0]))
    const captures = layOut()

    dragTo('minute', 90, { pointerType: 'mouse' })

    expect(showing().endsWith(':15')).toBe(true)
    expect(captures.minute).toHaveBeenCalled()
  })

  it('never takes capture from a press that landed on a button — the P2.7 trap', () => {
    const instance = instanceAt(SEEDS[0])
    const { spy } = mount(instance)
    const captures = layOut()

    pointer(stepper('minute-forward'), 'pointerdown', { clientX: CENTRE, clientY: CENTRE })
    expect(captures.hour).not.toHaveBeenCalled()
    expect(captures.minute).not.toHaveBeenCalled()

    // And the consequence a capture would have destroyed: the button still works.
    fireEvent.click(stepper('minute-forward'))
    expect(spy.value[1]).toBe((instance.visual.start.minute + 5) % 60)
  })

  it('does not drag a hand when a finger slides off a button', () => {
    const instance = instanceAt(SEEDS[0])
    const { spy } = mount(instance)
    layOut()

    pointer(stepper('hour-forward'), 'pointerdown', { clientX: CENTRE, clientY: CENTRE })
    pointer(face(), 'pointermove', pointAt(270))
    pointer(face(), 'pointerup', pointAt(270))

    expect(spy.value).toEqual([instance.visual.start.hour, instance.visual.start.minute])
  })

  it('a cancelled drag leaves the hands where they were', () => {
    const instance = instanceAt(SEEDS[0])
    const { spy } = mount(instance)
    layOut()

    pointer(hand('minute'), 'pointerdown', { clientX: CENTRE, clientY: CENTRE - 10 })
    pointer(hand('minute'), 'pointermove', pointAt(180))
    pointer(hand('minute'), 'pointercancel', pointAt(180))

    expect(spy.value).toEqual([instance.visual.start.hour, instance.visual.start.minute])
  })
})

describe('P2.10 — the steppers', () => {
  it('offers exactly four, each saying in words what it does', () => {
    mount(instanceAt(SEEDS[0]))
    const labels = steppers().map((button) => button.textContent.trim())

    expect(steppers()).toHaveLength(4)
    expect(new Set(labels).size).toBe(4)
    for (const label of labels) {
      expect(label.length).toBeGreaterThan(0)
      // A digit here would be a second place the time is printed, and P2.9 shipped
      // two buttons whose labels were identical, which is the same bug the other way up.
      expect(label).not.toMatch(/\d/)
    }
    for (const which of ['hour-back', 'hour-forward', 'minute-back', 'minute-forward']) {
      expect(stepper(which).tagName).toBe('BUTTON')
      expect(stepper(which)).toHaveAttribute('type', 'button')
      expect(stepper(which)).toHaveAccessibleName()
    }
  })

  it('walks the minutes round without carrying an hour — the child is setting hands', () => {
    mount(instanceAt(SEEDS[0]))
    setHandsTo({ hour: 4, minute: 55 })

    press('minute-forward')
    expect(showing()).toBe('4:00')

    press('minute-back')
    expect(showing()).toBe('4:55')
  })

  it('walks the hours round the dial, twelve to one and one back to twelve', () => {
    mount(instanceAt(SEEDS[0]))
    setHandsTo({ hour: 12, minute: 20 })

    press('hour-forward')
    expect(showing()).toBe('1:20')

    press('hour-back')
    expect(showing()).toBe('12:20')

    press('hour-back')
    expect(showing()).toBe('11:20')
  })

  it('reaches every one of the 144 times the drag can reach', () => {
    mount(instanceAt(SEEDS[0]))
    const seen = new Set()

    for (let hours = 0; hours < 12; hours++) {
      for (let minutes = 0; minutes < 12; minutes++) {
        seen.add(showing())
        press('minute-forward')
      }
      press('hour-forward')
    }

    expect(seen.size).toBe(144)
  })

  it('hands the page a fresh value rather than editing the one it was given', () => {
    const instance = instanceAt(SEEDS[0])
    const seen = []
    const value = [instance.visual.start.hour, instance.visual.start.minute]
    const frozen = [...value]
    render(<AnswerWidget instance={instance} value={value} onChange={(next) => seen.push(next)} />)

    fireEvent.click(stepper('minute-forward'))

    expect(value).toEqual(frozen)
    expect(seen).toHaveLength(1)
    expect(seen[0]).not.toBe(value)
    expect(seen[0].every(Number.isInteger)).toBe(true)
  })
})

describe('P2.10 — what the checker is handed', () => {
  it.each(SEEDS)('the hands a child sets are graded correct at seed %i', (seed) => {
    const full = rendered(seed)
    const instance = toInstance(full)
    const { spy } = mount(instance)

    setHandsTo(full.answer)

    expect(check('clock', full.answer, toResponse(instance, spy.value))).toEqual({ correct: true, reason: null })
  })

  it.each(SEEDS)('a face left alone is wrong, never correct and never unreadable, at seed %i', (seed) => {
    const full = rendered(seed)
    const instance = toInstance(full)
    const { spy } = mount(instance)

    const result = check('clock', full.answer, toResponse(instance, spy.value))
    expect(result.correct).toBe(false)
    expect(result.reason).toBe('wrong')
  })

  it.each(SEEDS)('moving only one hand is wrong, not correct, at seed %i', (seed) => {
    const full = rendered(seed)
    const instance = toInstance(full)
    const { spy } = mount(instance)

    setHandsTo({ hour: full.answer.hour, minute: instance.visual.start.minute })
    expect(check('clock', full.answer, toResponse(instance, spy.value)).correct).toBe(false)

    setHandsTo({ hour: instance.visual.start.hour, minute: full.answer.minute })
    expect(check('clock', full.answer, toResponse(instance, spy.value)).correct).toBe(false)
  })
})

describe('P2.10 — what a child who cannot see the face is told', () => {
  /**
   * RE-ARM (referee finding, run 124). The first build put the set time in ONE place: the
   * group's `aria-label`, with `aria-live="polite"` on the same element. Measured in real
   * Chromium against a production build, the group is named "Clock, hands showing 3:25"
   * and the four steppers are named "Hour back", "Hour on", "Minute back", "Minute on".
   *
   * A live region announces a change to its CONTENTS. Nothing in the contents changes when
   * a hand moves: the prompt is static, the dial is static, and the hands are `aria-hidden`
   * shapes whose `transform` attribute is not content. So the `aria-live` fires never, and a
   * group's name is read when focus ENTERS the group — not again on the fourth press of the
   * same button. A child using a screen reader can therefore press "Minute on" six times and
   * be told nothing at all about the time they have just set, on the one widget whose entire
   * purpose is setting a time.
   *
   * This repository already solved this, in this same file's neighbours. `OrderWidget` names
   * its arrows "Move 5.6 up, from position 1 of 4"; `SortWidget` names its buttons "Place
   * Parallelogram in Always a rectangle". The state the control is acting on lives in the
   * control's own accessible name, so it is re-announced every time the name changes.
   *
   * The clock must follow its neighbours. The visible text stays digit-free — the name comes
   * from `aria-label`, which `residueOf` never reads, so "the only digits on the face are the
   * dial's" is untouched. The group's `aria-live` STAYS: it cannot fire on its own, but it
   * costs nothing and 'the face' above already pins it. The steppers are what carry the
   * announcement.
   */
  it('names every stepper with the time the hands are on, the way OrderWidget names its arrows', () => {
    mount(instanceAt(SEEDS[0]))
    const time = showing()

    for (const button of steppers()) {
      expect(button).toHaveAccessibleName(containing(time))
      // and the visible text still carries no digit — the name is an aria-label
      expect(button.textContent).not.toMatch(/\d/)
    }
    expect(new Set(steppers().map((button) => button.getAttribute('aria-label'))).size).toBe(4)
  })

  it('re-announces by changing the name, so a fourth press is not silent', () => {
    mount(instanceAt(SEEDS[0]))
    const before = steppers().map((button) => button.getAttribute('aria-label'))
    const timeBefore = showing()

    press('minute-forward')

    const after = steppers().map((button) => button.getAttribute('aria-label'))
    expect(showing()).not.toBe(timeBefore)
    for (let index = 0; index < after.length; index++) {
      expect(after[index]).not.toBe(before[index])
      expect(after[index]).toEqual(expect.stringContaining(showing()))
    }
  })

  it('keeps the name honest at every one of the 144 times, not just the first', () => {
    mount(instanceAt(SEEDS[0]))

    for (let hours = 0; hours < 12; hours++) {
      for (let minutes = 0; minutes < 12; minutes++) {
        for (const button of steppers()) {
          expect(button.getAttribute('aria-label')).toEqual(expect.stringContaining(showing()))
        }
        press('minute-forward')
      }
      press('hour-forward')
    }
  })

  it('still says which hand it moves and which way, so the time is not the whole name', () => {
    mount(instanceAt(SEEDS[0]))
    const time = showing()
    const nameOf = (which) => stepper(which).getAttribute('aria-label')

    for (const which of ['hour-back', 'hour-forward', 'minute-back', 'minute-forward']) {
      const name = nameOf(which)
      expect(name.replace(time, '').trim().length).toBeGreaterThan(6)
      expect(name).toMatch(which.startsWith('hour') ? /hour/i : /minute/i)
    }
  })

  it('keeps naming the region with the set time, on top of the steppers, not instead of them', () => {
    mount(instanceAt(SEEDS[0]))

    // The region's name orients a reader who has just arrived; the steppers' names are what
    // re-announce after each press. Both, not either — 'the face' above pins `aria-live` on
    // this element and that must survive, even though on its own it can never fire.
    expect(root()).toHaveAccessibleName(containing(showing()))
    expect(root()).toHaveAttribute('aria-live', 'polite')

    press('minute-forward')
    expect(root()).toHaveAccessibleName(containing(showing()))
  })
})

describe('P2.10 — while the item is closed', () => {
  it('takes neither a press nor a drag once the answer is in', () => {
    const instance = instanceAt(SEEDS[0])
    const { spy } = mount(instance, { disabled: true })
    const captures = layOut()
    const before = showing()

    for (const button of steppers()) expect(button).toBeDisabled()
    fireEvent.click(stepper('minute-forward'))
    dragTo('minute', 180)

    expect(showing()).toBe(before)
    expect(spy.value).toEqual([instance.visual.start.hour, instance.visual.start.minute])
    expect(captures.minute).not.toHaveBeenCalled()
  })
})
