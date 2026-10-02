'use client'

import { useId, useRef, useState } from 'react'

const SIZE = 240
const PADDING = 22
const MAX_TAP_MOVEMENT = 8

function mapX(x, visual) {
  return PADDING + (x - visual.xMin) / (visual.xMax - visual.xMin) * (SIZE - 2 * PADDING)
}

function mapY(y, visual) {
  return SIZE - PADDING - (y - visual.yMin) / (visual.yMax - visual.yMin) * (SIZE - 2 * PADDING)
}

function fitCurve(points, mode) {
  const requiredPoints = mode === 'line' ? 2 : mode === 'parabola' ? 3 : 0
  if (requiredPoints === 0 || points.length < requiredPoints || new Set(points.map(({ x }) => x)).size < requiredPoints) return null

  if (mode === 'line') {
    const [first, second] = points
    const slope = (second.y - first.y) / (second.x - first.x)
    const intercept = first.y - slope * first.x
    return (x) => slope * x + intercept
  }

  const [first, second, third] = [...points].sort((left, right) => left.x - right.x)
  const firstSlope = (second.y - first.y) / (second.x - first.x)
  const secondSlope = (third.y - second.y) / (third.x - second.x)
  const a = (secondSlope - firstSlope) / (third.x - first.x)
  const b = firstSlope - a * (first.x + second.x)
  const c = first.y - a * first.x ** 2 - b * first.x
  return (x) => a * x ** 2 + b * x + c
}

function curvePath(points, visual) {
  const evaluate = fitCurve(points, visual.mode)
  if (!evaluate) return null
  const { xMin, xMax } = visual
  if (visual.mode === 'line') {
    return `M ${mapX(xMin, visual)} ${mapY(evaluate(xMin), visual)} L ${mapX(xMax, visual)} ${mapY(evaluate(xMax), visual)}`
  }

  const sampleXs = Array.from({ length: 65 }, (_, index) => xMin + (xMax - xMin) * index / 64)
  const xValues = [...new Set([...sampleXs, ...points.map(({ x }) => x)])].sort((left, right) => left - right)
  return xValues.map((x, index) => `${index === 0 ? 'M' : 'L'} ${mapX(x, visual)} ${mapY(evaluate(x), visual)}`).join(' ')
}

function coordinateAtPointer(event, svg, visual) {
  const rect = svg.getBoundingClientRect()
  if (rect.width <= 0 || rect.height <= 0) return null
  const plotWidth = rect.width * (SIZE - 2 * PADDING) / SIZE
  const plotHeight = rect.height * (SIZE - 2 * PADDING) / SIZE
  const clientX = Number.isFinite(event.clientX) ? event.clientX : rect.left + rect.width / 2
  const clientY = Number.isFinite(event.clientY) ? event.clientY : rect.top + rect.height / 2
  const xRatio = Math.max(0, Math.min(1, (clientX - rect.left - rect.width * PADDING / SIZE) / plotWidth))
  const yRatio = Math.max(0, Math.min(1, (clientY - rect.top - rect.height * PADDING / SIZE) / plotHeight))
  const x = visual.xMin + xRatio * (visual.xMax - visual.xMin)
  const y = visual.yMax - yRatio * (visual.yMax - visual.yMin)
  return { x: Math.round(x * 100) / 100, y: Math.round(y * 100) / 100 }
}

function tickValues(min, max) {
  const ticks = []
  for (let value = Math.ceil(min); value <= max; value++) ticks.push(value)
  return ticks
}

function GraphPrompt({ instance }) {
  const pair = instance.visual.mode === 'point'
    ? instance.prompt.match(/^(.*\()(-?\d+)(, )(-?\d+)(\).*)$/)
    : null
  if (!pair) return <div className="text-slate-700">{instance.prompt}</div>
  return (
    <div className="text-slate-700">
      <span>{pair[1]}</span><span>{pair[2]}</span><span>{pair[3]}</span><span>{pair[4]}</span><span>{pair[5]}</span>
    </div>
  )
}

function GraphAxes({ visual }) {
  const xTicks = tickValues(visual.xMin, visual.xMax)
  const yTicks = tickValues(visual.yMin, visual.yMax)
  const xAxis = visual.yMin <= 0 && visual.yMax >= 0 ? mapY(0, visual) : SIZE - PADDING
  const yAxis = visual.xMin <= 0 && visual.xMax >= 0 ? mapX(0, visual) : PADDING
  return (
    <>
      {xTicks.map((x) => (
        <g key={`x-${x}`}>
          <line x1={mapX(x, visual)} x2={mapX(x, visual)} y1={PADDING} y2={SIZE - PADDING} stroke={x === 0 ? '#334155' : '#e2e8f0'} strokeWidth={x === 0 ? 2 : 1} />
          <text data-graph-axis-label="true" x={mapX(x, visual)} y={xAxis + 14} textAnchor="middle" fontSize="9" fill="#334155">{x}</text>
        </g>
      ))}
      {yTicks.map((y) => (
        <g key={`y-${y}`}>
          <line x1={PADDING} x2={SIZE - PADDING} y1={mapY(y, visual)} y2={mapY(y, visual)} stroke={y === 0 ? '#334155' : '#e2e8f0'} strokeWidth={y === 0 ? 2 : 1} />
          {y !== 0 && <text data-graph-axis-label="true" x={yAxis - 7} y={mapY(y, visual) + 3} textAnchor="end" fontSize="9" fill="#334155">{y}</text>}
        </g>
      ))}
      <text data-graph-axis-label="true" x={SIZE - PADDING} y={xAxis - 7} textAnchor="end" fontSize="11" fill="#0f172a">x</text>
      <text data-graph-axis-label="true" x={yAxis + 7} y={PADDING - 7} fontSize="11" fill="#0f172a">y</text>
    </>
  )
}

function GraphCurve({ path, mode, clipId }) {
  if (!path) return null
  return (
    <>
      <defs>
        <clipPath id={clipId} clipPathUnits="userSpaceOnUse">
          <rect x={PADDING} y={PADDING} width={SIZE - 2 * PADDING} height={SIZE - 2 * PADDING} />
        </clipPath>
      </defs>
      <path data-graph-curve={mode} d={path} clipPath={`url(#${clipId})`} fill="none" stroke="#dc2626" strokeWidth="2.5" strokeLinecap="round" />
    </>
  )
}

function GraphPoints({ value, visual }) {
  return value.map((point, index) => (
    <g key={`${point.x}-${point.y}-${index}`} data-graph-point="true">
      <circle cx={mapX(point.x, visual)} cy={mapY(point.y, visual)} r="5" fill="#2563eb" stroke="white" strokeWidth="2" />
    </g>
  ))
}

function CoordinatePlane({ visual, value, onPlot, disabled }) {
  const clipId = `graph-plot-${useId().replace(/[^a-zA-Z0-9_-]/g, '')}`
  const touchGesture = useRef(null)
  const path = curvePath(value, visual)

  function finishTouch(event) {
    const gesture = touchGesture.current
    touchGesture.current = null
    if (!gesture || gesture.pointerId !== event.pointerId || gesture.moved || disabled) return
    onPlot(gesture.point)
  }

  return (
    <svg
      role="img"
      aria-label="Coordinate plane"
      viewBox={`0 0 ${SIZE} ${SIZE}`}
      className="block w-full max-w-[360px] rounded border border-slate-300 bg-white"
      onPointerDown={(event) => {
        if (disabled) return
        const point = coordinateAtPointer(event, event.currentTarget, visual)
        if (!point) return
        if (event.pointerType !== 'touch') {
          onPlot(point)
          return
        }
        touchGesture.current = {
          pointerId: event.pointerId,
          clientX: event.clientX,
          clientY: event.clientY,
          moved: false,
          point,
        }
      }}
      onPointerMove={(event) => {
        const gesture = touchGesture.current
        if (!gesture || gesture.pointerId !== event.pointerId) return
        const distance = Math.hypot(event.clientX - gesture.clientX, event.clientY - gesture.clientY)
        if (distance > MAX_TAP_MOVEMENT) gesture.moved = true
      }}
      onPointerUp={finishTouch}
      onPointerCancel={() => { touchGesture.current = null }}
    >
      <GraphAxes visual={visual} />
      <GraphCurve path={path} mode={visual.mode} clipId={clipId} />
      <GraphPoints value={value} visual={visual} />
    </svg>
  )
}

function canPlot(point, visual, value) {
  const maximum = { point: 1, line: 2, parabola: 3 }[visual.mode]
  const existing = value.length >= maximum ? value.slice(0, -1) : value
  return Number.isFinite(point.x) && Number.isFinite(point.y) &&
    point.x >= visual.xMin && point.x <= visual.xMax &&
    point.y >= visual.yMin && point.y <= visual.yMax &&
    !existing.some((plotted) => plotted.x === point.x)
}

export function GraphWidget({ instance, value, onChange, disabled }) {
  const { visual } = instance
  const [x, setX] = useState('')
  const [y, setY] = useState('')
  const point = { x: Number(x), y: Number(y) }
  const mayPlot = x !== '' && y !== '' && canPlot(point, visual, value)

  const plot = (nextPoint) => {
    if (disabled || !canPlot(nextPoint, visual, value)) return
    onChange(value.length >= { point: 1, line: 2, parabola: 3 }[visual.mode]
      ? [...value.slice(0, -1), nextPoint]
      : [...value, nextPoint])
  }

  return (
    <div className="flex min-w-0 w-full flex-col gap-4">
      <GraphPrompt instance={instance} />
      <CoordinatePlane visual={visual} value={value} onPlot={plot} disabled={disabled} />
      <fieldset className="flex min-w-0 flex-wrap items-end gap-3" disabled={disabled}>
        <legend className="mb-2 font-medium text-slate-800">Plot coordinates</legend>
        <label className="flex min-w-0 flex-1 flex-col gap-1 text-slate-700">
          x coordinate
          <input aria-label="x coordinate" type="number" step="any" value={x} onChange={(event) => setX(event.target.value)} className="min-h-11 w-full rounded border border-slate-300 px-3" />
        </label>
        <label className="flex min-w-0 flex-1 flex-col gap-1 text-slate-700">
          y coordinate
          <input aria-label="y coordinate" type="number" step="any" value={y} onChange={(event) => setY(event.target.value)} className="min-h-11 w-full rounded border border-slate-300 px-3" />
        </label>
        <button type="button" disabled={!mayPlot || disabled} onClick={() => plot(point)} className="min-h-11 rounded bg-blue-700 px-4 text-white disabled:opacity-50">Plot point</button>
      </fieldset>
      <div aria-live="polite" className="text-slate-700">
        {value.length === 0 ? 'No points plotted.' : value.map((entry, index) => (
          <div key={`${entry.x}-${entry.y}-${index}`}>Point {index + 1}: ({entry.x}, {entry.y})</div>
        ))}
      </div>
      <div className="flex flex-wrap gap-3">
        <button type="button" disabled={disabled || value.length === 0} onClick={() => onChange(value.slice(0, -1))} className="min-h-11 rounded border border-slate-400 px-4 disabled:opacity-50">Undo last point</button>
        <button type="button" disabled={disabled || value.length === 0} onClick={() => onChange([])} className="min-h-11 rounded border border-slate-400 px-4 disabled:opacity-50">Clear plot</button>
      </div>
    </div>
  )
}