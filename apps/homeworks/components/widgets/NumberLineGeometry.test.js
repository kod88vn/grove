import { describe, expect, it } from '@jest/globals'
import '@testing-library/jest-dom'
import { fireEvent, render, screen } from '@testing-library/react'
import { useState } from 'react'
import { getProblem, render as draw, toInstance } from '@grove/curriculum'
import { AnswerWidget } from './AnswerWidget'

const ID = 'm5.nf.equiv-fractions/place-on-number-line'
const CASES = [[4, 7], [6, 9], [8, 1], [10, 2], [12, 4]]

function Harness({ instance }) {
  const [value, setValue] = useState(null)
  return <AnswerWidget instance={instance} value={value} onChange={setValue} disabled={false} />
}

function exactLeft(element, percent) {
  expect(element).not.toBeNull()
  expect(element.style.left).toBe(`${percent}%`)
}

function tickPosition(button) {
  return button.matches('[data-number-line-tick]') ? button : button.querySelector('[data-number-line-tick]')
}

describe('number-line geometry', () => {
  it.each(CASES)('places every tick and both endpoint labels on one visible axis for N=%i', (N, seed) => {
    const instance = toInstance(draw(getProblem(ID), seed))
    expect(instance.visual.segments).toBe(N)
    const { container } = render(<Harness instance={instance} />)
    expect(container.querySelectorAll('[data-number-line-axis]')).toHaveLength(1)
    const endpoints = container.querySelectorAll('[data-number-line-endpoint]')
    expect(endpoints).toHaveLength(2)
    exactLeft(endpoints[0], 0)
    exactLeft(endpoints[1], 100)
    expect(container.querySelectorAll('[data-number-line-selected]')).toHaveLength(0)

    for (let k = 0; k <= N; k++) {
      const button = screen.getByRole('button', { name: `Mark ${k} of ${N}` })
      exactLeft(tickPosition(button), k * 100 / N)
      expect(button).toHaveAttribute('aria-pressed', 'false')
    }
    for (const k of [0, Math.floor(N / 2), N]) {
      fireEvent.click(screen.getByRole('button', { name: `Mark ${k} of ${N}` }))
      const markers = container.querySelectorAll('[data-number-line-selected]')
      expect(markers).toHaveLength(1)
      exactLeft(markers[0], k * 100 / N)
    }
  })
})
