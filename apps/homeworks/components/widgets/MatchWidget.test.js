/**
 * P2.9 — the `match` widget: pair each item on the left with an item on the right.
 *
 * Plan §6.3 gives `match` a response of `{ pairs: [{ left, right }, …] }` and a checker rule
 * of "pair set equality" — the couples are compared as a SET, so neither the order the
 * couples are listed in nor the order the two columns are displayed in carries any meaning.
 * `check.match.test.js` pins that in the engine; this file pins the control the kid touches.
 *
 * THE BOARD IS A TRAY OF RIGHT-HAND CARDS AND ONE SLOT PER LEFT-HAND ITEM. That shape is
 * chosen, not incidental: `sort` already solved "move a card into a named region", it is
 * already tested, and a child who has met one board should not have to learn a second set of
 * gestures. So a `match` board is a `sort` board whose buckets are the left column and whose
 * cards are the right column, with exactly one rule added — a slot holds at most one card.
 *
 * Three things are pinned here that `AnswerWidget.test.js` deliberately cannot reach.
 *
 * 1. THE DRAG ACTUALLY WORKS. The generic spec drives buttons only, because a pointer
 *    sequence has to be hand-built in jsdom: `PointerEvent`, `setPointerCapture` and
 *    `hasPointerCapture` are all `undefined` there, and `fireEvent.pointerDown` silently
 *    drops `clientX`, `clientY` and `pointerId`. The events below are constructed with
 *    `new Event(...)` and `Object.assign`, exactly as `OrderWidget.test.js` and
 *    `SortWidget.test.js` do, and the drop targets get a stubbed `getBoundingClientRect`.
 *
 * 2. THE POINTER-CAPTURE TRAP FROM P2.7 IS NOT REPEATED. `setPointerCapture` retargets the
 *    compatibility mouse events that follow, so a button INSIDE a captured element stops
 *    receiving clicks entirely — the control goes dead for mouse and touch while continuing
 *    to work for a keyboard, which is the worst possible way for it to break, because every
 *    jsdom test still passes. jsdom cannot observe the retargeting, so what is asserted is
 *    the CONSEQUENCE: capture is never taken when the press lands on a button, it IS taken
 *    when the press lands on the card, and a finger that slides off a button does not drag
 *    the card with it. The fix is `OrderWidget`'s `closest('button')` refusal; this widget
 *    must reuse it rather than invent a second approach.
 *
 * 3. A SLOT HOLDS ONE CARD, AND A FULL BOARD IS NEVER A DEAD END. This is the only rule
 *    `sort` does not have, and it is where a keyboard user gets trapped if it is done
 *    carelessly: if pairing into an occupied slot were simply refused, a kid who filled
 *    every slot in the wrong arrangement could not change any of it without first knowing
 *    to unpair. So dropping a card on an occupied slot must return the sitting card to the
 *    tray, and that is asserted from a completely paired board.
 *
 * WHAT MUST NOT APPEAR: a text field. P2.6 shipped a hidden `sr-only` "Your answer" box that
 * satisfied every helper in the suite and ate the kid's attempts, so the absence of one is
 * asserted here rather than assumed.
 */
import { afterEach, describe, expect, it, jest } from '@jest/globals'
import '@testing-library/jest-dom'
import { fireEvent, render, screen, within } from '@testing-library/react'
import { useState } from 'react'

import { check, getProblem, listProblems, render as renderProblem, toInstance } from '@grove/curriculum'

import { AnswerWidget } from './AnswerWidget'
import { emptyValue, toResponse } from './response'

const SEEDS = [12345, 7, 999_999, 2505]
const BAND = 100

const problem = listProblems().find((meta) => meta.widget === 'match')
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

const cardFor = (rightId) => document.body.querySelector(`[data-match-card="${rightId}"]`)
const slotFor = (leftId) => document.body.querySelector(`[data-match-slot="${leftId}"]`)
const tray = () => document.body.querySelector('[data-match-tray]')
const pairButton = (rightId, leftId) =>
  document.body.querySelector(`[data-match-pair-card="${rightId}"][data-match-pair-slot="${leftId}"]`)
const returnButton = (rightId) => document.body.querySelector(`[data-match-return-card="${rightId}"]`)

/** Which slot each right-hand card is sitting in, or null while it is still in the tray. */
function boardOf(instance) {
  return instance.visual.right.map((card) => {
    const slot = cardFor(card.id).closest('[data-match-slot]')
    return slot === null ? null : slot.dataset.matchSlot
  })
}

/** The answer, as a lookup from left id to the right id it belongs with. */
const pairingOf = (full) => new Map(full.answer.pairs.map((pair) => [pair.left, pair.right]))

/**
 * Stack the tray and the slots into horizontal bands so a drop point is unambiguous, and
 * give every card the capture methods jsdom does not implement.
 */
function layOut(instance) {
  const regions = [tray(), ...instance.visual.left.map((item) => slotFor(item.id))]
  regions.forEach((region, index) => {
    const top = index * BAND
    jest.spyOn(region, 'getBoundingClientRect').mockImplementation(() => ({
      top, bottom: top + BAND, left: 0, right: 300, width: 300, height: BAND, x: 0, y: top,
    }))
  })
  for (const card of instance.visual.right) {
    const node = cardFor(card.id)
    node.setPointerCapture = jest.fn()
    node.releasePointerCapture = jest.fn()
  }
  // The band each target occupies, by left id — `null` is the tray.
  const midpoint = new Map([[null, BAND / 2]])
  instance.visual.left.forEach((item, index) => midpoint.set(item.id, (index + 1) * BAND + BAND / 2))
  return midpoint
}

/** Drag a card from wherever it is onto a target, the way a finger would. */
function drag(rightId, targetLeftId, midpoint) {
  const node = cardFor(rightId)
  const y = midpoint.get(targetLeftId)
  pointer(node, 'pointerdown', { clientX: 150, clientY: 10 })
  pointer(node, 'pointermove', { clientX: 150, clientY: y })
  pointer(node, 'pointerup', { clientX: 150, clientY: y })
}

/** Pair the whole board correctly, using the buttons only. */
function pairCorrectly(full) {
  for (const pair of full.answer.pairs) fireEvent.click(pairButton(pair.right, pair.left))
}

afterEach(() => {
  jest.restoreAllMocks()
})

describe('P2.9 — the match board names everything it shows', () => {
  it.each(SEEDS)('both columns are readable and shown as they were sent at seed %i', (seed) => {
    const instance = instanceAt(seed)
    const { view } = mount(instance)
    const text = view.container.textContent

    // A kid cannot join two things they cannot read, so both columns are rendered in full.
    for (const item of instance.visual.left) expect(text).toContain(item.label)
    for (const card of instance.visual.right) expect(text).toContain(card.label)

    // The widget must not re-sort either column. The template already measured that the
    // dealt order leaks nothing; a widget that rearranged them could undo that.
    expect([...document.body.querySelectorAll('[data-match-slot]')].map((node) => node.dataset.matchSlot)).toEqual(
      instance.visual.left.map((item) => item.id),
    )
    expect([...document.body.querySelectorAll('[data-match-card]')].map((node) => node.dataset.matchCard)).toEqual(
      instance.visual.right.map((card) => card.id),
    )
  })

  it.each(SEEDS)('every slot and every card has an accessible name at seed %i', (seed) => {
    const instance = instanceAt(seed)
    mount(instance)

    for (const item of instance.visual.left) {
      const slot = slotFor(item.id)
      expect(slot).not.toBeNull()
      expect(slot).toHaveAccessibleName(containing(item.label))
    }
    expect(tray()).not.toBeNull()
    expect(tray()).toHaveAccessibleName(/\S/)

    for (const card of instance.visual.right) {
      expect(cardFor(card.id)).toHaveAccessibleName(containing(card.label))
    }
  })

  it.each(SEEDS)('a pair is announced, not left to be inferred from layout, at seed %i', (seed) => {
    const instance = instanceAt(seed)
    mount(instance)
    const [item] = instance.visual.left
    const [card] = instance.visual.right

    const before = cardFor(card.id).getAttribute('aria-label')
    fireEvent.click(pairButton(card.id, item.id))
    const after = cardFor(card.id).getAttribute('aria-label')

    // A sighted kid sees the card move. A kid on a screen reader is told, in words, that
    // this card is now with that description — position is not an announcement.
    expect(after).not.toBe(before)
    expect(after).toContain(card.label)
    expect(after).toContain(item.label)
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
    for (const card of instance.visual.right) {
      expect(cardFor(card.id).className).toContain('touch-none')
    }
  })

  it.each(SEEDS)('there is no text field to type an answer into at seed %i', (seed) => {
    const instance = instanceAt(seed)
    const { view } = mount(instance)

    // P2.6 shipped an `sr-only` "Your answer" box that satisfied every helper in the suite
    // and quietly ate the kid's attempts. A pairing board answers by pairing; a field here
    // is always a bug, visible or not.
    expect(screen.queryByLabelText('Your answer')).toBeNull()
    expect(view.container.querySelectorAll('input[type="text"], textarea')).toHaveLength(0)
  })
})

describe('P2.9 — the board can be finished without a drag', () => {
  it.each(SEEDS)('one button per card per slot, each naming what it joins, at seed %i', (seed) => {
    const instance = instanceAt(seed)
    mount(instance)

    for (const card of instance.visual.right) {
      for (const item of instance.visual.left) {
        const button = pairButton(card.id, item.id)
        expect(button).not.toBeNull()
        expect(button.tagName).toBe('BUTTON')
        expect(button).toHaveAccessibleName(containing(card.label))
        expect(button).toHaveAccessibleName(containing(item.label))
      }
    }
    expect(document.body.querySelectorAll('[data-match-pair-card]')).toHaveLength(
      instance.visual.left.length * instance.visual.right.length,
    )
  })

  it.each(SEEDS)('the buttons on a card are told apart by looking at them at seed %i', (seed) => {
    const instance = instanceAt(seed)
    mount(instance)

    // An accessible name is not enough on its own. A kid using a mouse or a keyboard with
    // working eyes reads the button, not the name, and four buttons that all say the same
    // word are four coin flips — they have to press one and watch where the card goes.
    // `SortWidget` renders each bucket's own label on its button; this board does the same
    // with each description, so the visible text says where the card is about to be sent.
    for (const card of instance.visual.right) {
      const buttons = instance.visual.left.map((item) => pairButton(card.id, item.id))
      const faces = buttons.map((button) => button.textContent.trim())

      expect(new Set(faces).size).toBe(instance.visual.left.length)
      for (const [index, face] of faces.entries()) {
        expect(face).not.toBe('')
        // What is written on the button has to name the slot it sends the card to, so a
        // kid can find that slot on the board without pressing anything first.
        expect(slotFor(instance.visual.left[index].id).textContent).toContain(face)
      }
    }
  })

  it.each(SEEDS)('pressing the buttons alone builds a response the checker accepts at seed %i', (seed) => {
    const full = rendered(seed)
    const instance = toInstance(full)
    const { spy } = mount(instance)

    pairCorrectly(full)

    // No response shape is written down as a literal: if the widget builds the wrong one,
    // the shipped checker says `invalid` and this fails.
    expect(check('match', full.answer, toResponse(instance, spy.value))).toEqual({ correct: true, reason: null })
  })

  it.each(SEEDS)('a completely paired board that is misjoined is wrong, not unreadable, at seed %i', (seed) => {
    const full = rendered(seed)
    const instance = toInstance(full)
    const { spy } = mount(instance)

    // Every card placed, each one in the next slot along: a finished board that is joined
    // up incorrectly. `invalid` here would mean the widget cannot express a wrong answer,
    // which is the failure mode that makes a checker look right for the wrong reason.
    const pairs = full.answer.pairs
    pairs.forEach((pair, index) => {
      fireEvent.click(pairButton(pair.right, pairs[(index + 1) % pairs.length].left))
    })

    const result = check('match', full.answer, toResponse(instance, spy.value))
    expect(result.correct).toBe(false)
    expect(result.reason).toBe('wrong')
  })

  it.each(SEEDS)('a card already in a slot is not offered that slot again at seed %i', (seed) => {
    const instance = instanceAt(seed)
    mount(instance)
    const [item] = instance.visual.left
    const [card] = instance.visual.right

    expect(pairButton(card.id, item.id)).toBeEnabled()
    fireEvent.click(pairButton(card.id, item.id))
    expect(pairButton(card.id, item.id)).toBeDisabled()
  })

  it.each(SEEDS)('a card can be taken back out of a slot at seed %i', (seed) => {
    const instance = instanceAt(seed)
    const { spy } = mount(instance)
    const [item] = instance.visual.left
    const [card] = instance.visual.right

    fireEvent.click(pairButton(card.id, item.id))
    expect(spy.value[0]).toBe(item.id)

    const back = returnButton(card.id)
    expect(back).not.toBeNull()
    expect(back).toHaveAccessibleName(containing(card.label))
    fireEvent.click(back)
    expect(spy.value[0]).toBeNull()
    expect(cardFor(card.id).closest('[data-match-slot]')).toBeNull()
  })
})

/**
 * The one rule `sort` does not have. A bucket takes any number of cards; a slot takes one.
 * Done carelessly — by refusing the second card — a kid who has filled every slot wrongly
 * is stuck, because there is nowhere for the next card to go and no reason for them to guess
 * that unpairing first is the way out. Eviction is what keeps a full board editable.
 */
describe('P2.9 — a slot holds exactly one card', () => {
  it.each(SEEDS)('a second card into an occupied slot returns the first to the tray at seed %i', (seed) => {
    const instance = instanceAt(seed)
    const { spy } = mount(instance)
    const [item] = instance.visual.left
    const [first, second] = instance.visual.right

    fireEvent.click(pairButton(first.id, item.id))
    fireEvent.click(pairButton(second.id, item.id))

    expect(spy.value[1]).toBe(item.id)
    expect(spy.value[0]).toBeNull()
    expect(within(slotFor(item.id)).getByText(second.label)).toBeInTheDocument()
    expect(within(slotFor(item.id)).queryByText(first.label)).toBeNull()
    expect(within(tray()).getByText(first.label)).toBeInTheDocument()
  })

  it.each(SEEDS)('a fully paired board can still be rearranged at seed %i', (seed) => {
    const full = rendered(seed)
    const instance = toInstance(full)
    const { spy } = mount(instance)
    const pairs = full.answer.pairs

    // Fill every slot, deliberately rotated, then correct it one press at a time. No slot
    // is ever empty when a card is sent to it, so every one of these is an eviction.
    pairs.forEach((pair, index) => fireEvent.click(pairButton(pair.right, pairs[(index + 1) % pairs.length].left)))
    expect(spy.value.every((entry) => entry !== null)).toBe(true)

    for (const pair of pairs) fireEvent.click(pairButton(pair.right, pair.left))

    expect(check('match', full.answer, toResponse(instance, spy.value))).toEqual({ correct: true, reason: null })
  })

  it.each(SEEDS)('no card is ever in two places at once at seed %i', (seed) => {
    const instance = instanceAt(seed)
    mount(instance)
    const [item, other] = instance.visual.left
    const [card] = instance.visual.right

    expect(document.body.querySelectorAll(`[data-match-card="${card.id}"]`)).toHaveLength(1)
    fireEvent.click(pairButton(card.id, item.id))
    expect(document.body.querySelectorAll(`[data-match-card="${card.id}"]`)).toHaveLength(1)
    fireEvent.click(pairButton(card.id, other.id))
    expect(document.body.querySelectorAll(`[data-match-card="${card.id}"]`)).toHaveLength(1)
    expect(within(slotFor(other.id)).getByText(card.label)).toBeInTheDocument()
  })
})

describe('P2.9 — the drag', () => {
  it.each(SEEDS)('a card dropped on a slot lands in it at seed %i', (seed) => {
    const instance = instanceAt(seed)
    const { spy } = mount(instance)
    const midpoint = layOut(instance)
    const [card] = instance.visual.right
    const target = instance.visual.left[1]

    drag(card.id, target.id, midpoint)

    expect(spy.value[0]).toBe(target.id)
    expect(boardOf(instance)[0]).toBe(target.id)
  })

  it.each(SEEDS)('a card dragged back to the tray is unpaired again at seed %i', (seed) => {
    const instance = instanceAt(seed)
    const { spy } = mount(instance)
    let midpoint = layOut(instance)
    const [card] = instance.visual.right
    const target = instance.visual.left[0]

    drag(card.id, target.id, midpoint)
    expect(spy.value[0]).toBe(target.id)

    jest.restoreAllMocks()
    midpoint = layOut(instance)
    drag(card.id, null, midpoint)
    expect(spy.value[0]).toBeNull()
  })

  it.each(SEEDS)('a card released over nothing stays where it was at seed %i', (seed) => {
    const instance = instanceAt(seed)
    const { spy } = mount(instance)
    layOut(instance)
    const [card] = instance.visual.right
    const before = JSON.stringify(spy.value)

    const node = cardFor(card.id)
    pointer(node, 'pointerdown', { clientX: 150, clientY: 10 })
    pointer(node, 'pointermove', { clientX: 150, clientY: 5000 })
    pointer(node, 'pointerup', { clientX: 150, clientY: 5000 })

    expect(JSON.stringify(spy.value)).toBe(before)
  })

  it.each(SEEDS)('a card dropped on an occupied slot evicts the card sitting there at seed %i', (seed) => {
    const instance = instanceAt(seed)
    const { spy } = mount(instance)
    const midpoint = layOut(instance)
    const [item] = instance.visual.left
    const [first, second] = instance.visual.right

    drag(first.id, item.id, midpoint)
    jest.restoreAllMocks()
    const again = layOut(instance)
    drag(second.id, item.id, again)

    expect(spy.value[1]).toBe(item.id)
    expect(spy.value[0]).toBeNull()
  })

  it.each(SEEDS)('dragging alone builds a response the checker accepts at seed %i', (seed) => {
    const full = rendered(seed)
    const instance = toInstance(full)
    const { spy } = mount(instance)

    for (const pair of full.answer.pairs) {
      jest.restoreAllMocks()
      const midpoint = layOut(instance)
      drag(pair.right, pair.left, midpoint)
    }

    expect(check('match', full.answer, toResponse(instance, spy.value))).toEqual({ correct: true, reason: null })
  })
})

/**
 * The P2.7 trap, restated for this widget. `setPointerCapture` retargets the compatibility
 * mouse events that follow the pointer sequence, so a button inside a captured element stops
 * receiving clicks for mouse and touch while a keyboard still works — silently, and entirely
 * invisible to jsdom. The fix is `OrderWidget`'s: refuse to start a drag when the press
 * landed on a button. What can be measured here is that refusal, and its consequence.
 */
describe('P2.9 — pressing a pair button is a press, not the start of a drag', () => {
  it.each(SEEDS)('no capture is taken when the press lands on a button at seed %i', (seed) => {
    const instance = instanceAt(seed)
    mount(instance)
    layOut(instance)
    const [item] = instance.visual.left
    const [card] = instance.visual.right

    pointer(pairButton(card.id, item.id), 'pointerdown', { clientX: 150, clientY: 10 })

    expect(cardFor(card.id).setPointerCapture).not.toHaveBeenCalled()
  })

  it.each(SEEDS)('capture IS taken when the press lands on the card itself at seed %i', (seed) => {
    const instance = instanceAt(seed)
    mount(instance)
    layOut(instance)
    const [card] = instance.visual.right

    pointer(cardFor(card.id), 'pointerdown', { clientX: 150, clientY: 10 })

    expect(cardFor(card.id).setPointerCapture).toHaveBeenCalled()
  })

  it.each(SEEDS)('a finger sliding off a button does not carry the card with it at seed %i', (seed) => {
    const instance = instanceAt(seed)
    const { spy } = mount(instance)
    const midpoint = layOut(instance)
    const [item, other] = instance.visual.left
    const [card] = instance.visual.right
    const before = JSON.stringify(spy.value)

    pointer(pairButton(card.id, item.id), 'pointerdown', { clientX: 150, clientY: 10 })
    pointer(cardFor(card.id), 'pointermove', { clientX: 150, clientY: midpoint.get(other.id) })
    pointer(cardFor(card.id), 'pointerup', { clientX: 150, clientY: midpoint.get(other.id) })

    expect(JSON.stringify(spy.value)).toBe(before)
  })

  it.each(SEEDS)('a press on a button still pairs the card at seed %i', (seed) => {
    const instance = instanceAt(seed)
    const { spy } = mount(instance)
    layOut(instance)
    const [item] = instance.visual.left
    const [card] = instance.visual.right

    const button = pairButton(card.id, item.id)
    pointer(button, 'pointerdown', { clientX: 150, clientY: 10 })
    pointer(button, 'pointerup', { clientX: 150, clientY: 10 })
    fireEvent.click(button)

    expect(spy.value[0]).toBe(item.id)
  })
})

describe('P2.9 — a disabled board accepts nothing', () => {
  it.each(SEEDS)('no button is live and no drag starts at seed %i', (seed) => {
    const instance = instanceAt(seed)
    const { spy } = mount(instance, { disabled: true })
    const midpoint = layOut(instance)
    const before = JSON.stringify(spy.value)
    const [item] = instance.visual.left
    const [card] = instance.visual.right

    for (const button of screen.getAllByRole('button')) expect(button).toBeDisabled()

    drag(card.id, item.id, midpoint)
    expect(cardFor(card.id).setPointerCapture).not.toHaveBeenCalled()
    expect(JSON.stringify(spy.value)).toBe(before)
  })
})

describe('P2.9 — the board shows only what the server sent', () => {
  it.each(SEEDS)('the widget invents no digit of its own at seed %i', (seed) => {
    const instance = instanceAt(seed)
    const { view } = mount(instance)

    // Subtract everything the server legitimately sent. What is left is the widget's own
    // doing, and it must not contain a digit — pair numbers ("pair 3") belong in an
    // accessible name, never in visible text, because a number printed beside a card is one
    // more thing for a kid to read as part of the maths.
    const sent = [
      instance.prompt,
      ...instance.visual.left.map((item) => item.label),
      ...instance.visual.right.map((card) => card.label),
    ]
    let residue = view.container.textContent
    for (const piece of sent.sort((a, b) => b.length - a.length)) residue = residue.split(piece).join(' ')
    expect(residue).not.toMatch(/[0-9]/)
  })

  it.each(SEEDS)('nothing in the markup says which card belongs with which at seed %i', (seed) => {
    const full = rendered(seed)
    const instance = toInstance(full)
    const { view } = mount(instance)
    const html = view.container.innerHTML

    // The instance carries no answer, so the only way a couple reaches the DOM is if the
    // widget invented it. Seven separators, so `left-0:right-2` and `left-0-right-2` and
    // the rest are all covered.
    for (const [leftId, rightId] of pairingOf(full)) {
      for (const separator of ['', '-', '_', ':', '|', ' ', '/']) {
        expect(html).not.toContain(`${leftId}${separator}${rightId}`)
      }
    }
    expect(html).not.toContain('correct')
    expect(view.container.textContent).not.toContain(full.explanation)
    for (const hint of full.hints) expect(view.container.textContent).not.toContain(hint)
  })

  it.each(SEEDS)('every card starts in the tray at seed %i', (seed) => {
    const instance = instanceAt(seed)
    const { spy } = mount(instance)

    // Pre-pairing even one card would be answering part of the exercise for the kid.
    expect(spy.value).toEqual(instance.visual.right.map(() => null))
    expect(boardOf(instance)).toEqual(instance.visual.right.map(() => null))
    for (const card of instance.visual.right) {
      expect(within(tray()).getByText(card.label)).toBeInTheDocument()
    }
  })
})
