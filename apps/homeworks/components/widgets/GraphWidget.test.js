import { describe, expect, it } from '@jest/globals'
import '@testing-library/jest-dom'
import { fireEvent, render, screen } from '@testing-library/react'
import { useState } from 'react'
import { getProblem, render as draw, toInstance } from '@grove/curriculum'
import { AnswerWidget } from './AnswerWidget'
import { emptyValue } from './response'

function Harness({ instance, record }) {
  const [value, onChange] = useState(() => emptyValue(instance))
  record.value = value
  return <AnswerWidget instance={instance} value={value} onChange={onChange} disabled={false} />
}

function plotPoint(point) {
  fireEvent.change(screen.getByLabelText(/^x coordinate$/i), { target: { value: String(point.x) } })
  fireEvent.change(screen.getByLabelText(/^y coordinate$/i), { target: { value: String(point.y) } })
  fireEvent.click(screen.getByRole('button', { name: /plot point/i }))
}

function pathCoordinates(path) {
  return [...path.matchAll(/([\d.-]+)[ ,]+([\d.-]+)/g)].map((match) => ({
    x: Number(match[1]),
    y: Number(match[2]),
  }))
}

function plotGraph(id, points) {
  const instance = toInstance(draw(getProblem(id), 2505))
  const record = { value: [] }
  render(<Harness instance={instance} record={record} />)
  const svg = screen.getByRole('img', { name: /coordinate plane/i })
  points.forEach(plotPoint)
  return { instance, record, svg }
}

describe('multi-point graph plotting', () => {
  it.each([
    ['m5.oa.variables/graph-line', 2],
    ['m5.oa.variables/graph-parabola', 3],
  ])('accepts %i keyboard-plotted distinct x values and supports undo and clear', (id, count) => {
    const instance = toInstance(draw(getProblem(id), 2505))
    const record = { value: [] }
    render(<Harness instance={instance} record={record} />)

    for (let index = 0; index < count; index++) {
      fireEvent.change(screen.getByLabelText(/^x coordinate$/i), { target: { value: String(index - 1) } })
      fireEvent.change(screen.getByLabelText(/^y coordinate$/i), { target: { value: String(index + 2) } })
      fireEvent.click(screen.getByRole('button', { name: /plot point/i }))
    }
    expect(record.value).toHaveLength(count)
    expect(new Set(record.value.map(({ x }) => x)).size).toBe(count)

    fireEvent.click(screen.getByRole('button', { name: /undo last point/i }))
    expect(record.value).toHaveLength(count - 1)
    fireEvent.click(screen.getByRole('button', { name: /clear plot/i }))
    expect(record.value).toEqual([])
  })

  it('prevents a duplicate x coordinate while entering a multi-point curve', () => {
    const instance = toInstance(draw(getProblem('m5.oa.variables/graph-line'), 2505))
    const record = { value: [] }
    render(<Harness instance={instance} record={record} />)
    fireEvent.change(screen.getByLabelText(/^x coordinate$/i), { target: { value: '1' } })
    fireEvent.change(screen.getByLabelText(/^y coordinate$/i), { target: { value: '2' } })
    fireEvent.click(screen.getByRole('button', { name: /plot point/i }))
    fireEvent.change(screen.getByLabelText(/^y coordinate$/i), { target: { value: '3' } })
    expect(screen.getByRole('button', { name: /plot point/i })).toBeDisabled()
    expect(record.value).toEqual([{ x: 1, y: 2 }])
  })

  it('fits the line through child points and extends it to both plot edges', () => {
    const points = [{ x: -4, y: -5 }, { x: 2, y: 4 }]
    const { instance, svg } = plotGraph('m5.oa.variables/graph-line', points)
    const curve = svg.querySelector('[data-graph-curve="line"]')
    const path = pathCoordinates(curve.getAttribute('d'))
    const { yMin, yMax } = instance.visual
    const mapY = (y) => 218 - (y - yMin) / (yMax - yMin) * 196

    expect(path[0].x).toBeCloseTo(22)
    expect(path.at(-1).x).toBeCloseTo(218)
    expect(path[0].y).toBeCloseTo(mapY(-6.5))
    expect(path.at(-1).y).toBeCloseTo(mapY(8.5))
    for (const dot of svg.querySelectorAll('[data-graph-point] circle')) {
      const position = (Number(dot.getAttribute('cx')) - path[0].x) / (path.at(-1).x - path[0].x)
      expect(path[0].y + position * (path.at(-1).y - path[0].y)).toBeCloseTo(Number(dot.getAttribute('cy')))
    }
  })

  it('fits a curved parabola through child points and clips it to the plot viewport', () => {
    const points = [{ x: -4, y: 4 }, { x: -1, y: -2 }, { x: 3, y: 4 }]
    const { svg } = plotGraph('m5.oa.variables/graph-parabola', points)
    const curve = svg.querySelector('[data-graph-curve="parabola"]')
    const coordinates = pathCoordinates(curve.getAttribute('d'))
    const clippingId = curve.getAttribute('clip-path').match(/^url\(#(.+)\)$/)[1]
    const clip = svg.querySelector(`clipPath#${clippingId} rect`)

    expect(coordinates[0].x).toBeCloseTo(22)
    expect(coordinates.at(-1).x).toBeCloseTo(218)
    expect(coordinates.length).toBeGreaterThan(20)
    expect(Math.abs(coordinates[Math.floor(coordinates.length / 2)].y - (coordinates[0].y + coordinates.at(-1).y) / 2)).toBeGreaterThan(5)
    expect(clip).not.toBeNull()
    expect(['x', 'y', 'width', 'height'].map((attribute) => Number(clip.getAttribute(attribute)))).toEqual([22, 22, 196, 196])
    for (const dot of svg.querySelectorAll('[data-graph-point] circle')) {
      expect(coordinates.some(({ x, y }) => Math.abs(x - Number(dot.getAttribute('cx'))) < 0.01 && Math.abs(y - Number(dot.getAttribute('cy'))) < 0.01)).toBe(true)
    }
  })

  it.each([
    ['m5.oa.variables/graph-line', [{ x: -2, y: 1 }], 'line'],
    ['m5.oa.variables/graph-parabola', [{ x: -2, y: 1 }, { x: 1, y: 2 }], 'parabola'],
  ])('shows no %s curve until enough child points exist and removes it on clear', (id, points, mode) => {
    const { svg } = plotGraph(id, points)
    expect(svg.querySelector(`[data-graph-curve="${mode}"]`)).toBeNull()
    const [nextPoint] = mode === 'line' ? [{ x: 1, y: 3 }] : [{ x: 3, y: 4 }]
    plotPoint(nextPoint)
    expect(svg.querySelector(`[data-graph-curve="${mode}"]`)).not.toBeNull()
    fireEvent.click(screen.getByRole('button', { name: /clear plot/i }))
    expect(svg.querySelector('[data-graph-curve]')).toBeNull()
  })
})