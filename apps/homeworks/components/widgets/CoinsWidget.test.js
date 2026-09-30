import { afterEach, describe, expect, it, jest } from '@jest/globals'
import '@testing-library/jest-dom'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { useState } from 'react'

import { check, getProblem, render as renderProblem, toInstance } from '@grove/curriculum'

import { SolveItem } from '../SolveItem'
import { AnswerWidget } from './AnswerWidget'
import { emptyValue, toResponse } from './response'

const ID = 'm5.md.time-money/coins-value'
const instanceAt = (seed) => toInstance(renderProblem(getProblem(ID), seed))

function Harness({ instance, onDraft }) {
  const [value, setValue] = useState(() => emptyValue(instance))
  onDraft.current = value
  return <AnswerWidget instance={instance} value={value} onChange={setValue} />
}

function mount(seed = 2505) {
  const onDraft = { current: null }
  const instance = instanceAt(seed)
  const view = render(<Harness instance={instance} onDraft={onDraft} />)
  return { ...view, instance, onDraft }
}

describe('P2.11 — coins the child can count without typing', () => {
  afterEach(() => { delete global.fetch })

  it('starts empty and shows coin controls with names and 56px targets', () => {
    const { instance, onDraft, container } = mount()
    expect(instance).not.toHaveProperty('answer')
    expect(toResponse(instance, onDraft.current)).toEqual({ counts: {} })
    for (const coin of instance.visual.denominations) {
      const name = coin === 25 ? /quarter.*25 cents/i : coin === 10 ? /dime.*10 cents/i : coin === 5 ? /nickel.*5 cents/i : /penny.*1 cent/i
      const button = screen.getByRole('button', { name })
      expect(button.className).toMatch(/min-h-\[56px\]/)
      expect(button.className).toMatch(/min-w-\[56px\]/)
    }
    expect(container.querySelector('input')).toBeNull()
    expect(container.textContent).not.toMatch(/total|you made/i)
  })

  it('lets a tap remove a selected coin and changes the submitted total', () => {
    const { instance, onDraft } = mount()
    const coin = instance.visual.denominations.includes(25) ? 25 : instance.visual.denominations[0]
    const name = coin === 25 ? /quarter.*25 cents/i : coin === 10 ? /dime.*10 cents/i : coin === 5 ? /nickel.*5 cents/i : /penny.*1 cent/i
    fireEvent.click(screen.getByRole('button', { name }))
    fireEvent.click(screen.getByRole('button', { name }))
    const before = toResponse(instance, onDraft.current)
    expect(before.counts[coin]).toBe(2)
    fireEvent.click(screen.getByRole('button', { name: new RegExp(`remove.*${coin} cents?`, 'i') }))
    const after = toResponse(instance, onDraft.current)
    expect(after.counts[coin]).toBe(1)
    expect(check('coins', { total: 2 * coin, denominations: instance.visual.denominations }, before).correct).toBe(true)
    expect(check('coins', { total: 2 * coin, denominations: instance.visual.denominations }, after).correct).toBe(false)
  })

  it('does not count aloud before Check; after Check feedback says what the child made', async () => {
    const instance = instanceAt(2505)
    const coin = instance.visual.denominations[0]
    global.fetch = jest.fn(async (url, options) => {
      expect(url).toBe('/homeworks/api/attempts')
      expect(JSON.parse(options.body).response.counts[coin]).toBe(1)
      return { ok: true, json: async () => ({ correct: false, stars: 0, feedback: 'Keep going—you can try again!', skillState: null }) }
    })
    const view = render(<SolveItem sessionId="coins-session" instance={instance} />)
    const name = coin === 25 ? /quarter.*25 cents/i : coin === 10 ? /dime.*10 cents/i : coin === 5 ? /nickel.*5 cents/i : /penny.*1 cent/i
    fireEvent.click(screen.getByRole('button', { name }))
    expect(view.container.textContent).not.toMatch(/you made|total/i)
    fireEvent.click(screen.getByRole('button', { name: /Check/ }))
    await waitFor(() => expect(screen.getByTestId('verdict')).toHaveTextContent(new RegExp(`you made ${coin}¢`, 'i')))
  })
})
