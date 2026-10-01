import { fireEvent, render as renderDom, screen } from '@testing-library/react'
import '@testing-library/jest-dom'
import { useState } from 'react'

import { check, getProblem, listProblems, render, toInstance } from '@grove/curriculum'

import { correctValueFor, gallerySamples, wrongValueFor } from '@/app/dev/widgets/samples'

import { AnswerWidget } from './AnswerWidget'
import { emptyValue, toResponse } from './response'

const CASES = [
  ['m5.g.coordinate-plane/plot-point', 'point', 'm5.g.coordinate-plane'],
  ['m5.oa.variables/graph-line', 'line', 'm5.oa.variables'],
  ['m5.oa.variables/graph-parabola', 'parabola', 'm5.oa.variables'],
]
const RIGHT = { correct: true, reason: null }
const WRONG = { correct: false, reason: 'wrong' }
const INVALID = { correct: false, reason: 'invalid' }

function seeded(id, seed = 2505) {
  const template = getProblem(id)
  expect(template).not.toBeNull()
  const full = render(template, seed)
  return { full, instance: toInstance(full) }
}

function Harness({ instance, record, disabled = false }) {
  const [value, onChange] = useState(() => emptyValue(instance))
  record.value = value
  return <AnswerWidget instance={instance} value={value} onChange={onChange} disabled={disabled} />
}

test.each(CASES)('%s is a registered, private, seed-stable graph problem with a usable viewport', (id, mode, skill) => {
  expect(listProblems().find((problem) => problem.id === id)).toEqual(expect.objectContaining({ skill, widget: 'graph' }))
  const { full, instance } = seeded(id)
  expect(full.widget).toBe('graph')
  expect(instance.visual).toEqual({
    kind: 'graph', mode,
    xMin: expect.any(Number), xMax: expect.any(Number),
    yMin: expect.any(Number), yMax: expect.any(Number),
  })
  expect(instance.visual.xMin).toBeLessThan(instance.visual.xMax)
  expect(instance.visual.yMin).toBeLessThan(instance.visual.yMax)
  expect(full.answer.points).toHaveLength({ point: 1, line: 2, parabola: 3 }[mode])
  expect(new Set(full.answer.points.map((point) => point.x)).size).toBe(full.answer.points.length)
  for (const point of full.answer.points) {
    expect(point).toEqual({ x: expect.any(Number), y: expect.any(Number) })
    expect(point.x).toBeGreaterThanOrEqual(instance.visual.xMin)
    expect(point.x).toBeLessThanOrEqual(instance.visual.xMax)
    expect(point.y).toBeGreaterThanOrEqual(instance.visual.yMin)
    expect(point.y).toBeLessThanOrEqual(instance.visual.yMax)
  }
  expect(JSON.stringify(instance)).not.toMatch(/"(?:answer|hints|explanation|points|tolerance)"\s*:/)
  expect(render(getProblem(id), 2505)).toEqual(full)
})

test.each(CASES)('%s grades geometry with tolerance but rejects invalid and misplaced plots', (id) => {
  const { full, instance } = seeded(id)
  const expected = full.answer.points
  const grade = (points) => check('graph', full.answer, toResponse(instance, points))
  expect(emptyValue(instance)).toEqual([])
  expect(grade(expected)).toEqual(RIGHT)
  const towardCenter = (y, distance) => y + (y + distance <= instance.visual.yMax ? distance : -distance)
  expect(grade(expected.map(({ x, y }) => ({ x, y: towardCenter(y, 0.1) })))).toEqual(RIGHT)
  const misplaced = expected.map((point, index) => index === expected.length - 1 ? { ...point, y: towardCenter(point.y, 1) } : point)
  expect(grade(misplaced)).toEqual(WRONG)
  expect(grade([])).toEqual(INVALID)
  expect(grade(expected.slice(0, -1))).toEqual(INVALID)
  expect(grade([...expected, expected[0]])).toEqual(INVALID)
  expect(grade(expected.map((point, index) => index === 0 ? { ...point, x: instance.visual.xMax + 1 } : point))).toEqual(INVALID)
  expect(grade(expected.map((point, index) => index === 0 ? { ...point, y: Number.NaN } : point))).toEqual(INVALID)
  if (expected.length > 1) {
    expect(grade(expected.map((point, index) => index === 1 ? { ...point, x: expected[0].x } : point))).toEqual(INVALID)
  }
  expect(check('graph', full.answer, { points: 'not points' })).toEqual(INVALID)
  expect(check('graph', full.answer, { points: expected, kind: 'other' })).toEqual(INVALID)
})

test.each(CASES)('%s stays answerable and grades correctly over 500 deterministic seeds', (id) => {
  const seen = new Set()
  for (let seed = 1; seed <= 500; seed++) {
    const { full, instance } = seeded(id, seed)
    expect(check('graph', full.answer, toResponse(instance, full.answer.points))).toEqual(RIGHT)
    const wrong = full.answer.points.map((point, index) => index === 0
      ? { ...point, y: point.y + (point.y + 1 <= instance.visual.yMax ? 1 : -1) } : point)
    expect(check('graph', full.answer, toResponse(instance, wrong))).toEqual(WRONG)
    seen.add(JSON.stringify(full.answer.points))
  }
  expect(seen.size).toBeGreaterThan(20)
})

test('the development gallery uses a real point problem and both verdicts go through the real checker', () => {
  const sample = gallerySamples().find((entry) => entry.widget === 'graph')
  expect(sample).toBeDefined()
  expect(sample.problemId).toBe(CASES[0][0])
  expect(sample.instance).toEqual(toInstance(render(getProblem(sample.problemId), 2505)))
  expect(check('graph', sample.answer, toResponse(sample.instance, correctValueFor(sample)))).toEqual(RIGHT)
  expect(check('graph', sample.answer, toResponse(sample.instance, wrongValueFor(sample)))).toEqual(WRONG)
})

test('the coordinate plane plots by keyboard and touch without showing a private solution', () => {
  const { instance, full } = seeded(CASES[0][0])
  const record = {}
  const { container } = renderDom(<Harness instance={instance} record={record} />)
  const svg = screen.getByRole('img', { name: /coordinate plane/i })
  expect(svg.tagName.toLowerCase()).toBe('svg')
  const first = full.answer.points[0]
  fireEvent.change(screen.getByLabelText(/^x coordinate$/i), { target: { value: String(first.x) } })
  fireEvent.change(screen.getByLabelText(/^y coordinate$/i), { target: { value: String(first.y) } })
  fireEvent.click(screen.getByRole('button', { name: /plot point/i }))
  expect(record.value).toEqual([first])
  expect(container.querySelectorAll('[data-graph-point]')).toHaveLength(1)
  expect(screen.getByText(new RegExp(`${first.x}.*${first.y}`))).toBeVisible()
  expect(check('graph', full.answer, toResponse(instance, record.value))).toEqual(RIGHT)
  fireEvent.click(screen.getByRole('button', { name: /clear plot/i }))
  expect(record.value).toEqual([])
  svg.getBoundingClientRect = () => ({ left: 0, top: 0, width: 240, height: 240 })
  fireEvent.pointerDown(svg, { pointerId: 1, pointerType: 'touch', clientX: 120, clientY: 120 })
  expect(record.value).toEqual([{ x: (instance.visual.xMin + instance.visual.xMax) / 2, y: (instance.visual.yMin + instance.visual.yMax) / 2 }])
})

test('a locked graph refuses keyboard and touch edits', () => {
  const { instance } = seeded(CASES[0][0])
  const record = {}
  renderDom(<Harness instance={instance} record={record} disabled />)
  expect(screen.getByLabelText(/^x coordinate$/i)).toBeDisabled()
  expect(screen.getByLabelText(/^y coordinate$/i)).toBeDisabled()
  expect(screen.getByRole('button', { name: /plot point/i })).toBeDisabled()
  const svg = screen.getByRole('img', { name: /coordinate plane/i })
  svg.getBoundingClientRect = () => ({ left: 0, top: 0, width: 240, height: 240 })
  fireEvent.pointerDown(svg, { pointerId: 2, pointerType: 'touch', clientX: 120, clientY: 120 })
  expect(record.value).toEqual([])
})