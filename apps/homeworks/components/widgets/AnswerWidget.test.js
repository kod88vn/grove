/**
 * P1.8 part 1 of 4 — the answer widgets.
 *
 * Plan §6.3 gives one component per widget type; Phase 1 needs the four the shipped
 * templates actually use: `number`, `column`, `fraction` and `cloze`. This spec is driven
 * by `listProblems()`, so a template added later is covered the day it lands.
 *
 * Two things are being pinned, and only these two:
 *
 * 1. WHAT THE KID TYPES REACHES THE REAL CHECKER. The test drives the DOM the way a kid
 *    would, reads the draft value back out, runs it through `toResponse`, and hands the
 *    result to the shipped `check()` from @grove/curriculum against the real answer. No
 *    response shape is written down here as a literal — if the widget builds the wrong
 *    shape, `check` says `invalid` and the test fails. A perturbed entry must come back
 *    `wrong`, never `invalid`: `invalid` would mean the widget cannot express a wrong
 *    answer, which is the failure mode that makes a checker look right for the wrong
 *    reason.
 *
 * 2. NOTHING LEAKS. Plan §3 principle 5: the client receives the prompt, never the answer.
 *    The widget is handed a `toInstance()` payload — which carries no answer, no hints and
 *    no explanation — so the only way an answer reaches the DOM is if the widget invents
 *    it. Asserted per widget, using the same rule the P1.7 flow test uses: for `number`
 *    and `column` the answer must not appear as a standalone number; for `fraction` the
 *    `num/den` pair must not appear; for `cloze` the right word legitimately appears (it
 *    is one of the four choices — that is the exercise), so what is asserted instead is
 *    that no rendered attribute distinguishes it from the other three.
 */
import { describe, expect, it, jest } from '@jest/globals'
import '@testing-library/jest-dom'
import { fireEvent, render, screen } from '@testing-library/react'
import { useState } from 'react'

import { check, getProblem, listProblems, render as renderProblem, toInstance } from '@grove/curriculum'

import { AnswerWidget } from './AnswerWidget'
import { emptyValue, toResponse } from './response'

const SEEDS = [12345, 7, 999_999]

/** The kid's draft lives in the page, not the widget — mirror that, and spy on it. */
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

const rendered = (id, seed) => renderProblem(getProblem(id), seed)

/** The label a kid taps to pick the option with this id. */
const labelOf = (instance, id) => instance.visual.options.find((option) => option.id === id).label

/** The `order` cards on screen, top to bottom — the whole answer is this list. */
const orderedIds = () => [...document.body.querySelectorAll('[data-order-item]')].map((row) => row.dataset.orderItem)

/** Put the `order` cards in this sequence using the real move buttons. */
function reorderTo(ids) {
  for (let target = 0; target < ids.length; target++) {
    let at = orderedIds().indexOf(ids[target])
    while (at > target) {
      fireEvent.click(document.body.querySelector(`[data-move-up="${ids[target]}"]`))
      at -= 1
    }
  }
}

/** The `sort` cards on screen, in the order they were dealt. */
const sortItemIds = () => [...document.body.querySelectorAll('[data-sort-item]')].map((card) => card.dataset.sortItem)

/**
 * Put a `sort` card in a bucket with the button, not with a drag.
 *
 * Everything the drag can do must also be reachable without one: a kid on a keyboard, or
 * on a screen reader, or with a trackpad they cannot hold steady, is still expected to
 * finish the exercise. So the spec drives the buttons, and the drag is pinned separately
 * in `SortWidget.test.js` where the pointer sequence can be built by hand.
 */
function placeInto(itemId, bucketId) {
  const button = document.body.querySelector(
    `[data-sort-place-item="${itemId}"][data-sort-place-bucket="${bucketId}"]`,
  )
  if (button === null) throw new Error(`no control to put ${itemId} in ${bucketId}`)
  fireEvent.click(button)
}

/** Which bucket a `sort` card is sitting in, or null while it is still in the tray. */
function bucketOf(itemId) {
  const card = document.body.querySelector(`[data-sort-item="${itemId}"]`)
  const region = card.closest('[data-sort-bucket]')
  return region === null ? null : region.dataset.sortBucket
}

/** Every card, and the bucket it belongs in — flattened out of the answer. */
const sortPlacements = (answer) =>
  Object.entries(answer.buckets).flatMap(([bucketId, ids]) => ids.map((id) => [id, bucketId]))

/** The `match` cards on screen, in the order they were dealt. */
const matchCardIds = () => [...document.body.querySelectorAll('[data-match-card]')].map((card) => card.dataset.matchCard)

/**
 * Join a `match` card to a slot with the button, not with a drag.
 *
 * Same reasoning as `sort`: everything the drag can do must also be reachable without one,
 * so the generic spec drives the buttons and the pointer sequence is pinned separately in
 * `MatchWidget.test.js`, where the events can be built by hand.
 */
function pairInto(rightId, leftId) {
  const button = document.body.querySelector(`[data-match-pair-card="${rightId}"][data-match-pair-slot="${leftId}"]`)
  if (button === null) throw new Error(`no control to join ${rightId} to ${leftId}`)
  fireEvent.click(button)
}

/** Which slot a `match` card is sitting in, or null while it is still in the tray. */
function slotOf(rightId) {
  const card = document.body.querySelector(`[data-match-card="${rightId}"]`)
  const slot = card.closest('[data-match-slot]')
  return slot === null ? null : slot.dataset.matchSlot
}

/** What the `clock` hands are showing, read off the control rather than out of React. */
const clockShowing = () => document.body.querySelector('[data-clock]').dataset.clockTime

/**
 * Walk the `clock` hands round to a time with the steppers, not with a drag.
 *
 * Same reasoning as `sort` and `match`: everything the drag can do must also be reachable
 * without one, so the generic spec drives the buttons and the pointer sequence is pinned
 * separately in `ClockWidget.test.js`, where the events can be built by hand. Both hands
 * are walked forwards only, because a stepper that can reach every time going one way is
 * the property worth leaning on here.
 */
function setClockTo({ hour, minute }) {
  const [hourNow, minuteNow] = clockShowing().split(':').map(Number)
  const step = (which, times) => {
    const button = document.body.querySelector(`[data-clock-step="${which}"]`)
    if (button === null) throw new Error(`no control to move the ${which}`)
    for (let index = 0; index < times; index++) fireEvent.click(button)
  }
  step('hour-forward', (hour - hourNow + 12) % 12)
  step('minute-forward', ((minute - minuteNow + 60) % 60) / 5)
}

function coinCountsFor(total, denominations) {
  let remaining = total
  const counts = {}
  for (const coin of [...denominations].sort((left, right) => right - left)) {
    counts[coin] = Math.floor(remaining / coin)
    remaining %= coin
  }
  return counts
}

function tapCoins(instance, counts) {
  for (const [coin, count] of Object.entries(counts)) {
    const button = document.body.querySelector(`[data-coin-add="${coin}"]`)
    for (let index = 0; index < count; index++) fireEvent.click(button)
  }
}

/** Type the right answer the way a kid would, per widget. */
function enterCorrect(instance, answer) {
  if (instance.widget === 'choice') {
    fireEvent.click(screen.getByRole('radio', { name: labelOf(instance, answer.id) }))
    return
  }
  if (instance.widget === 'order') {
    reorderTo(answer.sequence)
    return
  }
  if (instance.widget === 'sort') {
    for (const [itemId, bucketId] of sortPlacements(answer)) placeInto(itemId, bucketId)
    return
  }
  if (instance.widget === 'match') {
    for (const pair of answer.pairs) pairInto(pair.right, pair.left)
    return
  }
  if (instance.widget === 'clock') {
    setClockTo(answer)
    return
  }
  if (instance.widget === 'coins') {
    tapCoins(instance, coinCountsFor(answer.total, instance.visual.denominations))
    return
  }
  if (instance.widget === 'tap-select') {
    for (const id of answer.ids) {
      const index = instance.visual.tokens.findIndex((entry) => entry.id === id)
      fireEvent.click(screen.getAllByRole('button')[index])
    }
    return
  }
  if (instance.widget === 'fraction-bar') {
    const count = answer.num * instance.visual.segments / answer.den
    for (let index = 0; index < count; index++) fireEvent.click(screen.getAllByRole('button')[index])
    return
  }
  if (instance.widget === 'number-line') {
    const tick = answer.num * instance.visual.segments / answer.den
    fireEvent.click(screen.getByRole('button', { name: `Mark ${tick} of ${instance.visual.segments}` }))
    return
  }
  if (instance.widget === 'cloze') {
    for (let index = 0; index < answer.blanks.length; index++) {
      fireEvent.click(screen.getAllByRole('radio', { name: answer.blanks[index].accept[0] })[index])
    }
    return
  }
  const field = screen.getByLabelText('Your answer')
  const text = instance.widget === 'fraction' ? `${answer.num}/${answer.den}` : String(answer.value)
  fireEvent.change(field, { target: { value: text } })
}

/** Type something a kid could plausibly type that is simply not right. */
function enterWrong(instance, answer) {
  if (instance.widget === 'choice') {
    const other = instance.visual.options.find((option) => option.id !== answer.id)
    fireEvent.click(screen.getByRole('radio', { name: other.label }))
    return
  }
  if (instance.widget === 'order') {
    // A real arrangement, just not the right one — so the checker must say `wrong`.
    reorderTo([...answer.sequence].reverse())
    return
  }
  if (instance.widget === 'sort') {
    // Every card placed, each one in the next bucket along — a finished board that is
    // misfiled, so the checker must say `wrong` rather than `invalid`. Nothing may be
    // left in the tray: an unfinished board is a different verdict and would hide this one.
    const bucketIds = Object.keys(answer.buckets)
    for (const [itemId, bucketId] of sortPlacements(answer)) {
      placeInto(itemId, bucketIds[(bucketIds.indexOf(bucketId) + 1) % bucketIds.length])
    }
    return
  }
  if (instance.widget === 'match') {
    // Every card joined to something, each to the next description along — a finished board
    // that is misjoined, so the checker must say `wrong` rather than `invalid`. Leaving a
    // card in the tray is a different verdict and would hide this one.
    const { pairs } = answer
    pairs.forEach((pair, index) => pairInto(pair.right, pairs[(index + 1) % pairs.length].left))
    return
  }
  if (instance.widget === 'clock') {
    // Both hands set, then the minute hand pushed one mark past — a real time on the face,
    // just not the right one, so the checker must say `wrong` rather than `invalid`. A
    // half-set face is a different verdict and would hide this one.
    setClockTo(answer)
    fireEvent.click(document.body.querySelector('[data-clock-step="minute-forward"]'))
    return
  }
  if (instance.widget === 'coins') {
    tapCoins(instance, coinCountsFor(answer.total + 1, instance.visual.denominations))
    return
  }
  if (instance.widget === 'tap-select') {
    const distractor = instance.visual.tokens.find((token) => !answer.ids.includes(token.id))
    const correct = instance.visual.tokens.findIndex((token) => token.id === answer.ids[0])
    fireEvent.click(screen.getAllByRole('button')[correct])
    fireEvent.click(screen.getAllByRole('button')[instance.visual.tokens.indexOf(distractor)])
    return
  }
  if (instance.widget === 'fraction-bar') {
    const count = answer.num * instance.visual.segments / answer.den
    for (let index = 0; index <= count; index++) fireEvent.click(screen.getAllByRole('button')[index])
    return
  }
  if (instance.widget === 'number-line') {
    fireEvent.click(screen.getByRole('button', { name: `Mark 0 of ${instance.visual.segments}` }))
    return
  }
  if (instance.widget === 'cloze') {
    const accepted = new Set(answer.blanks[0].accept.map((word) => word.toLowerCase()))
    const other = instance.visual.choices.find((choice) => !accepted.has(choice.toLowerCase()))
    fireEvent.click(screen.getAllByRole('radio', { name: other })[0])
    return
  }
  const field = screen.getByLabelText('Your answer')
  const text = instance.widget === 'fraction' ? `${answer.num + 1}/${answer.den}` : String(answer.value + 1)
  fireEvent.change(field, { target: { value: text } })
}

const problems = listProblems()

/**
 * What the reader sees, minus the clock's dial.
 *
 * The twelve numerals are furniture, not a message: `ClockWidget.test.js` pins them as
 * exactly one to twelve and byte-identical at every seed, so a dial cannot be smuggling
 * anything seed-dependent. But they are digits, and the residue rule below is deliberately
 * a blanket ban on digits rather than a hunt for the answer string. Removing the element is
 * the safe way to exempt them: subtracting the STRING "12" would also eat half of a leaked
 * "12:40" and let the leak through, which is exactly the class of bug the ban exists for.
 *
 * For every other widget this is `container.textContent` and nothing else.
 */
function visibleText(container) {
  const clone = container.cloneNode(true)
  for (const numerals of clone.querySelectorAll('[data-clock-dial]')) numerals.remove()
  for (const count of clone.querySelectorAll('[data-fraction-bar-count]')) count.remove()
  for (const endpoint of clone.querySelectorAll('[data-number-line-endpoint]')) endpoint.remove()
  return clone.textContent
}

/** Everything the server sent, removed. What survives is the widget's own doing. */
function residueOf(text, instance) {
  const sent = [instance.prompt]
  const visual = instance.visual
  if (visual.kind === 'expression') sent.push(visual.expression)
  if (visual.kind === 'column') sent.push(visual.operator, ...visual.operands.map(String))
  if (visual.kind === 'fraction-sum') {
    sent.push(visual.operator)
    for (const addend of visual.addends) sent.push(`${addend.num}/${addend.den}`, String(addend.num), String(addend.den))
  }
  if (visual.kind === 'cloze') sent.push(visual.sentence, ...visual.choices)
  if (visual.kind === 'choice') sent.push(...visual.options.map((option) => option.label))
  if (visual.kind === 'order') sent.push(...visual.items.map((item) => item.label))
  if (visual.kind === 'sort') {
    sent.push(...visual.items.map((item) => item.label), ...visual.buckets.map((bucket) => bucket.label))
  }
  if (visual.kind === 'match') {
    sent.push(...visual.left.map((item) => item.label), ...visual.right.map((card) => card.label))
  }
  if (visual.kind === 'fraction-bar') {
    sent.push(`${visual.reference.num}/${visual.reference.den}`)
    sent.push(String(visual.reference.num), String(visual.reference.den), String(visual.segments))
  }
  if (visual.kind === 'number-line') sent.push(String(visual.segments))
  let residue = text
  for (const piece of sent.sort((a, b) => b.length - a.length)) residue = residue.split(piece).join(' ')
  return residue
}

describe('P1.8 — answer widgets', () => {
  it('covers every widget the shipped templates use, and nothing else', () => {
    expect(new Set(problems.map((problem) => problem.widget))).toEqual(
      new Set(['number', 'column', 'fraction', 'cloze', 'choice', 'order', 'sort', 'match', 'clock', 'coins', 'tap-select', 'fraction-bar', 'number-line']),
    )
    expect(problems.length).toBeGreaterThanOrEqual(13)
  })

  describe.each(problems.map((problem) => [problem.id, problem.widget]))('%s (%s)', (id, widget) => {
    it.each(SEEDS)('shows the prompt and its visual at seed %i', (seed) => {
      const full = rendered(id, seed)
      const instance = toInstance(full)
      const { view } = mount(instance)

      expect(screen.getByText(instance.prompt)).toBeInTheDocument()
      const text = view.container.textContent

      if (instance.visual.kind === 'expression') expect(text).toContain(instance.visual.expression)
      if (instance.visual.kind === 'cloze') {
        for (const choice of instance.visual.choices) {
          expect(screen.getAllByRole('radio', { name: choice }).length).toBeGreaterThan(0)
        }
      }
      if (instance.visual.kind === 'choice') {
        for (const option of instance.visual.options) {
          expect(screen.getByRole('radio', { name: option.label })).toBeInTheDocument()
        }
      }
      if (instance.visual.kind === 'order') {
        // Sent in one order, shown in that order — the widget does not rearrange them.
        expect(orderedIds()).toEqual(instance.visual.items.map((item) => item.id))
        for (const item of instance.visual.items) expect(text).toContain(item.label)
      }
      if (instance.visual.kind === 'sort') {
        // The cards are dealt in the order they arrived, and every card starts in the
        // tray — the widget must not pre-sort any of them, which would be answering for
        // the kid. The buckets are named on screen, because a kid cannot classify into
        // categories they cannot read.
        expect(sortItemIds()).toEqual(instance.visual.items.map((item) => item.id))
        for (const item of instance.visual.items) {
          expect(text).toContain(item.label)
          expect(bucketOf(item.id)).toBeNull()
        }
        for (const bucket of instance.visual.buckets) {
          expect(text).toContain(bucket.label)
          expect(document.body.querySelector(`[data-sort-bucket="${bucket.id}"]`)).not.toBeNull()
        }
      }
      if (instance.visual.kind === 'match') {
        // Both columns are on screen by design — a kid cannot join two things they cannot
        // read. The cards are dealt in the order they arrived and every one starts in the
        // tray: pre-joining even one would be answering part of the exercise for the kid.
        expect(matchCardIds()).toEqual(instance.visual.right.map((card) => card.id))
        for (const card of instance.visual.right) {
          expect(text).toContain(card.label)
          expect(slotOf(card.id)).toBeNull()
        }
        for (const item of instance.visual.left) {
          expect(text).toContain(item.label)
          expect(document.body.querySelector(`[data-match-slot="${item.id}"]`)).not.toBeNull()
        }
      }
      if (instance.visual.kind === 'clock') {
        // The hands start on the time the problem counts on FROM. That is the question,
        // not the answer: the template never uses a whole number of hours, so both hands
        // always have to move. The time itself is never written down — it reaches a screen
        // reader through the group's name and a test through the attribute, but never as
        // text, so `visibleText` has nothing to forgive but the twelve dial numerals.
        const { hour, minute } = instance.visual.start
        expect(clockShowing()).toBe(`${hour}:${String(minute).padStart(2, '0')}`)
        expect(document.body.querySelector('[data-clock-hand="hour"]')).not.toBeNull()
        expect(document.body.querySelector('[data-clock-hand="minute"]')).not.toBeNull()
        expect(document.body.querySelectorAll('[data-clock-step]')).toHaveLength(4)
        expect(document.body.querySelector('[data-clock-dial]')).not.toBeNull()
      }
      if (instance.visual.kind === 'column') {
        for (const operand of instance.visual.operands) expect(text).toContain(String(operand))
        expect(text).toContain(instance.visual.operator)
      }
      if (instance.visual.kind === 'fraction-sum') {
        for (const addend of instance.visual.addends) expect(text).toContain(`${addend.num}/${addend.den}`)
        expect(text).toContain(instance.visual.operator)
      }
      if (instance.visual.kind === 'fraction-bar') {
        expect(screen.getByText(`Shaded 0 of ${instance.visual.segments}`)).toBeInTheDocument()
        expect(view.container.querySelector('[data-fraction-bar-count]')).not.toBeNull()
      }
    })

    it.each(SEEDS)('builds a response the shipped checker accepts at seed %i', (seed) => {
      const full = rendered(id, seed)
      const instance = toInstance(full)
      const { spy } = mount(instance)

      enterCorrect(instance, full.answer)
      expect(check(widget, full.answer, toResponse(instance, spy.value))).toEqual({ correct: true, reason: null })
    })

    it.each(SEEDS)('a wrong entry is wrong, not unreadable, at seed %i', (seed) => {
      const full = rendered(id, seed)
      const instance = toInstance(full)
      const { spy } = mount(instance)

      enterWrong(instance, full.answer)
      const result = check(widget, full.answer, toResponse(instance, spy.value))
      expect(result.correct).toBe(false)
      expect(result.reason).toBe('wrong')
    })

    it.each(SEEDS)('an untouched widget is not a correct answer at seed %i', (seed) => {
      const full = rendered(id, seed)
      const instance = toInstance(full)
      const { spy } = mount(instance)

      expect(check(widget, full.answer, toResponse(instance, spy.value)).correct).toBe(false)
    })

    it.each(SEEDS)('never renders the answer, working or hints at seed %i', (seed) => {
      const full = rendered(id, seed)
      const instance = toInstance(full)
      const { view } = mount(instance)
      const text = view.container.textContent
      const html = view.container.innerHTML

      expect(text).not.toContain(full.explanation)
      for (const hint of full.hints) expect(text).not.toContain(hint)

      // Subtract everything the server legitimately sent. Whatever is left is the
      // widget's own invention, and it must not contain a single digit — a stronger
      // rule than hunting for the answer string, and one that cannot be passed by
      // coincidence when an operand happens to equal the answer.
      expect(residueOf(visibleText(view.container), instance)).not.toMatch(/\d/)

      if (widget === 'cloze') {
        // The word is on screen by design. What must not be on screen is which one it is:
        // every choice must be rendered with the same markup but for its own text.
        const right = full.answer.blanks[0].accept[0]
        const wrongChoice = instance.visual.choices.find((choice) => choice !== right)
        const shapeOf = (choice) =>
          screen
            .getAllByRole('radio', { name: choice })[0]
            .closest('label')
            .outerHTML.split(choice)
            .join('«CHOICE»')
            .replaceAll(/(id|for|aria-labelledby)="[^"]*"/g, '$1="«ID»"')
        expect(shapeOf(right)).toBe(shapeOf(wrongChoice))
        expect(instance.visual.sentence).not.toContain(right)
      }

      if (widget === 'choice') {
        // Both options are on screen by design — they are the question. What must not be
        // on screen is any mark that separates them, so the two labels must render as the
        // same markup once their own text is taken out.
        const right = labelOf(instance, full.answer.id)
        const wrongLabel = instance.visual.options.find((option) => option.id !== full.answer.id).label
        const shapeOf = (label) => {
          const option = instance.visual.options.find((entry) => entry.label === label)
          return screen
            .getByRole('radio', { name: label })
            .closest('label')
            // The grouping attributes carry the problem id, which itself contains the word
            // "prime" — blank them before the option's own text is taken out, or the two
            // labels differ for a reason that has nothing to do with correctness.
            .outerHTML.replaceAll(/(id|for|name|aria-labelledby)="[^"]*"/g, '$1="«ID»"')
            .split(label)
            .join('«OPTION»')
            .split(option.id)
            .join('«OPTION»')
        }
        expect(shapeOf(right)).toBe(shapeOf(wrongLabel))
        // Nor may it start with the right one already picked.
        for (const radio of screen.getAllByRole('radio')) expect(radio).not.toBeChecked()
      }

      expect(text).not.toMatch(/\bAI\b/)
      expect(html).not.toContain('correct')
    })

    it('does not accept input while disabled', () => {
      const full = rendered(id, SEEDS[0])
      const instance = toInstance(full)
      const { spy } = mount(instance, { disabled: true })
      const before = JSON.stringify(spy.value)

      if (widget === 'cloze') {
        for (const radio of screen.getAllByRole('radio')) expect(radio).toBeDisabled()
        fireEvent.click(screen.getAllByRole('radio')[0])
      } else if (widget === 'choice') {
        for (const radio of screen.getAllByRole('radio')) expect(radio).toBeDisabled()
        fireEvent.click(screen.getAllByRole('radio')[0])
      } else if (widget === 'order') {
        for (const button of screen.getAllByRole('button')) expect(button).toBeDisabled()
        fireEvent.click(screen.getAllByRole('button')[1])
      } else if (widget === 'sort' || widget === 'match' || widget === 'clock' || widget === 'coins') {
        for (const button of screen.getAllByRole('button')) expect(button).toBeDisabled()
        fireEvent.click(screen.getAllByRole('button')[0])
      } else if (widget === 'tap-select') {
        for (const button of screen.getAllByRole('button')) expect(button).toBeDisabled()
        fireEvent.click(screen.getAllByRole('button')[0])
      } else if (widget === 'fraction-bar' || widget === 'number-line') {
        for (const button of screen.getAllByRole('button')) expect(button).toBeDisabled()
        fireEvent.click(screen.getAllByRole('button')[0])
      } else {
        expect(screen.getByLabelText('Your answer')).toBeDisabled()
        fireEvent.change(screen.getByLabelText('Your answer'), { target: { value: '5' } })
      }

      expect(JSON.stringify(spy.value)).toBe(before)
    })
  })

  it('refuses a widget it does not know, the way check() does', () => {
    const instance = { ...toInstance(rendered(problems[0].id, 1)), widget: 'graph' }
    const quiet = jest.spyOn(console, 'error').mockImplementation(() => {})
    expect(() => render(<AnswerWidget instance={instance} value={null} onChange={() => {}} />)).toThrow(
      /unknown widget: graph/,
    )
    expect(() => toResponse(instance, null)).toThrow(/unknown widget: graph/)
    quiet.mockRestore()
  })

  it('starts every widget empty rather than guessing for the kid', () => {
    for (const problem of problems) {
      const instance = toInstance(rendered(problem.id, SEEDS[0]))
      const value = emptyValue(instance)
      if (problem.widget === 'cloze') {
        expect(Array.isArray(value)).toBe(true)
        expect(value.every((entry) => entry === null)).toBe(true)
        expect(value.length).toBe(rendered(problem.id, SEEDS[0]).answer.blanks.length)
      } else if (problem.widget === 'order') {
        // "Empty" for a list is the order it arrived in, which the template guarantees is
        // not the answer — so an untouched card is graded wrong, never right by luck.
        expect(value).toEqual(instance.visual.items.map((item) => item.id))
        expect(value).not.toEqual(rendered(problem.id, SEEDS[0]).answer.sequence)
      } else if (problem.widget === 'sort') {
        // "Empty" for a board of buckets is every card still in the tray. It cannot be a
        // guess at the answer the way an arrangement can, because nothing has been
        // classified yet — and an unfinished board grades `invalid`, not `wrong`.
        expect(Array.isArray(value)).toBe(true)
        expect(value.length).toBe(instance.visual.items.length)
        expect(value.every((entry) => entry === null)).toBe(true)
      } else if (problem.widget === 'match') {
        // "Empty" for a pairing board is every card still in the tray — one entry per card
        // on the right, holding the id of the description it has been joined to. Nothing is
        // joined yet, so it cannot be a lucky guess the way an arrangement can, and an
        // unfinished board grades `invalid` rather than `wrong`.
        expect(Array.isArray(value)).toBe(true)
        expect(value.length).toBe(instance.visual.right.length)
        expect(value.every((entry) => entry === null)).toBe(true)
      } else if (problem.widget === 'clock') {
        // "Empty" for a clock is the time the problem starts at. The hands have to point
        // somewhere, and the question is "count on from here" — an empty face would be a
        // different exercise. It still cannot be a lucky guess: the template never uses a
        // whole number of hours, so the minute hand is always wrong until the kid moves it.
        expect(value).toEqual([instance.visual.start.hour, instance.visual.start.minute])
        const { answer } = rendered(problem.id, SEEDS[0])
        expect(value).not.toEqual([answer.hour, answer.minute])
      } else if (problem.widget === 'coins') {
        expect(value).toEqual({})
      } else if (problem.widget === 'tap-select') {
        expect(value).toEqual([])
      } else if (problem.widget === 'fraction-bar') {
        expect(value).toEqual([])
      } else {
        expect(value).toBe('')
      }
    }
  })
})
