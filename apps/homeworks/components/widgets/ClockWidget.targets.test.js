/**
 * P2.10 review — the clock's touch targets.
 *
 * WHY THIS FILE EXISTS. `HOMEWORK_PLAN.md:203` puts `clock` in band A, and `:104` says band
 * A gets "≥56 px targets". Nothing in the suite held the widget to that, and measurement in
 * Chromium against a production build said it was not being met:
 *
 *   - the only thing `onPointerDown` can grab is the painted `<line>` itself, 6 and 4 user
 *     units of stroke on a 200-unit viewBox drawn at 256 CSS px — 7.7 px and 5.1 px wide.
 *     A touch 25 px away from a hand missed it at 144 positions out of 144, at both a 320
 *     and a 390 px viewport, landing on the white face instead.
 *   - the four steppers measured 24 px tall, against the repo's own
 *     `MathKeypad.js` button size of `min-h-[56px] min-w-[56px]`.
 *
 * WHAT IS ASSERTED, AND WHY IT IS NOT A CLASS-NAME CHECK. jsdom has no layout, so a CSS
 * pixel cannot be measured here. What *can* be measured here is the geometry the browser
 * would lay out from: the SVG is `h-64 w-64` over `viewBox="0 0 200 200"`, a fixed
 * 256/200 = 1.28 CSS px per user unit, so a shape's user-unit size converts to CSS px
 * exactly. Those conversions are done below and asserted as pixel sizes.
 *
 * THE TRAP THIS FILE IS MOSTLY ABOUT. Two fat hit areas on one small face collide. When the
 * hands are colinear — 12:00 is the obvious one, but the sweep below does not rely on
 * guessing which — a naive pair of overlapping targets leaves one hand permanently
 * unreachable, which is a worse bug than the small target it replaced. So the property
 * asserted is not "a big shape exists": it is that at every one of the 144 settable times,
 * each hand has a point that grabs THAT hand and no other.
 *
 * WHAT MUST NOT CHANGE: the painted strokes (this is a hit-area change, not a redesign),
 * the face's size (it has to fit a 320 px viewport, measured at 272 px right edge today),
 * and the digit ban — `AnswerWidget.test.js` exempts `[data-clock-dial]` and nothing else,
 * so a hit shape may carry no text at all.
 *
 * AND ONE MORE, LEARNED THE HARD WAY: `WidgetGallery.test.js` counts `[data-clock-hand]`
 * and requires exactly two. So the grab shape cannot simply wear that attribute as well —
 * a hand has to become one element that OWNS both the stroke the child sees and the area
 * the child touches. That count is asserted below so the next change cannot forget it.
 */
import { describe, expect, it, jest } from '@jest/globals'
import '@testing-library/jest-dom'
import { fireEvent, render } from '@testing-library/react'
import { useState } from 'react'

import { getProblem, listProblems, render as renderProblem, toInstance } from '@grove/curriculum'

import { AnswerWidget } from './AnswerWidget'
import { emptyValue } from './response'

const SEED = 12_345

/** The face is drawn `h-64 w-64` — 256 CSS px — over a 200-unit viewBox. */
const FACE_PX = 256
const VIEWBOX = 200
const SCALE = FACE_PX / VIEWBOX
const MIN_TARGET_PX = 56
const CENTRE = 100

const problem = listProblems().find((meta) => meta.widget === 'clock')
const instanceAt = (seed) => toInstance(renderProblem(getProblem(problem.id), seed))

function Harness({ instance, spy }) {
  const [value, setValue] = useState(() => emptyValue(instance))
  spy.value = value
  return <AnswerWidget instance={instance} value={value} onChange={setValue} />
}

const mount = (instance) => {
  const spy = { value: undefined }
  const view = render(<Harness instance={instance} spy={spy} />)
  return { spy, view }
}

const root = () => document.body.querySelector('[data-clock]')
const faceEl = () => document.body.querySelector('[data-clock-face]')
const hands = () => [...document.body.querySelectorAll('[data-clock-hand]')]
const handFor = (which) => document.body.querySelector(`[data-clock-hand="${which}"]`)
const hitFor = (which) => document.body.querySelector(`[data-clock-hit="${which}"]`)

/** The stroke the child actually sees — the hand element itself, or the line it owns. */
const paintedFor = (which) => {
  const owner = handFor(which)
  if (owner === null) return null
  return owner.tagName.toLowerCase() === 'line' ? owner : owner.querySelector('line')
}

const stepper = (which) => document.body.querySelector(`[data-clock-step="${which}"]`)
const steppers = () => [...document.body.querySelectorAll('[data-clock-step]')]
const showing = () => root().dataset.clockTime

const num = (el, name) => Number(el.getAttribute(name))

/** Degrees clockwise from twelve, for a rotate(...) transform. */
const angleOf = (el) => {
  const transform = el.getAttribute('transform') || ''
  const match = transform.match(/rotate\(\s*(-?[\d.]+)/)
  return match === null ? 0 : Number(match[1])
}

/**
 * Total rotation applied to a shape, its own plus every ancestor's up to the face. A hand
 * that has become a group rotates the group, not the shapes inside it, and a test that
 * only reads the shape's own transform would silently measure the twelve-o'clock position
 * at every one of the 144 times — and pass.
 */
const rotationAbove = (el) => {
  let total = 0
  for (let node = el; node !== null && node !== faceEl(); node = node.parentElement) {
    total += angleOf(node)
  }
  return total
}

/**
 * Where the hit shape sits, in user units, once every rotation above it is applied: the
 * distance of its centre from the pivot, its angle, and the radius of the disc it grabs.
 *
 * Only two shapes are accepted, because only two are honest about their grab radius: a
 * `<circle>` (radius r) and a `<line>` carrying a stroke (radius = half the stroke width).
 * Anything else would need a guess, and a guessed radius is a test that asserts nothing.
 */
const hitGeometry = (el) => {
  const rotation = rotationAbove(el)
  if (el.tagName.toLowerCase() === 'circle') {
    const cx = num(el, 'cx') - CENTRE
    const cy = num(el, 'cy') - CENTRE
    const radius = num(el, 'r')
    const own = (Math.atan2(cx, -cy) * 180) / Math.PI
    return { distance: Math.hypot(cx, cy), degrees: (rotation + own + 360) % 360, radius }
  }
  if (el.tagName.toLowerCase() === 'line') {
    const midX = (num(el, 'x1') + num(el, 'x2')) / 2 - CENTRE
    const midY = (num(el, 'y1') + num(el, 'y2')) / 2 - CENTRE
    const own = (Math.atan2(midX, -midY) * 180) / Math.PI
    return {
      distance: Math.hypot(midX, midY),
      degrees: (rotation + own + 360) % 360,
      radius: num(el, 'stroke-width') / 2,
    }
  }
  throw new Error(`unsupported hit shape <${el.tagName.toLowerCase()}> — use <circle> or <line>`)
}

/** The point, in user units, where a finger should land to take hold of a hand. */
const grabPoint = (el) => {
  const { distance, degrees } = hitGeometry(el)
  const radians = (degrees * Math.PI) / 180
  return { x: CENTRE + distance * Math.sin(radians), y: CENTRE - distance * Math.cos(radians) }
}

/** Is this shape painting anything a child could see? */
const paints = (el) => ['fill', 'stroke'].some((name) => {
  const value = el.getAttribute(name)
  return value !== null && value !== 'none' && value !== 'transparent'
})

const press = (which, times = 1) => {
  for (let index = 0; index < times; index += 1) fireEvent.click(stepper(which))
}

const setHandsTo = (hour, minute) => {
  const [hourNow, minuteNow] = showing().split(':').map(Number)
  press('hour-forward', (hour - hourNow + 12) % 12)
  press('minute-forward', ((minute - minuteNow + 60) % 60) / 5)
}

function pointer(target, type, properties = {}) {
  const event = new Event(type, { bubbles: true, cancelable: true })
  Object.assign(event, { pointerId: 1, pointerType: 'touch', isPrimary: true, button: 0, buttons: type === 'pointerup' ? 0 : 1, ...properties })
  fireEvent(target, event)
  return event
}

describe('P2.10 review — a hand is big enough to take hold of', () => {
  it('draws the face at the size the pixel maths below assumes', () => {
    mount(instanceAt(SEED))
    // If either of these changes, every CSS-pixel number in this file is wrong.
    expect(faceEl()).toHaveAttribute('viewBox', `0 0 ${VIEWBOX} ${VIEWBOX}`)
    expect(faceEl().getAttribute('class')).toMatch(/\bh-64\b.*\bw-64\b|\bw-64\b.*\bh-64\b/)
  })

  it.each(['hour', 'minute'])('gives the %s hand a target at least 56 CSS px across', (which) => {
    mount(instanceAt(SEED))
    const hit = hitFor(which)

    expect(hit).not.toBeNull()
    const { radius } = hitGeometry(hit)
    expect(radius * 2 * SCALE).toBeGreaterThanOrEqual(MIN_TARGET_PX)
  })

  it.each(['hour', 'minute'])('lets the %s hand be grabbed, so the target is the hand', (which) => {
    mount(instanceAt(SEED))
    // What the component's own pointerdown handler does with the event target.
    expect(hitFor(which).closest('[data-clock-hand]')?.dataset.clockHand).toBe(which)
  })

  it('still offers the gallery exactly two hands to count', () => {
    mount(instanceAt(SEED))
    // WidgetGallery.test.js requires this, so the grab shapes have to live INSIDE a hand
    // rather than alongside it as two more things wearing the same attribute.
    expect(hands()).toHaveLength(2)
    expect(hands().map((el) => el.dataset.clockHand).sort()).toEqual(['hour', 'minute'])
  })

  it.each(['hour', 'minute'])('keeps the %s target invisible and silent', (which) => {
    mount(instanceAt(SEED))
    const hit = hitFor(which)

    expect(paints(hit)).toBe(false)
    expect(hit).toHaveAttribute('aria-hidden', 'true')
    expect(hit).not.toHaveAttribute('tabindex')
    // The digit ban in AnswerWidget.test.js exempts the dial and nothing else.
    expect(hit.textContent).toBe('')
  })

  it('leaves the painted hands exactly as they were — this is a hit area, not a redesign', () => {
    mount(instanceAt(SEED))

    expect(paintedFor('hour')).toHaveAttribute('stroke-width', '6')
    expect(paintedFor('hour')).toHaveAttribute('y2', '48')
    expect(paintedFor('minute')).toHaveAttribute('stroke-width', '4')
    expect(paintedFor('minute')).toHaveAttribute('y2', '28')
    expect(paintedFor('hour')).toHaveAttribute('stroke', 'currentColor')
    expect(paintedFor('minute')).toHaveAttribute('stroke', 'currentColor')
  })

  it.each(['hour', 'minute'])('keeps the %s target inside the face, where a finger can reach it', (which) => {
    mount(instanceAt(SEED))
    const { distance, radius } = hitGeometry(hitFor(which))
    // Outside the viewBox is outside the 256 px element, and outside the element is not
    // hit-testable at all — a target that overflows is a target that is partly missing.
    expect(distance + radius).toBeLessThanOrEqual(CENTRE)
  })

  it('keeps both hands independently grabbable at every one of the 144 times', () => {
    mount(instanceAt(SEED))

    const unreachable = []
    for (let hour = 1; hour <= 12; hour += 1) {
      for (let minute = 0; minute < 60; minute += 5) {
        setHandsTo(hour, minute)
        const geometry = { hour: hitGeometry(hitFor('hour')), minute: hitGeometry(hitFor('minute')) }
        const point = { hour: grabPoint(hitFor('hour')), minute: grabPoint(hitFor('minute')) }
        for (const [which, other] of [['hour', 'minute'], ['minute', 'hour']]) {
          const centre = {
            x: CENTRE + geometry[other].distance * Math.sin((geometry[other].degrees * Math.PI) / 180),
            y: CENTRE - geometry[other].distance * Math.cos((geometry[other].degrees * Math.PI) / 180),
          }
          const reach = Math.hypot(point[which].x - centre.x, point[which].y - centre.y)
          // The other hand's target must not swallow this hand's grab point.
          if (reach <= geometry[other].radius) unreachable.push(`${hour}:${String(minute).padStart(2, '0')} ${which}`)
        }
      }
    }

    expect(unreachable).toEqual([])
  })

  it.each(['hour', 'minute'])('moves the %s hand, and only it, when the target is dragged', (which) => {
    const instance = instanceAt(SEED)
    const { spy } = mount(instance)
    jest.spyOn(faceEl(), 'getBoundingClientRect').mockImplementation(() => ({
      top: 0, bottom: VIEWBOX, left: 0, right: VIEWBOX, width: VIEWBOX, height: VIEWBOX, x: 0, y: 0,
    }))
    const hit = hitFor(which)
    // Capture is taken on whatever owns the hand, which may be the shape or its group.
    const owner = handFor(which)
    owner.setPointerCapture = jest.fn()
    owner.releasePointerCapture = jest.fn()

    const from = grabPoint(hit)
    const to = { clientX: CENTRE + 80, clientY: CENTRE }
    pointer(hit, 'pointerdown', { clientX: from.x, clientY: from.y })
    pointer(hit, 'pointermove', to)
    pointer(hit, 'pointerup', to)

    // Ninety degrees is three o'clock and fifteen minutes past.
    if (which === 'minute') {
      expect(spy.value[1]).toBe(15)
      expect(spy.value[0]).toBe(instance.visual.start.hour)
    } else {
      expect(spy.value[0]).toBe(3)
      expect(spy.value[1]).toBe(instance.visual.start.minute)
    }
    expect(owner.setPointerCapture).toHaveBeenCalled()
  })
})

describe('P2.10 review — a stepper is big enough to press', () => {
  it('sizes all four the way the repo sizes the maths keypad', () => {
    mount(instanceAt(SEED))
    expect(steppers()).toHaveLength(4)
    for (const button of steppers()) {
      const className = button.getAttribute('class') || ''
      expect(className).toContain('min-h-[56px]')
      expect(className).toContain('min-w-[56px]')
    }
  })

  it('still does what it did before it grew', () => {
    const instance = instanceAt(SEED)
    const { spy } = mount(instance)

    press('minute-forward')
    expect(spy.value[1]).toBe((instance.visual.start.minute + 5) % 60)
    press('hour-forward')
    expect(spy.value[0]).toBe((instance.visual.start.hour % 12) + 1)
  })
})
