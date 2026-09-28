/**
 * P2.8 — the `sort` widget: drag cards into named buckets.
 *
 * Plan §6.3 gives `sort` a response of `{ buckets: { <bucketId>: [<itemId>, …] } }`, and the
 * checker treats each bucket as a SET — where inside a bucket a card sits carries no meaning.
 * That is the whole reason this widget can offer a control as plain as a button next to a
 * drag: there is no ordering for the button path to fail to express.
 *
 * Two things are pinned here that `AnswerWidget.test.js` deliberately cannot reach.
 *
 * 1. THE DRAG ACTUALLY WORKS, AND THE BUTTONS STILL WORK UNDERNEATH IT. The generic spec
 *    drives the buttons only, because a pointer sequence has to be built by hand in jsdom —
 *    `PointerEvent`, `setPointerCapture` and `hasPointerCapture` are all `undefined` there,
 *    and `fireEvent.pointerDown` drops `clientX`, `clientY` and `pointerId`. So the events
 *    below are constructed with `new Event(...)` and `Object.assign`, exactly as
 *    `OrderWidget.test.js` does, and the drop targets get a stubbed `getBoundingClientRect`.
 *
 * 2. THE POINTER-CAPTURE TRAP FROM P2.7 IS NOT REPEATED HERE. `setPointerCapture` retargets
 *    the compatibility mouse events that follow, so a button INSIDE a captured element stops
 *    receiving clicks entirely — the control goes dead for mouse and touch while continuing
 *    to work for a keyboard, which is the worst possible way for it to break. `OrderWidget`
 *    solved it by refusing to start a drag when the press landed on a button, and this widget
 *    must solve it the same way rather than inventing a second approach. jsdom cannot observe
 *    the retargeting itself, so what is asserted is the CONSEQUENCE: capture is never taken
 *    when the press lands on a button.
 *
 * The second point is why the keyboard path is not a courtesy. A kid on a trackpad they
 * cannot hold steady, a kid on a screen reader, and a kid on a phone all have to be able to
 * finish the board without a successful drag, so every placement the drag can make is also
 * reachable from a button with an accessible name.
 */
import { afterEach, describe, expect, it, jest } from '@jest/globals'
import '@testing-library/jest-dom'
import { fireEvent, render, screen, within } from '@testing-library/react'
import { useState } from 'react'

import { getProblem, listProblems, render as renderProblem, toInstance } from '@grove/curriculum'

import { AnswerWidget } from './AnswerWidget'
import { emptyValue, toResponse } from './response'

const SEEDS = [12345, 7, 999_999, 2505]
const BAND = 100

const problem = listProblems().find((meta) => meta.widget === 'sort')
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

/** jest-dom's accessible-name matcher takes a string or a regex, never an asymmetric matcher. */
const containing = (text) => new RegExp(text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'))

const cardFor = (itemId) => document.body.querySelector(`[data-sort-item="${itemId}"]`)
const regionFor = (bucketId) => document.body.querySelector(`[data-sort-bucket="${bucketId}"]`)
const tray = () => document.body.querySelector('[data-sort-tray]')

/** Where each card is sitting: a bucket id, or null while it is still in the tray. */
function boardOf(instance) {
  return instance.visual.items.map((item) => {
    const region = cardFor(item.id).closest('[data-sort-bucket]')
    return region === null ? null : region.dataset.sortBucket
  })
}

/**
 * Stack the tray and the buckets into horizontal bands so a drop point is unambiguous, and
 * give every card the capture methods jsdom does not implement.
 */
function layOut(instance) {
  const regions = [tray(), ...instance.visual.buckets.map((bucket) => regionFor(bucket.id))]
  regions.forEach((region, index) => {
    const top = index * BAND
    jest.spyOn(region, 'getBoundingClientRect').mockImplementation(() => ({
      top, bottom: top + BAND, left: 0, right: 300, width: 300, height: BAND, x: 0, y: top,
    }))
  })
  for (const item of instance.visual.items) {
    const card = cardFor(item.id)
    card.setPointerCapture = jest.fn()
    card.releasePointerCapture = jest.fn()
  }
  // The band each target occupies, by bucket id — `null` is the tray.
  const midpoint = new Map([[null, BAND / 2]])
  instance.visual.buckets.forEach((bucket, index) => midpoint.set(bucket.id, (index + 1) * BAND + BAND / 2))
  return midpoint
}

/** Drag a card from wherever it is onto a target, the way a finger would. */
function drag(itemId, targetBucketId, midpoint) {
  const card = cardFor(itemId)
  const y = midpoint.get(targetBucketId)
  pointer(card, 'pointerdown', { clientX: 150, clientY: 10 })
  pointer(card, 'pointermove', { clientX: 150, clientY: y })
  pointer(card, 'pointerup', { clientX: 150, clientY: y })
}

afterEach(() => {
  jest.restoreAllMocks()
})

describe('P2.8 — the sort widget names everything it shows', () => {
  it.each(SEEDS)('every card and every bucket has an accessible name at seed %i', (seed) => {
    const instance = instanceAt(seed)
    mount(instance)

    for (const bucket of instance.visual.buckets) {
      const region = regionFor(bucket.id)
      expect(region).not.toBeNull()
      expect(region).toHaveAccessibleName(containing(bucket.label))
    }
    expect(tray()).not.toBeNull()
    expect(tray()).toHaveAccessibleName(/\S/)

    for (const item of instance.visual.items) {
      expect(cardFor(item.id)).toHaveAccessibleName(containing(item.label))
    }
  })

  it.each(SEEDS)('a card says where it is sitting, not only what it is, at seed %i', (seed) => {
    const instance = instanceAt(seed)
    mount(instance)
    const [item] = instance.visual.items
    const [bucket] = instance.visual.buckets

    const before = cardFor(item.id).getAttribute('aria-label')
    fireEvent.click(
      document.body.querySelector(`[data-sort-place-item="${item.id}"][data-sort-place-bucket="${bucket.id}"]`),
    )
    const after = cardFor(item.id).getAttribute('aria-label')

    expect(after).not.toBe(before)
    expect(after).toContain(item.label)
    expect(after).toContain(bucket.label)
  })

  it.each(SEEDS)('the prompt is asked once, and the widget is labelled by it, at seed %i', (seed) => {
    const instance = instanceAt(seed)
    const { view } = mount(instance)

    expect(screen.getAllByText(instance.prompt)).toHaveLength(1)
    const labelled = view.container.querySelector('[aria-labelledby]')
    expect(labelled).not.toBeNull()
    expect(document.getElementById(labelled.getAttribute('aria-labelledby')).textContent).toBe(instance.prompt)
  })

  it.each(SEEDS)('every card opts out of the browser’s own touch scrolling at seed %i', (seed) => {
    const instance = instanceAt(seed)
    mount(instance)
    for (const item of instance.visual.items) {
      expect(cardFor(item.id).className).toContain('touch-none')
    }
  })
})

describe('P2.8 — the board can be finished without a drag', () => {
  it.each(SEEDS)('one button per card per bucket, each naming where it sends the card, at seed %i', (seed) => {
    const instance = instanceAt(seed)
    mount(instance)

    for (const item of instance.visual.items) {
      for (const bucket of instance.visual.buckets) {
        const button = document.body.querySelector(
          `[data-sort-place-item="${item.id}"][data-sort-place-bucket="${bucket.id}"]`,
        )
        expect(button).not.toBeNull()
        expect(button.tagName).toBe('BUTTON')
        expect(button).toHaveAccessibleName(containing(item.label))
        expect(button).toHaveAccessibleName(containing(bucket.label))
      }
    }
  })

  it.each(SEEDS)('pressing the buttons alone builds a response the checker accepts at seed %i', (seed) => {
    const full = rendered(seed)
    const instance = toInstance(full)
    const { spy } = mount(instance)

    for (const [bucketId, ids] of Object.entries(full.answer.buckets)) {
      for (const id of ids) {
        fireEvent.click(
          document.body.querySelector(`[data-sort-place-item="${id}"][data-sort-place-bucket="${bucketId}"]`),
        )
      }
    }

    const response = toResponse(instance, spy.value)
    expect(Object.keys(response.buckets).sort()).toEqual(instance.visual.buckets.map((b) => b.id).sort())
    for (const [bucketId, ids] of Object.entries(full.answer.buckets)) {
      expect([...response.buckets[bucketId]].sort()).toEqual([...ids].sort())
    }
  })

  it.each(SEEDS)('a card already in a bucket is not offered that bucket again at seed %i', (seed) => {
    const instance = instanceAt(seed)
    mount(instance)
    const [item] = instance.visual.items
    const [bucket] = instance.visual.buckets
    const here = () =>
      document.body.querySelector(`[data-sort-place-item="${item.id}"][data-sort-place-bucket="${bucket.id}"]`)

    expect(here()).toBeEnabled()
    fireEvent.click(here())
    expect(here()).toBeDisabled()
  })

  it.each(SEEDS)('a card can be taken back out of a bucket at seed %i', (seed) => {
    const instance = instanceAt(seed)
    const { spy } = mount(instance)
    const [item] = instance.visual.items
    const [bucket] = instance.visual.buckets

    fireEvent.click(
      document.body.querySelector(`[data-sort-place-item="${item.id}"][data-sort-place-bucket="${bucket.id}"]`),
    )
    expect(spy.value[0]).toBe(bucket.id)

    fireEvent.click(document.body.querySelector(`[data-sort-return-item="${item.id}"]`))
    expect(spy.value[0]).toBeNull()
    expect(cardFor(item.id).closest('[data-sort-bucket]')).toBeNull()
  })
})

describe('P2.8 — the drag', () => {
  it.each(SEEDS)('a card dropped on a bucket lands in it at seed %i', (seed) => {
    const instance = instanceAt(seed)
    const { spy } = mount(instance)
    const midpoint = layOut(instance)
    const [item] = instance.visual.items
    const target = instance.visual.buckets[1]

    drag(item.id, target.id, midpoint)

    expect(spy.value[0]).toBe(target.id)
    expect(boardOf(instance)[0]).toBe(target.id)
  })

  it.each(SEEDS)('a card dragged back to the tray is unsorted again at seed %i', (seed) => {
    const instance = instanceAt(seed)
    const { spy } = mount(instance)
    let midpoint = layOut(instance)
    const [item] = instance.visual.items
    const target = instance.visual.buckets[0]

    drag(item.id, target.id, midpoint)
    expect(spy.value[0]).toBe(target.id)

    jest.restoreAllMocks()
    midpoint = layOut(instance)
    drag(item.id, null, midpoint)
    expect(spy.value[0]).toBeNull()
  })

  it.each(SEEDS)('a card released over nothing stays where it was at seed %i', (seed) => {
    const instance = instanceAt(seed)
    const { spy } = mount(instance)
    const midpoint = layOut(instance)
    const [item] = instance.visual.items
    const before = JSON.stringify(spy.value)

    const card = cardFor(item.id)
    pointer(card, 'pointerdown', { clientX: 150, clientY: 10 })
    pointer(card, 'pointermove', { clientX: 150, clientY: 5000 })
    pointer(card, 'pointerup', { clientX: 150, clientY: 5000 })

    expect(JSON.stringify(spy.value)).toBe(before)
  })

  it.each(SEEDS)('dragging alone builds a response the checker accepts at seed %i', (seed) => {
    const full = rendered(seed)
    const instance = toInstance(full)
    const { spy } = mount(instance)

    for (const [bucketId, ids] of Object.entries(full.answer.buckets)) {
      for (const id of ids) {
        jest.restoreAllMocks()
        const midpoint = layOut(instance)
        drag(id, bucketId, midpoint)
      }
    }

    const response = toResponse(instance, spy.value)
    for (const [bucketId, ids] of Object.entries(full.answer.buckets)) {
      expect([...response.buckets[bucketId]].sort()).toEqual([...ids].sort())
    }
  })
})

/**
 * The P2.7 trap, restated for this widget. `setPointerCapture` retargets the compatibility
 * mouse events that follow the pointer sequence, so a button inside a captured element stops
 * receiving clicks for mouse and touch while a keyboard still works — silently, and not
 * visible to jsdom. The fix is `OrderWidget`'s: refuse to start a drag when the press landed
 * on a button. What can be measured here is that refusal.
 */
describe('P2.8 — pressing a place button is a press, not the start of a drag', () => {
  it.each(SEEDS)('no capture is taken when the press lands on a button at seed %i', (seed) => {
    const instance = instanceAt(seed)
    mount(instance)
    layOut(instance)
    const [item] = instance.visual.items
    const [bucket] = instance.visual.buckets

    const button = document.body.querySelector(
      `[data-sort-place-item="${item.id}"][data-sort-place-bucket="${bucket.id}"]`,
    )
    pointer(button, 'pointerdown', { clientX: 150, clientY: 10 })

    expect(cardFor(item.id).setPointerCapture).not.toHaveBeenCalled()
  })

  it.each(SEEDS)('capture IS taken when the press lands on the card itself at seed %i', (seed) => {
    const instance = instanceAt(seed)
    mount(instance)
    layOut(instance)
    const [item] = instance.visual.items

    pointer(cardFor(item.id), 'pointerdown', { clientX: 150, clientY: 10 })

    expect(cardFor(item.id).setPointerCapture).toHaveBeenCalled()
  })

  it.each(SEEDS)('a finger sliding off a button does not carry the card with it at seed %i', (seed) => {
    const instance = instanceAt(seed)
    const { spy } = mount(instance)
    const midpoint = layOut(instance)
    const [item] = instance.visual.items
    const [bucket, other] = instance.visual.buckets
    const before = JSON.stringify(spy.value)

    const button = document.body.querySelector(
      `[data-sort-place-item="${item.id}"][data-sort-place-bucket="${bucket.id}"]`,
    )
    pointer(button, 'pointerdown', { clientX: 150, clientY: 10 })
    pointer(cardFor(item.id), 'pointermove', { clientX: 150, clientY: midpoint.get(other.id) })
    pointer(cardFor(item.id), 'pointerup', { clientX: 150, clientY: midpoint.get(other.id) })

    expect(JSON.stringify(spy.value)).toBe(before)
  })

  it.each(SEEDS)('a press on a button still places the card at seed %i', (seed) => {
    const instance = instanceAt(seed)
    const { spy } = mount(instance)
    layOut(instance)
    const [item] = instance.visual.items
    const [bucket] = instance.visual.buckets

    const button = document.body.querySelector(
      `[data-sort-place-item="${item.id}"][data-sort-place-bucket="${bucket.id}"]`,
    )
    pointer(button, 'pointerdown', { clientX: 150, clientY: 10 })
    pointer(button, 'pointerup', { clientX: 150, clientY: 10 })
    fireEvent.click(button)

    expect(spy.value[0]).toBe(bucket.id)
  })
})

describe('P2.8 — a disabled board accepts nothing', () => {
  it.each(SEEDS)('no button is live and no drag starts at seed %i', (seed) => {
    const instance = instanceAt(seed)
    const { spy } = mount(instance, { disabled: true })
    const midpoint = layOut(instance)
    const before = JSON.stringify(spy.value)
    const [item] = instance.visual.items
    const [bucket] = instance.visual.buckets

    for (const button of screen.getAllByRole('button')) expect(button).toBeDisabled()

    drag(item.id, bucket.id, midpoint)
    expect(cardFor(item.id).setPointerCapture).not.toHaveBeenCalled()
    expect(JSON.stringify(spy.value)).toBe(before)
  })
})

describe('P2.8 — the board shows only what the server sent', () => {
  it.each(SEEDS)('each card appears exactly once, wherever it sits, at seed %i', (seed) => {
    const instance = instanceAt(seed)
    mount(instance)
    const [item] = instance.visual.items
    const [bucket] = instance.visual.buckets

    expect(document.body.querySelectorAll(`[data-sort-item="${item.id}"]`)).toHaveLength(1)
    fireEvent.click(
      document.body.querySelector(`[data-sort-place-item="${item.id}"][data-sort-place-bucket="${bucket.id}"]`),
    )
    expect(document.body.querySelectorAll(`[data-sort-item="${item.id}"]`)).toHaveLength(1)
    expect(within(regionFor(bucket.id)).getByText(item.label)).toBeInTheDocument()
  })

  it.each(SEEDS)('the widget invents no digit of its own at seed %i', (seed) => {
    const instance = instanceAt(seed)
    const { view } = mount(instance)

    const sent = [
      instance.prompt,
      ...instance.visual.items.map((item) => item.label),
      ...instance.visual.buckets.map((bucket) => bucket.label),
    ]
    let residue = view.container.textContent
    for (const piece of sent.sort((a, b) => b.length - a.length)) residue = residue.split(piece).join(' ')
    expect(residue).not.toMatch(/[0-9]/)
  })
})
