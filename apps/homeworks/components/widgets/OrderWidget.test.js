/**
 * P2.7 — the `order` widget: four cards a kid puts into the right sequence.
 *
 * WHY IT IS NOT A DRAG LIBRARY. Plan §6.3 D5 says this widget is built from raw pointer
 * events, and §5.2 says every answer control must be reachable by thumb *and* by keyboard.
 * A drag-only list is unusable without a mouse, so this spec pins two ways in and grades
 * through both: a real pointer drag, and a pair of move buttons on every row. Neither is a
 * simulation — the drag goes through the component's own `onPointerDown/Move/Up`, and the
 * buttons are the same buttons a keyboard user tabs to.
 *
 * WHY THE ROWS CARRY IDS AND NOT LABELS. `check('order', …)` grades `{ sequence }` against
 * the answer's ids, never the text. A widget that reported the labels would look perfect on
 * screen and grade every answer `invalid`, so every grading assertion here goes through the
 * shipped `toResponse()` and the shipped `check()` rather than reading the draft and
 * declaring it good.
 *
 * WHAT IT MAY NOT DO. All four cards are on screen by design — they are the question. So
 * the leak hunted here is not the values but the *arrangement* and the *marking*: the rows
 * must arrive in the order the server sent (which the template guarantees is never the
 * answer), and no attribute, class or extra node may separate one row from another once its
 * own label, id and position are taken out.
 *
 * NOTHING IS STUBBED. Problems, prompts, answers and cards come from `@grove/curriculum`;
 * the only things written down here are the seeds and the row geometry the drag needs.
 */
import { describe, expect, it, jest } from '@jest/globals'
import '@testing-library/jest-dom'
import { fireEvent, render, screen, within } from '@testing-library/react'
import { useState } from 'react'

import { check, getProblem, listProblems, render as renderProblem, toInstance } from '@grove/curriculum'

import { AnswerWidget } from './AnswerWidget'
import { emptyValue, toResponse } from './response'
import { correctValueFor, gallerySamples, wrongValueFor } from '../../app/dev/widgets/samples'

const SEEDS = [12345, 7, 999_999, 2505]
const ROW = 40

const meta = listProblems().find((problem) => problem.widget === 'order')
const full = (seed) => renderProblem(getProblem(meta.id), seed)
const instanceOf = (seed) => toInstance(full(seed))

/** The kid's draft lives in the page, not the widget — mirror that, and spy on it. */
function Harness({ instance, spy, disabled }) {
  const [value, setValue] = useState(() => emptyValue(instance))
  spy.value = value
  return <AnswerWidget instance={instance} value={value} onChange={setValue} disabled={disabled} />
}

const mount = (instance, { disabled = false } = {}) => {
  const spy = { value: undefined }
  const view = render(<Harness instance={instance} spy={spy} disabled={disabled} />)
  return { spy, view, root: view.container }
}

/** The ids on screen, top to bottom. The whole answer is this list. */
const orderedIds = (root) => [...root.querySelectorAll('[data-order-item]')].map((row) => row.dataset.orderItem)

const rowFor = (root, id) => root.querySelector(`[data-order-item="${id}"]`)
const upFor = (root, id) => root.querySelector(`[data-move-up="${id}"]`)
const downFor = (root, id) => root.querySelector(`[data-move-down="${id}"]`)

/** Put the cards in this order using the real move buttons, the way a keyboard user would. */
function reorderTo(root, ids) {
  for (let target = 0; target < ids.length; target++) {
    let at = orderedIds(root).indexOf(ids[target])
    expect(at).toBeGreaterThanOrEqual(target)
    while (at > target) {
      fireEvent.click(upFor(root, ids[target]))
      at -= 1
    }
  }
}

/**
 * jsdom 20 has no `PointerEvent` and `fireEvent.pointerDown` drops `pointerId` and
 * `clientY` on the floor, so the drag is driven with a hand-built event carrying the
 * fields a real one would. This is the same event the browser dispatches, minus the class.
 */
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
}

/**
 * Every element in jsdom is 0×0, so give the rows a real stacked geometry. The rect is
 * computed at call time from the row's *current* position, which is what a browser would
 * report after a live reorder.
 */
function stackRows(root) {
  const rect = (index) => ({
    top: index * ROW,
    bottom: (index + 1) * ROW,
    height: ROW,
    y: index * ROW,
    left: 0,
    right: 300,
    width: 300,
    x: 0,
    toJSON() {},
  })
  for (const row of root.querySelectorAll('[data-order-item]')) {
    jest.spyOn(row, 'getBoundingClientRect').mockImplementation(() =>
      rect(orderedIds(root).indexOf(row.dataset.orderItem)),
    )
  }
  const list = root.querySelector('[data-order-list]')
  if (list !== null) {
    jest.spyOn(list, 'getBoundingClientRect').mockImplementation(() => ({
      ...rect(0),
      bottom: orderedIds(root).length * ROW,
      height: orderedIds(root).length * ROW,
    }))
  }
  // A real browser keeps sending moves to the element that took the capture; jsdom has no
  // capture at all, so stand one in and let the widget's optional call find it.
  for (const row of root.querySelectorAll('[data-order-item]')) {
    row.setPointerCapture = jest.fn()
    row.releasePointerCapture = jest.fn()
  }
}

/** Press the row now at `from`, move to the middle of slot `to`, release. */
function drag(root, from, to) {
  const id = orderedIds(root)[from]
  const row = rowFor(root, id)
  pointer(row, 'pointerdown', { clientY: from * ROW + ROW / 2, clientX: 10 })
  pointer(row, 'pointermove', { clientY: to * ROW + ROW / 2, clientX: 10 })
  pointer(row, 'pointerup', { clientY: to * ROW + ROW / 2, clientX: 10 })
  return row
}

afterEach(() => {
  jest.restoreAllMocks()
})

describe('P2.7 — the order widget', () => {
  it('has a template to render at all, which is what makes it appear in the gallery', () => {
    expect(meta).toBeDefined()
    expect(meta.widget).toBe('order')
    expect(gallerySamples().some((sample) => sample.widget === 'order')).toBe(true)
  })

  describe.each(SEEDS)('at seed %i', (seed) => {
    it('shows every card, in the order the server sent, which is never the answer', () => {
      const instance = instanceOf(seed)
      const sent = instance.visual.items
      const { root } = mount(instance)

      expect(orderedIds(root)).toEqual(sent.map((item) => item.id))
      for (const item of sent) expect(rowFor(root, item.id).textContent).toContain(item.label)
      // The template guarantees it, and this is the assertion that catches a widget that
      // "helpfully" sorts the cards for the kid.
      expect(orderedIds(root)).not.toEqual(full(seed).answer.sequence)
    })

    it('is one named list, without saying the prompt twice', () => {
      const instance = instanceOf(seed)
      const { root } = mount(instance)

      expect(screen.getAllByText(instance.prompt)).toHaveLength(1)
      // Named by the prompt that is already on screen — not by a second copy of it, and
      // not by an off-screen label a screen reader would read out on its own.
      const list = screen.getByRole('list', { name: instance.prompt })
      expect(list).toBe(root.querySelector('[data-order-list]'))
      expect(within(list).getAllByRole('listitem')).toHaveLength(instance.visual.items.length)
    })

    it('tells a screen reader what each card is and where it currently sits', () => {
      const instance = instanceOf(seed)
      const items = instance.visual.items
      const { root } = mount(instance)

      for (const [index, item] of items.entries()) {
        const where = `position ${index + 1} of ${items.length}`
        const row = rowFor(root, item.id)
        expect(row.getAttribute('aria-label')).toContain(item.label)
        expect(row.getAttribute('aria-label')).toContain(where)

        for (const button of [upFor(root, item.id), downFor(root, item.id)]) {
          expect(button.tagName).toBe('BUTTON')
          expect(button.getAttribute('type')).toBe('button')
          expect(button.getAttribute('aria-label')).toContain(item.label)
          expect(button.getAttribute('aria-label')).toContain(where)
        }
      }
      expect(upFor(root, items[0].id)).toBeDisabled()
      expect(downFor(root, items.at(-1).id)).toBeDisabled()
      expect(downFor(root, items[0].id)).toBeEnabled()
      expect(upFor(root, items.at(-1).id)).toBeEnabled()
    })

    it('moves one card at a time with the buttons, and says so upward', () => {
      const instance = instanceOf(seed)
      const start = instance.visual.items.map((item) => item.id)
      const { root, spy } = mount(instance)

      fireEvent.click(upFor(root, start[1]))
      expect(orderedIds(root)).toEqual([start[1], start[0], start[2], start[3]])
      expect(spy.value).toEqual(orderedIds(root))

      fireEvent.click(downFor(root, start[1]))
      expect(orderedIds(root)).toEqual(start)
      expect(spy.value).toEqual(start)
    })

    it('reaches the right answer by keyboard, and the real checker agrees', () => {
      const instance = instanceOf(seed)
      const answer = full(seed).answer
      const { root, spy } = mount(instance)

      reorderTo(root, answer.sequence)

      expect(orderedIds(root)).toEqual(answer.sequence)
      expect(spy.value).toEqual(answer.sequence)
      expect(toResponse(instance, spy.value)).toEqual({ sequence: answer.sequence })
      expect(check('order', answer, toResponse(instance, spy.value))).toEqual({ correct: true, reason: null })
    })

    it('grades a different arrangement wrong, not unreadable', () => {
      const instance = instanceOf(seed)
      const answer = full(seed).answer
      const backwards = [...answer.sequence].reverse()
      const { root, spy } = mount(instance)

      reorderTo(root, backwards)
      expect(orderedIds(root)).toEqual(backwards)

      const verdict = check('order', answer, toResponse(instance, spy.value))
      expect(verdict.correct).toBe(false)
      // `invalid` here would mean the widget cannot express a wrong answer, which is the
      // failure mode that makes a checker look right for the wrong reason.
      expect(verdict.reason).toBe('wrong')
    })

    it('is not a correct answer until the kid moves something', () => {
      const instance = instanceOf(seed)
      const answer = full(seed).answer
      const { spy } = mount(instance)

      expect(spy.value).toEqual(instance.visual.items.map((item) => item.id))
      const verdict = check('order', answer, toResponse(instance, spy.value))
      expect(verdict.correct).toBe(false)
      expect(verdict.reason).toBe('wrong')
    })

    it('drags a card down a slot with its own pointer handlers', () => {
      const instance = instanceOf(seed)
      const start = instance.visual.items.map((item) => item.id)
      const { root, spy } = mount(instance)
      stackRows(root)

      const row = rowFor(root, start[0])
      pointer(row, 'pointerdown', { clientY: ROW / 2, clientX: 10 })
      // A press is not a move.
      expect(orderedIds(root)).toEqual(start)
      // Without capture the browser hands the rest of the drag to whatever is under the
      // finger, and the card is dropped the moment it moves.
      expect(row.setPointerCapture).toHaveBeenCalledWith(1)

      pointer(row, 'pointermove', { clientY: ROW + ROW / 2, clientX: 10 })
      pointer(row, 'pointerup', { clientY: ROW + ROW / 2, clientX: 10 })

      expect(orderedIds(root)).toEqual([start[1], start[0], start[2], start[3]])
      expect(spy.value).toEqual(orderedIds(root))
    })

    it('drags a card the whole way to the top, lifting the rest down one', () => {
      const instance = instanceOf(seed)
      const [a, b, c, d] = instance.visual.items.map((item) => item.id)
      const { root, spy } = mount(instance)
      stackRows(root)

      drag(root, 3, 0)

      // Dropped in, not swapped with: the other three keep their order.
      expect(orderedIds(root)).toEqual([d, a, b, c])
      expect(spy.value).toEqual([d, a, b, c])
    })

    it('can be dragged all the way to the right answer', () => {
      const instance = instanceOf(seed)
      const answer = full(seed).answer
      const { root, spy } = mount(instance)
      stackRows(root)

      for (let target = 0; target < answer.sequence.length; target++) {
        const from = orderedIds(root).indexOf(answer.sequence[target])
        if (from !== target) drag(root, from, target)
      }

      expect(orderedIds(root)).toEqual(answer.sequence)
      expect(check('order', answer, toResponse(instance, spy.value))).toEqual({ correct: true, reason: null })
    })

    it('does not scroll the page out from under the drag', () => {
      const instance = instanceOf(seed)
      const { root } = mount(instance)

      for (const row of root.querySelectorAll('[data-order-item]')) {
        // Either spelling is fine; what is not fine is leaving the browser free to treat
        // the drag as a scroll, which on a phone means the cards never move.
        expect(row.style.touchAction === 'none' || row.className.includes('touch-none')).toBe(true)
      }
    })

    it('ignores taps and drags once the problem is solved', () => {
      const instance = instanceOf(seed)
      const start = instance.visual.items.map((item) => item.id)
      const { root, spy } = mount(instance, { disabled: true })
      stackRows(root)

      for (const button of root.querySelectorAll('button')) expect(button).toBeDisabled()
      fireEvent.click(downFor(root, start[0]))
      drag(root, 0, 2)

      expect(orderedIds(root)).toEqual(start)
      expect(spy.value).toEqual(start)
    })

    it('offers two moves per card and nothing else', () => {
      const instance = instanceOf(seed)
      const { root } = mount(instance)

      expect(root.querySelectorAll('input, textarea, select')).toHaveLength(0)
      expect(screen.queryByLabelText('Your answer')).toBeNull()
      expect(root.querySelectorAll('button')).toHaveLength(instance.visual.items.length * 2)
    })

    it('renders the cards with the same markup, so none is marked as first', () => {
      const instance = instanceOf(seed)
      const items = instance.visual.items
      const solution = full(seed)
      const { root, view } = mount(instance)

      // Everything that legitimately differs — the label, the id, the position, and the
      // attributes that carry either — is blanked. What is left must be equal. The two end
      // rows are excluded because their end button is disabled, which is asserted above.
      const shapeOf = (index) =>
        rowFor(root, items[index].id)
          .outerHTML.replaceAll(
            /(id|for|name|aria-labelledby|aria-describedby|data-order-item|data-move-up|data-move-down)="[^"]*"/g,
            '$1="«ID»"',
          )
          .split(`position ${index + 1} of ${items.length}`)
          .join('«POS»')
          .split(items[index].label)
          .join('«LABEL»')
          .split(items[index].id)
          .join('«ID»')

      expect(shapeOf(1)).toBe(shapeOf(2))

      const text = view.container.textContent
      expect(text).not.toContain(solution.explanation)
      for (const hint of solution.hints) expect(text).not.toContain(hint)
      expect(text).not.toMatch(/\bAI\b/)
      expect(view.container.innerHTML).not.toContain('correct')
    })

    it('invents no digits of its own beyond the cards it was given', () => {
      const instance = instanceOf(seed)
      const { view } = mount(instance)

      const sent = [instance.prompt, ...instance.visual.items.map((item) => item.label)]
      let residue = view.container.textContent
      for (const piece of sent.sort((a, b) => b.length - a.length)) residue = residue.split(piece).join(' ')
      // The positions live in `aria-label`, so a screen reader hears them and this rule
      // still holds: nothing on screen but the prompt and the four cards.
      expect(residue).not.toMatch(/\d/)
      expect(screen.getByText(instance.prompt)).toBeInTheDocument()
    })
  })

  it('starts with the cards as they were sent, and hands the page its own array', () => {
    for (const seed of SEEDS) {
      const instance = instanceOf(seed)
      const value = emptyValue(instance)

      expect(value).toEqual(instance.visual.items.map((item) => item.id))
      value.reverse()
      expect(emptyValue(instance)).toEqual(instance.visual.items.map((item) => item.id))
      expect(instance.visual.items.map((item) => item.id)).not.toEqual(value)
    }
  })

  it('keeps two cards on one page independent, the way the gallery shows them', () => {
    const left = instanceOf(SEEDS[0])
    const right = instanceOf(SEEDS[1])
    const spies = [{ value: undefined }, { value: undefined }]

    const view = render(
      <div>
        <div data-testid="left">
          <Harness instance={left} spy={spies[0]} />
        </div>
        <div data-testid="right">
          <Harness instance={right} spy={spies[1]} />
        </div>
      </div>,
    )

    const leftRoot = within(view.container).getByTestId('left')
    const rightRoot = within(view.container).getByTestId('right')
    const started = right.visual.items.map((item) => item.id)

    fireEvent.click(upFor(leftRoot, orderedIds(leftRoot)[1]))

    expect(orderedIds(leftRoot)).not.toEqual(left.visual.items.map((item) => item.id))
    expect(orderedIds(rightRoot)).toEqual(started)
    expect(spies[1].value).toEqual(started)
  })

  it('gives the gallery a right and a wrong value the real checker agrees with', () => {
    const sample = gallerySamples().find((entry) => entry.widget === 'order')

    expect(check('order', sample.answer, toResponse(sample.instance, correctValueFor(sample)))).toEqual({
      correct: true,
      reason: null,
    })
    const missed = check('order', sample.answer, toResponse(sample.instance, wrongValueFor(sample)))
    expect(missed.correct).toBe(false)
    expect(missed.reason).toBe('wrong')
  })
})

/**
 * Measured in real Chromium on /homeworks/q/m5.nbt.compare-decimals/order-decimals:
 * pressing an arrow button with a mouse logged
 *
 *   li item-1 <- pointerdown  (target BUTTON[up])
 *   li item-1 <- gotpointercapture
 *   li item-1 <- pointerup    (target LI)
 *   li item-1 <- click        (target LI)      <-- not the button
 *
 * and the cards did not move. Taking the pointer capture on the row retargets the
 * compatibility `click` to the row, so the button's own handler never runs: the arrows are
 * dead to mouse and to touch, and only a keyboard Enter still works. jsdom has no pointer
 * capture at all, which is why the rest of this file could not see it. A press that lands on
 * a control is not the start of a drag, so it must not capture.
 */
describe('P2.7 — pressing an arrow is a click, not the start of a drag', () => {
  it.each(SEEDS)('does not take the pointer capture when the press lands on a button (seed %i)', (seed) => {
    const { view } = mount(instanceOf(seed))
    const root = view.container
    stackRows(root)
    const id = orderedIds(root)[1]

    pointer(upFor(root, id), 'pointerdown', { clientY: ROW + ROW / 2, clientX: 10 })
    expect(rowFor(root, id).setPointerCapture).not.toHaveBeenCalled()

    pointer(downFor(root, id), 'pointerdown', { clientY: ROW + ROW / 2, clientX: 10 })
    expect(rowFor(root, id).setPointerCapture).not.toHaveBeenCalled()
  })

  it.each(SEEDS)('still takes the capture when the press lands on the card itself (seed %i)', (seed) => {
    const { view } = mount(instanceOf(seed))
    const root = view.container
    stackRows(root)
    const id = orderedIds(root)[1]

    pointer(rowFor(root, id), 'pointerdown', { clientY: ROW + ROW / 2, clientX: 10 })
    expect(rowFor(root, id).setPointerCapture).toHaveBeenCalledWith(1)
  })

  it.each(SEEDS)('does not drag the card when a finger slides off an arrow (seed %i)', (seed) => {
    const { spy, view } = mount(instanceOf(seed))
    const root = view.container
    stackRows(root)
    const before = orderedIds(root)
    const id = before[1]

    pointer(upFor(root, id), 'pointerdown', { clientY: ROW + ROW / 2, clientX: 10 })
    pointer(rowFor(root, id), 'pointermove', { clientY: 3 * ROW + ROW / 2, clientX: 10 })
    pointer(rowFor(root, id), 'pointerup', { clientY: 3 * ROW + ROW / 2, clientX: 10 })

    expect(orderedIds(root)).toEqual(before)
    expect(spy.value).toEqual(before)
  })
})
