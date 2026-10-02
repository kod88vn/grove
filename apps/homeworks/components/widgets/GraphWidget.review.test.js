import { fireEvent, render as renderDom, screen, within } from '@testing-library/react'
import '@testing-library/jest-dom'
import { useState } from 'react'

import { getProblem, render, toInstance } from '@grove/curriculum'
import { gallerySamples } from '@/app/dev/widgets/samples'
import { WidgetGallery } from '@/components/WidgetGallery'
import { AnswerWidget } from './AnswerWidget'
import { emptyValue } from './response'

function GraphHarness({ instance, record }) {
  const [points, onChange] = useState(() => emptyValue(instance))
  record.points = points
  return <AnswerWidget instance={instance} value={points} onChange={onChange} />
}

test('a touch scroll gesture does not plot, and a completed tap does without disabling panning', () => {
  const instance = toInstance(render(getProblem('m5.g.coordinate-plane/plot-point'), 2505))
  const record = {}
  renderDom(<GraphHarness instance={instance} record={record} />)
  const svg = screen.getByRole('img', { name: /coordinate plane/i })
  svg.getBoundingClientRect = () => ({ left: 0, top: 0, width: 240, height: 240 })

  expect(svg.className.baseVal).not.toContain('touch-none')
  fireEvent.pointerDown(svg, { pointerId: 2, pointerType: 'touch', clientX: 120, clientY: 120 })
  fireEvent.pointerMove(svg, { pointerId: 2, pointerType: 'touch', clientX: 120, clientY: 165 })
  fireEvent.pointerUp(svg, { pointerId: 2, pointerType: 'touch', clientX: 120, clientY: 165 })
  expect(record.points).toEqual([])
  fireEvent.pointerDown(svg, { pointerId: 3, pointerType: 'touch', clientX: 120, clientY: 120 })
  fireEvent.pointerUp(svg, { pointerId: 3, pointerType: 'touch', clientX: 120, clientY: 120 })
  expect(record.points).toHaveLength(1)
})

test('revealing a graph answer in the gallery shows readable coordinates, never object coercion', () => {
  const sample = gallerySamples().find(({ widget }) => widget === 'graph')
  expect(sample).toBeDefined()
  renderDom(<WidgetGallery samples={[sample]} />)
  const card = screen.getByRole('article')
  expect(card.querySelector('[data-dev-only]')).toBeNull()
  fireEvent.click(within(card).getByRole('button', { name: /show the answer/i }))
  const revealed = card.querySelector('[data-dev-only]')
  expect(revealed).not.toBeNull()
  for (const { x, y } of sample.answer.points) expect(revealed).toHaveTextContent(`(${x}, ${y})`)
  expect(revealed).not.toHaveTextContent('[object Object]')
})
