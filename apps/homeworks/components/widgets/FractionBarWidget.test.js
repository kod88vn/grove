import { describe, expect, it } from '@jest/globals'
import '@testing-library/jest-dom'
import { fireEvent, render, screen, within } from '@testing-library/react'
import { useState } from 'react'
import { check, getProblem, render as draw, toInstance } from '@grove/curriculum'
import { AnswerWidget } from './AnswerWidget'
import { emptyValue, toResponse } from './response'

const ID = 'm5.nf.equiv-fractions/shade-equivalent'

function Harness({ instance, draft, disabled = false }) {
  const [value, setValue] = useState(() => emptyValue(instance))
  draft.current = value
  return <AnswerWidget instance={instance} value={value} onChange={setValue} disabled={disabled} />
}

function mount(seed = 2505, disabled = false) {
  const full = draw(getProblem(ID), seed)
  const instance = toInstance(full)
  const draft = { current: null }
  const view = render(<Harness instance={instance} draft={draft} disabled={disabled} />)
  return { full, instance, draft, view }
}

function answerButtons() {
  return within(screen.getByRole('group', { name: /answer bar/i })).getAllByRole('button')
}

describe('fraction-bar answer interaction', () => {
  it('shows a read-only reference as both a bar and fraction text, with an empty answer bar', () => {
    const { full, instance, draft, view } = mount()
    const reference = screen.getByRole('group', { name: /reference bar/i })
    expect(reference).toHaveTextContent(`${full.answer.num}/${full.answer.den}`)
    expect(within(reference).queryAllByRole('button')).toHaveLength(0)
    expect(answerButtons()).toHaveLength(instance.visual.segments)
    expect(screen.getByText(`Shaded 0 of ${instance.visual.segments}`)).toBeInTheDocument()
    expect(view.container.querySelectorAll('input,textarea,[contenteditable="true"]')).toHaveLength(0)
    expect(toResponse(instance, draft.current)).toEqual({ text: `0/${instance.visual.segments}` })
    expect(view.container.textContent).not.toContain(full.explanation)
    expect(view.container.textContent).not.toContain(full.hints.join(' '))
  })

  it.each([
    [14, 2, 3], [20, 2, 5], [1, 3, 4],
    [44, 3, 5], [30, 4, 5], [36, 5, 6],
  ])('seed %i renders the reference %i/%i with only the numerator shaded', (seed, num, den) => {
    const { instance } = mount(seed)
    expect(instance.visual.reference).toEqual({ num, den })
    const reference = screen.getByRole('group', { name: /reference segments/i })
    const segments = Array.from(reference.querySelectorAll('[data-shaded]'))
    expect(segments).toHaveLength(den)
    expect(segments.filter((segment) => segment.dataset.shaded === 'true')).toHaveLength(num)
    for (const [index, segment] of segments.entries()) {
      const shaded = index < num
      expect(segment).toHaveAttribute('data-shaded', String(shaded))
      expect(segment).toHaveClass(shaded ? 'border-blue-600' : 'border-slate-300')
      expect(segment).toHaveClass(shaded ? 'bg-blue-300' : 'bg-white')
    }
  })

  it('keeps every reference and answer segment on one row at narrow widths', () => {
    const { instance } = mount(20)
    expect(instance.visual.segments).toBeGreaterThanOrEqual(10)
    for (const label of ['Reference segments', 'Answer bar']) {
      const bar = screen.getByRole('group', { name: label })
      expect(bar).toHaveClass('flex-nowrap')
      expect(bar).toHaveClass('overflow-x-auto')
    }
  })

  it('shades and unshades one segment per button, announcing the current state', () => {
    const { instance, draft } = mount(7)
    const buttons = answerButtons()
    for (const button of buttons) {
      expect(button).toHaveAttribute('aria-pressed', 'false')
      expect(button.getAttribute('aria-label')).toMatch(/not shaded/i)
    }
    fireEvent.click(buttons[0])
    expect(buttons[0]).toHaveAttribute('aria-pressed', 'true')
    expect(buttons[0].getAttribute('aria-label')).toMatch(/shaded/i)
    expect(buttons[0].getAttribute('aria-label')).not.toMatch(/not shaded/i)
    expect(screen.getByText(`Shaded 1 of ${instance.visual.segments}`)).toBeInTheDocument()
    expect(toResponse(instance, draft.current)).toEqual({ text: `1/${instance.visual.segments}` })
    fireEvent.click(buttons[0])
    expect(buttons[0]).toHaveAttribute('aria-pressed', 'false')
    expect(screen.getByText(`Shaded 0 of ${instance.visual.segments}`)).toBeInTheDocument()
  })

  it('grades the count through the real checker, and does not modify a disabled answer', () => {
    const { full, instance, draft, view } = mount(42)
    const needed = full.answer.num * instance.visual.segments / full.answer.den
    const buttons = answerButtons()
    for (let index = 0; index < needed; index++) fireEvent.click(buttons[index])
    expect(check('fraction-bar', full.answer, toResponse(instance, draft.current))).toEqual({ correct: true, reason: null })
    fireEvent.click(buttons[needed])
    expect(check('fraction-bar', full.answer, toResponse(instance, draft.current))).toEqual({ correct: false, reason: 'wrong' })
    view.rerender(<Harness instance={instance} draft={draft} disabled />)
    const before = toResponse(instance, draft.current)
    fireEvent.click(answerButtons()[0])
    expect(toResponse(instance, draft.current)).toEqual(before)
    expect(answerButtons()[0]).toBeDisabled()
  })
})
