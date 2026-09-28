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
      const shown = sample.widget === 'cloze' ? right[0] : Array.isArray(right) ? right.join(', ') : right
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
