import { describe, expect, it } from '@jest/globals'
import '@testing-library/jest-dom'
import { fireEvent, render, screen } from '@testing-library/react'
import { useState } from 'react'
import { check, getProblem, render as draw, toInstance } from '@grove/curriculum'
import { AnswerWidget } from './AnswerWidget'
import { emptyValue, toResponse } from './response'

const ID = 'm5.nf.equiv-fractions/place-on-number-line'

function Harness({ instance, draft, disabled }) {
  const [value, setValue] = useState(() => emptyValue(instance))
  draft.current = value
  return <AnswerWidget instance={instance} value={value} onChange={setValue} disabled={disabled} />
}

function mount(seed = 2505) {
  const full = draw(getProblem(ID), seed)
  const instance = toInstance(full)
  const draft = { current: undefined }
  const view = render(<Harness instance={instance} draft={draft} disabled={false} />)
  const tick = (index) => screen.getByRole('button', { name: `Mark ${index} of ${instance.visual.segments}` })
  return { full, instance, draft, view, tick }
}

describe('number-line point placement', () => {
  it('draws N+1 equally positioned ticks, labels only endpoints and selects none', () => {
    const { full, instance, draft, view, tick } = mount()
    const N = instance.visual.segments
    expect(view.container.textContent).toContain(full.prompt)
    expect(view.container.querySelectorAll('[data-number-line-endpoint]')).toHaveLength(2)
    expect([...view.container.querySelectorAll('[data-number-line-endpoint]')].map((node) => node.textContent.trim())).toEqual(['0', '1'])
    expect(view.container.querySelectorAll('input,textarea,select,[contenteditable="true"]')).toHaveLength(0)
    expect(screen.queryByLabelText('Your answer')).toBeNull()
    expect(screen.getAllByRole('button')).toHaveLength(N + 1)
    for (let index = 0; index <= N; index++) expect(tick(index)).toHaveAttribute('aria-pressed', 'false')
    expect(view.container.textContent).not.toContain(full.explanation)
    expect(view.container.textContent).not.toContain(`${full.answer.num * N / full.answer.den}/${N}`)
    expect(toResponse(instance, draft.current)).toEqual({ text: '' })
    expect(check('number-line', full.answer, toResponse(instance, draft.current))).toEqual({ correct: false, reason: 'invalid' })
  })

  it('grades actual endpoint and equivalent taps through the real checker and honors disabled', () => {
    const { full, instance, draft, view, tick } = mount(42)
    const N = instance.visual.segments
    const answerIndex = full.answer.num * N / full.answer.den
    fireEvent.click(tick(0))
    expect(toResponse(instance, draft.current)).toEqual({ text: `0/${N}` })
    expect(check('number-line', full.answer, toResponse(instance, draft.current))).toEqual({ correct: false, reason: 'wrong' })
    fireEvent.click(tick(N))
    expect(check('number-line', full.answer, toResponse(instance, draft.current))).toEqual({ correct: false, reason: 'wrong' })
    fireEvent.click(tick(answerIndex))
    expect(tick(answerIndex)).toHaveAttribute('aria-pressed', 'true')
    expect(screen.getAllByRole('button').filter((button) => button.getAttribute('aria-pressed') === 'true')).toHaveLength(1)
    expect(toResponse(instance, draft.current)).toEqual({ text: `${answerIndex}/${N}` })
    expect(check('number-line', full.answer, toResponse(instance, draft.current))).toEqual({ correct: true, reason: null })
    view.rerender(<Harness instance={instance} draft={draft} disabled />)
    fireEvent.click(tick(0))
    expect(tick(0)).toBeDisabled()
    expect(toResponse(instance, draft.current)).toEqual({ text: `${answerIndex}/${N}` })
  })
})
