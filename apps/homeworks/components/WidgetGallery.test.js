/**
 * P2.5 — the gallery itself: every widget, interactive, graded by the REAL checker.
 *
 * HOMEWORK_PLAN.md §10 Phase 2 acceptance: the gallery "renders every widget with a
 * sample problem; each widget's checker has right/wrong tests".
 *
 * A gallery that only draws the widgets proves nothing — the point of showing a widget is
 * to see it take an answer and grade it. So `WidgetGallery` must run the same pipeline the
 * solve page runs: `emptyValue` → the real `AnswerWidget` → `toResponse` → `check` from
 * `@grove/curriculum`. It must NOT re-implement grading.
 *
 * Two assertions below exist specifically to kill a hand-rolled comparison, because an
 * `answer === typed` check passes a naive right/wrong test and fails both of these:
 *   - a correct fraction typed in a form that is not lowest terms is `not-simplest`,
 *     which no equality check would ever say;
 *   - a blank or non-numeric answer is `invalid`, not `wrong`.
 *
 * This page is dev-only (the route guard is its own step), so it MAY show the answer —
 * but only behind a control that says so, and never before the reader asks.
 */
import fs from 'node:fs'
import path from 'node:path'

import { describe, expect, test } from '@jest/globals'
import '@testing-library/jest-dom'
import { fireEvent, render, within } from '@testing-library/react'

import {
  correctValueFor,
  gallerySamples,
  wrongValueFor,
} from '@/app/dev/widgets/samples'

import { WidgetGallery } from './WidgetGallery'

const source = fs.readFileSync(path.join(__dirname, 'WidgetGallery.js'), 'utf8')
const samples = gallerySamples()
const coinLabels = { 25: ['quarter', 'quarters'], 10: ['dime', 'dimes'], 5: ['nickel', 'nickels'], 1: ['penny', 'pennies'] }

/** Each widget gets one card, found by the widget it demonstrates. */
const cardFor = (sample) => {
  const found = document.querySelectorAll(`[data-widget="${sample.widget}"]`)
  expect(found).toHaveLength(1)
  return found[0]
}

/** Put a value into a card the way a child would: click a choice, drag a card, or type. */
function enter(card, sample, value) {
  if (sample.widget === 'cloze') {
    fireEvent.click(within(card).getByRole('radio', { name: value[0] }))
    return
  }
  if (sample.widget === 'choice') {
    const option = sample.instance.visual.options.find((entry) => entry.id === value)
    fireEvent.click(within(card).getByRole('radio', { name: option.label }))
    return
  }
  if (sample.widget === 'order') {
    const orderedIds = () => [...card.querySelectorAll('[data-order-item]')].map((row) => row.dataset.orderItem)
    for (let target = 0; target < value.length; target++) {
      let at = orderedIds().indexOf(value[target])
      while (at > target) {
        fireEvent.click(card.querySelector(`[data-move-up="${value[target]}"]`))
        at -= 1
      }
    }
    return
  }
  if (sample.widget === 'sort') {
    // The value is one bucket id per card, in the order the cards were dealt, so the
    // gallery drives the same place-buttons a kid without a usable drag would press.
    for (const [index, bucketId] of value.entries()) {
      if (bucketId === null) continue
      const itemId = sample.instance.visual.items[index].id
      fireEvent.click(card.querySelector(`[data-sort-place-item="${itemId}"][data-sort-place-bucket="${bucketId}"]`))
    }
    return
  }
  if (sample.widget === 'match') {
    // The value is one description id per card, in the order the cards were dealt, so the
    // gallery drives the same pair-buttons a kid without a usable drag would press.
    for (const [index, leftId] of value.entries()) {
      if (leftId === null) continue
      const rightId = sample.instance.visual.right[index].id
      fireEvent.click(card.querySelector(`[data-match-pair-card="${rightId}"][data-match-pair-slot="${leftId}"]`))
    }
    return
  }
  if (sample.widget === 'clock') {
    // The value is the hour and the minute the hands are to show, so the gallery walks the
    // same steppers a kid without a usable drag would press. Both hands go forwards only:
    // every one of the 144 times the face can show is reachable that way.
    const step = (which, times) => {
      const button = card.querySelector(`[data-clock-step="${which}"]`)
      for (let index = 0; index < times; index++) fireEvent.click(button)
    }
    const [hourNow, minuteNow] = card.querySelector('[data-clock]').dataset.clockTime.split(':').map(Number)
    step('hour-forward', (value[0] - hourNow + 12) % 12)
    step('minute-forward', ((value[1] - minuteNow + 60) % 60) / 5)
    return
  }
  if (sample.widget === 'coins') {
    for (const [coin, count] of Object.entries(value)) {
      const button = card.querySelector(`[data-coin-add="${coin}"]`)
      for (let index = 0; index < count; index++) fireEvent.click(button)
    }
    return
  }
  if (sample.widget === 'tap-select') {
    for (const id of value) {
      const index = sample.instance.visual.tokens.findIndex((entry) => entry.id === id)
      fireEvent.click(within(card).getAllByRole('button')[index])
    }
    return
  }
  if (sample.widget === 'fraction-bar') {
    for (const index of value) fireEvent.click(within(card).getAllByRole('button')[index])
    return
  }
  if (sample.widget === 'number-line') {
    fireEvent.click(within(card).getByRole('button', { name: `Mark ${value} of ${sample.instance.visual.segments}` }))
    return
  }
  if (sample.widget === 'table-fill') {
    for (const [id, cellValue] of Object.entries(value)) {
      fireEvent.change(within(card).getByRole('textbox', { name: new RegExp(`centimeters.*${id}`, 'i') }), { target: { value: cellValue } })
    }
    return
  }
  if (sample.widget === 'expression') {
    fireEvent.change(within(card).getByRole('textbox', { name: /expression/i }), { target: { value } })
    return
  }
  if (sample.widget === 'steps') {
    within(card).getAllByRole('textbox', { name: /step/i }).forEach((field, index) => {
      fireEvent.change(field, { target: { value: value[index] } })
    })
    return
  }
  fireEvent.change(within(card).getByLabelText('Your answer'), { target: { value } })
}

const checkButton = (card) => within(card).getByRole('button', { name: /check/i })
const revealButton = (card) => within(card).getByRole('button', { name: /dev only/i })
const verdictOf = (card) => card.querySelector('[data-verdict]')

describe('the gallery shows every widget', () => {
  test('one card per sample, and no cards for widgets that have no sample', () => {
    render(<WidgetGallery samples={samples} />)
    expect(document.querySelectorAll('[data-widget]')).toHaveLength(samples.length)
    for (const sample of samples) expect(cardFor(sample)).toBeInTheDocument()
  })

  test('each card names the widget it is demonstrating, in words the reader can see', () => {
    render(<WidgetGallery samples={samples} />)
    for (const sample of samples) {
      expect(cardFor(sample).textContent).toContain(sample.widget)
    }
  })

  test('each card shows that sample’s real prompt, once', () => {
    render(<WidgetGallery samples={samples} />)
    for (const sample of samples) {
      expect(within(cardFor(sample)).getByText(sample.instance.prompt)).toBeInTheDocument()
    }
  })

  test('each card mounts the real AnswerWidget, not a gallery-only copy of it', () => {
    render(<WidgetGallery samples={samples} />)
    for (const sample of samples) {
      const card = cardFor(sample)
      if (sample.widget === 'cloze') {
        expect(within(card).getAllByRole('radio')).toHaveLength(sample.instance.visual.choices.length)
      } else if (sample.widget === 'choice') {
        expect(within(card).getAllByRole('radio')).toHaveLength(sample.instance.visual.options.length)
      } else if (sample.widget === 'order') {
        expect(within(card).getAllByRole('listitem')).toHaveLength(sample.instance.visual.items.length)
        expect(card.querySelectorAll('[data-move-up]')).toHaveLength(sample.instance.visual.items.length)
      } else if (sample.widget === 'sort') {
        expect(card.querySelectorAll('[data-sort-item]')).toHaveLength(sample.instance.visual.items.length)
        expect(card.querySelectorAll('[data-sort-bucket]')).toHaveLength(sample.instance.visual.buckets.length)
        expect(card.querySelectorAll('[data-sort-place-item]')).toHaveLength(
          sample.instance.visual.items.length * sample.instance.visual.buckets.length,
        )
      } else if (sample.widget === 'match') {
        expect(card.querySelectorAll('[data-match-card]')).toHaveLength(sample.instance.visual.right.length)
        expect(card.querySelectorAll('[data-match-slot]')).toHaveLength(sample.instance.visual.left.length)
        expect(card.querySelectorAll('[data-match-pair-card]')).toHaveLength(
          sample.instance.visual.right.length * sample.instance.visual.left.length,
        )
        // A pairing board answers by pairing. A text field here would be the P2.6 bug back.
        expect(within(card).queryByLabelText('Your answer')).toBeNull()
      } else if (sample.widget === 'clock') {
        expect(card.querySelectorAll('[data-clock-hand]')).toHaveLength(2)
        expect(card.querySelectorAll('[data-clock-dial]')).toHaveLength(1)
        expect(card.querySelectorAll('[data-clock-step]')).toHaveLength(4)
        // A clock answers by moving hands. A text field here would be the P2.6 bug back.
        expect(within(card).queryByLabelText('Your answer')).toBeNull()
      } else if (sample.widget === 'coins') {
        expect(within(card).getAllByRole('button')).toHaveLength(sample.instance.visual.denominations.length * 2 + 2)
        expect(within(card).queryByLabelText('Your answer')).toBeNull()
      } else if (sample.widget === 'tap-select') {
        expect(within(card).getAllByRole('button')).toHaveLength(sample.instance.visual.tokens.length + 2)
        expect(within(card).queryByLabelText('Your answer')).toBeNull()
      } else if (sample.widget === 'fraction-bar') {
        expect(within(card).getAllByRole('button')).toHaveLength(sample.instance.visual.segments + 2)
        expect(within(card).queryByLabelText('Your answer')).toBeNull()
      } else if (sample.widget === 'number-line') {
        expect(within(card).getAllByRole('button')).toHaveLength(sample.instance.visual.segments + 3)
        expect(within(card).queryByLabelText('Your answer')).toBeNull()
      } else if (sample.widget === 'table-fill') {
        expect(card.querySelectorAll('tbody tr')).toHaveLength(4)
        expect(within(card).getAllByRole('textbox')).toHaveLength(4)
        expect(within(card).queryByLabelText('Your answer')).toBeNull()
      } else if (sample.widget === 'expression') {
        const expectedId = `answer-${sample.instance.seed}-${sample.instance.problemId}`
        expect(within(card).getByRole('textbox', { name: /expression/i })).toHaveAttribute('id', expectedId)
      } else if (sample.widget === 'steps') {
        expect(within(card).getAllByRole('textbox', { name: /step/i })).toHaveLength(sample.instance.visual.items.length)
      } else {
        const expectedId = `answer-${sample.instance.seed}-${sample.instance.problemId}`
        expect(within(card).getByLabelText('Your answer')).toHaveAttribute('id', expectedId)
      }
    }
  })

  test('it is a client component — it holds answer state in the browser', () => {
    expect(source.startsWith("'use client'")).toBe(true)
  })
})

describe('every widget grades right and wrong through the real checker', () => {
  test('no verdict is shown before the reader checks', () => {
    render(<WidgetGallery samples={samples} />)
    for (const sample of samples) expect(verdictOf(cardFor(sample))).toBeNull()
  })

  test('the correct answer is graded correct, in every widget', () => {
    render(<WidgetGallery samples={samples} />)
    for (const sample of samples) {
      const card = cardFor(sample)
      enter(card, sample, correctValueFor(sample))
      fireEvent.click(checkButton(card))
      const verdict = verdictOf(card)
      expect(verdict).toHaveAttribute('data-verdict', 'correct')
      expect(verdict.textContent.trim().length).toBeGreaterThan(0)
    }
  })

  test('a wrong answer is graded wrong, in every widget', () => {
    render(<WidgetGallery samples={samples} />)
    for (const sample of samples) {
      const card = cardFor(sample)
      enter(card, sample, wrongValueFor(sample))
      fireEvent.click(checkButton(card))
      expect(verdictOf(card)).toHaveAttribute('data-verdict', 'wrong')
    }
  })

  test('checking one card leaves the others unjudged', () => {
    render(<WidgetGallery samples={samples} />)
    const [first, ...rest] = samples
    const card = cardFor(first)
    enter(card, first, correctValueFor(first))
    fireEvent.click(checkButton(card))
    expect(verdictOf(card)).not.toBeNull()
    for (const sample of rest) expect(verdictOf(cardFor(sample))).toBeNull()
  })

  test('a right fraction in the wrong form reports not-simplest — only the real checker says that', () => {
    const fraction = samples.find((sample) => sample.widget === 'fraction')
    expect(fraction.answer.simplest).toBe(true)
    render(<WidgetGallery samples={samples} />)
    const card = cardFor(fraction)
    enter(card, fraction, `${fraction.answer.num * 2}/${fraction.answer.den * 2}`)
    fireEvent.click(checkButton(card))
    expect(verdictOf(card)).toHaveAttribute('data-verdict', 'not-simplest')
  })

  test('an unanswered number card reports invalid, not wrong', () => {
    const number = samples.find((sample) => sample.widget === 'number')
    render(<WidgetGallery samples={samples} />)
    const card = cardFor(number)
    fireEvent.click(checkButton(card))
    expect(verdictOf(card)).toHaveAttribute('data-verdict', 'invalid')
  })

  test('the verdict updates when the reader answers again', () => {
    const number = samples.find((sample) => sample.widget === 'number')
    render(<WidgetGallery samples={samples} />)
    const card = cardFor(number)
    enter(card, number, wrongValueFor(number))
    fireEvent.click(checkButton(card))
    expect(verdictOf(card)).toHaveAttribute('data-verdict', 'wrong')
    enter(card, number, correctValueFor(number))
    fireEvent.click(checkButton(card))
    expect(verdictOf(card)).toHaveAttribute('data-verdict', 'correct')
  })
})

describe('the answer is dev-only, and hidden until asked for', () => {
  test('every card offers to reveal it, and the control says it is dev only', () => {
    render(<WidgetGallery samples={samples} />)
    for (const sample of samples) expect(revealButton(cardFor(sample))).toBeInTheDocument()
  })

  test('nothing is revealed until the reveal is clicked, and then the answer is there', () => {
    render(<WidgetGallery samples={samples} />)
    for (const sample of samples) {
      const card = cardFor(sample)
      expect(card.querySelector('[data-dev-only]')).toBeNull()
      fireEvent.click(revealButton(card))
      const revealed = card.querySelector('[data-dev-only]')
      expect(revealed).not.toBeNull()
      const right = correctValueFor(sample)
      const shown = sample.widget === 'cloze'
        ? right[0]
        : sample.widget === 'table-fill'
          ? sample.instance.visual.rows.map(({ id, meters }) => `${meters} meters = ${right[id]} centimeters`).join(', ')
        : sample.widget === 'coins'
          ? Object.entries(right)
            .filter(([, count]) => count > 0)
            .map(([coin, count]) => `${count} ${coinLabels[coin][count === 1 ? 0 : 1]}`)
            .join(', ')
          : Array.isArray(right) ? right.join(', ') : String(right)
      expect(revealed.textContent).toContain(shown)
    }
  })

  test('revealing one card’s answer does not reveal the rest', () => {
    render(<WidgetGallery samples={samples} />)
    const [first, ...rest] = samples
    fireEvent.click(revealButton(cardFor(first)))
    expect(cardFor(first).querySelector('[data-dev-only]')).not.toBeNull()
    for (const sample of rest) expect(cardFor(sample).querySelector('[data-dev-only]')).toBeNull()
  })
})

test('the gallery speaks of Nora, never of "AI"', () => {
  const { container } = render(<WidgetGallery samples={samples} />)
  expect(container.textContent).not.toMatch(/\bAI\b/)
})
