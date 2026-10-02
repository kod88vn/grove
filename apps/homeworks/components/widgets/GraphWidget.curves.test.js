import { fireEvent, render as renderDom, screen } from '@testing-library/react'
import '@testing-library/jest-dom'
import { useState } from 'react'

import { check, getProblem, render, toInstance } from '@grove/curriculum'

import { AnswerWidget } from './AnswerWidget'
import { emptyValue, toResponse } from './response'

function Harness({ instance, valueRef }) {
  const [value, onChange] = useState(() => emptyValue(instance))
  valueRef.current = value
  return <AnswerWidget instance={instance} value={value} onChange={onChange} />
}

function plot({ x, y }) {
  fireEvent.change(screen.getByLabelText(/^x coordinate$/i), { target: { value: String(x) } })
  fireEvent.change(screen.getByLabelText(/^y coordinate$/i), { target: { value: String(y) } })
  fireEvent.click(screen.getByRole('button', { name: /plot point/i }))
}

test.each([
  ['m5.oa.variables/graph-line', 'line', 2],
  ['m5.oa.variables/graph-parabola', 'parabola', 3],
])('a child drawing %s sees the plotted curve, not only isolated dots', (id, mode, count) => {
  const full = render(getProblem(id), 2505)
  const instance = toInstance(full)
  const valueRef = { current: null }
  renderDom(<Harness instance={instance} valueRef={valueRef} />)
  const svg = screen.getByRole('img', { name: /coordinate plane/i })
  expect(svg.querySelector('[data-graph-curve]')).toBeNull()

  for (const point of full.answer.points.slice(0, count - 1)) plot(point)
  expect(svg.querySelector('[data-graph-curve]')).toBeNull()

  plot(full.answer.points.at(-1))
  expect(valueRef.current).toEqual(full.answer.points)
  expect(check('graph', full.answer, toResponse(instance, valueRef.current))).toEqual({ correct: true, reason: null })
  const curve = svg.querySelector(`[data-graph-curve="${mode}"]`)
  expect(curve).not.toBeNull()
  expect(curve.tagName.toLowerCase()).toBe('path')
  expect(curve.getAttribute('d')).toMatch(/^M\s*[\d.-]+[ ,]+[\d.-]+.+[CL]\s*[\d.-]+/)
  expect(svg.querySelectorAll('[data-graph-point]')).toHaveLength(count)

  fireEvent.click(screen.getByRole('button', { name: /undo last point/i }))
  expect(svg.querySelector('[data-graph-curve]')).toBeNull()
  expect(svg.querySelectorAll('[data-graph-point]')).toHaveLength(count - 1)
})