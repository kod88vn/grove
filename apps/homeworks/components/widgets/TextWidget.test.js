import { fireEvent, render, screen } from '@testing-library/react'
import '@testing-library/jest-dom'
import { useState } from 'react'
import { check, getProblem, render as renderProblem, toInstance } from '@grove/curriculum'
import { AnswerWidget } from './AnswerWidget'
import { emptyValue, toResponse } from './response'
import { correctValueFor, gallerySamples, wrongValueFor } from '@/app/dev/widgets/samples'

const ID = 'm5.g.classify-shapes/name-the-quadrilateral'

function Harness({ instance, disabled = false, current }) {
  const [value, setValue] = useState(() => emptyValue(instance))
  current.value = value
  return <AnswerWidget instance={instance} value={value} onChange={setValue} disabled={disabled} />
}

test.each([1, 7, 42])('real text widget accepts editing and emits a checker-readable response at seed %s', (seed) => {
  const full = renderProblem(getProblem(ID), seed)
  const instance = toInstance(full)
  const current = {}
  const view = render(<Harness instance={instance} current={current} />)
  const field = screen.getByRole('textbox', { name: /your answer/i })
  expect(field).toBeVisible()
  expect(field).toHaveValue('')
  expect(view.container.textContent).toContain(instance.prompt)
  expect(view.container.textContent).not.toContain(full.explanation)
  expect(view.container.innerHTML).not.toMatch(/\b(square|rectangle|rhombus|parallelogram)\b/i)
  expect(check('text', full.answer, toResponse(instance, current.value))).toEqual({ correct: false, reason: 'invalid' })
  fireEvent.change(field, { target: { value: 'quadrilateral' } })
  expect(toResponse(instance, current.value)).toEqual({ text: 'quadrilateral' })
  expect(check('text', full.answer, toResponse(instance, current.value))).toEqual({ correct: false, reason: 'wrong' })
  fireEvent.change(field, { target: { value: `A ${full.answer.accept[0].toUpperCase()}` } })
  expect(check('text', full.answer, toResponse(instance, current.value))).toEqual({ correct: true, reason: null })
})

test('a disabled text answer cannot be edited', () => {
  const instance = toInstance(renderProblem(getProblem(ID), 42))
  const current = {}
  render(<Harness instance={instance} current={current} disabled />)
  const field = screen.getByRole('textbox', { name: /your answer/i })
  expect(field).toBeDisabled()
  fireEvent.change(field, { target: { value: 'square' } })
  expect(toResponse(instance, current.value)).toEqual({ text: '' })
})

test('the gallery derives a text sample from the registered problem, with real right and wrong responses', () => {
  const sample = gallerySamples().find((entry) => entry.widget === 'text')
  expect(sample).toBeDefined()
  expect(sample.problemId).toBe(ID)
  expect(sample.instance).toEqual(toInstance(renderProblem(getProblem(ID), 2505)))
  expect(check('text', sample.answer, toResponse(sample.instance, correctValueFor(sample)))).toEqual({ correct: true, reason: null })
  expect(check('text', sample.answer, toResponse(sample.instance, wrongValueFor(sample)))).toEqual({ correct: false, reason: 'wrong' })
})
