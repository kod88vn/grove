import { describe, expect, it } from '@jest/globals'
import '@testing-library/jest-dom'
import { fireEvent, render, screen } from '@testing-library/react'
import { useState } from 'react'
import { check, getProblem, render as renderProblem, toInstance } from '@grove/curriculum'
import { items } from '../../../../packages/curriculum/src/content/english/items/g05/context-clues.js'
import { AnswerWidget } from './AnswerWidget'
import { emptyValue, toResponse } from './response'

const id = 'e5.l.context-clues/find-the-clue'
const ids = ['e5.l.context-clues/find-the-clue-easy', id, 'e5.l.context-clues/find-the-clue-tricky']

function Harness({ instance, draft }) {
  const [value, setValue] = useState(() => emptyValue(instance))
  draft.current = value
  return <AnswerWidget instance={instance} value={value} onChange={setValue} />
}

describe('P2.13 — generic token selection', () => {
  it('shows a non-button blank in sentence order and names every selectable word across all twenty items', () => {
    const seen = new Set()
    for (const problemId of ids) {
      for (let seed = 1; seed <= 500 && seen.size < items.length; seed++) {
      const instance = toInstance(renderProblem(getProblem(problemId), seed))
      const source = items.find((item) => item.sentence.split(/\s+/).map((part) => part.toLowerCase().replace(/^[^\p{L}\p{N}]+|[^\p{L}\p{N}]+$/gu, '')).filter(Boolean).join(' ') === instance.visual.tokens.map((token) => token.label.toLowerCase().replace(/^[^\p{L}\p{N}]+|[^\p{L}\p{N}]+$/gu, '')).join(' '))
      expect(source).toBeDefined()
      if (seen.has(source.id)) continue
      seen.add(source.id)

      const view = render(<Harness instance={instance} draft={{ current: null }} />)
      const group = screen.getByRole('group', { name: 'Select the clue words' })
      const buttons = Array.from(group.querySelectorAll('button'))
      expect(buttons).toHaveLength(instance.visual.tokens.length)
      const segments = instance.visual.segments
      expect(segments.filter((segment) => segment.kind === 'blank')).toHaveLength(1)
      expect(Array.from(group.children)).toHaveLength(segments.length)
      const labels = new Map(instance.visual.tokens.map((token) => [token.id, token.label]))
      expect(segments.map((segment) => segment.kind === 'word' ? labels.get(segment.id) : segment.kind === 'blank' ? '____' : segment.text).join('')).toBe(source.sentence)
      for (const [index, segment] of segments.entries()) {
        const child = group.children[index]
        if (segment.kind === 'word') {
          expect(child.tagName).toBe('BUTTON')
          expect(child.textContent).toBe(labels.get(segment.id))
        } else if (segment.kind === 'text') {
          expect(child.tagName).not.toBe('BUTTON')
          expect(child.textContent).toBe(segment.text)
        } else {
          expect(child.tagName).not.toBe('BUTTON')
          expect(child.textContent).toContain('____')
        }
      }
      for (const button of buttons) {
        expect(button.textContent.trim()).toMatch(/[\p{L}\p{N}]/u)
        expect(button.getAttribute('aria-label')).toMatch(/^[\p{L}\p{N}]/u)
        expect(button.getAttribute('aria-label')).not.toMatch(/^,/)
      }
      const blank = Array.from(group.children).filter((child) => child.textContent.includes('____'))
      expect(blank).toHaveLength(1)
      expect(blank[0].tagName).not.toBe('BUTTON')
      expect(Array.from(group.querySelectorAll('button')).filter((button) => button.compareDocumentPosition(blank[0]) & Node.DOCUMENT_POSITION_FOLLOWING)).toHaveLength(instance.visual.blankIndex)
      const sourceBlank = source.sentence.split(/\s+/).findIndex((part) => part.includes('____'))
      expect(instance.visual.blankIndex).toBe(source.sentence.split(/\s+/).slice(0, sourceBlank).filter((part) => /[\p{L}\p{N}]/u.test(part)).length)
      view.unmount()
      }
    }
    expect(seen).toEqual(new Set(items.map((item) => item.id)))
  })

  it.each(['in-line', 'end-of-sentence'])('exposes the %s gap as spoken blank while keeping underscores visual', (placement) => {
    const issued = toInstance(renderProblem(getProblem(id), 2505))
    const blankIndex = placement === 'in-line' ? issued.visual.blankIndex : issued.visual.tokens.length
    const segments = placement === 'in-line' ? issued.visual.segments : [...issued.visual.segments.filter((segment) => segment.kind !== 'blank'), { kind: 'blank' }]
    const instance = { ...issued, visual: { ...issued.visual, blankIndex, segments } }
    const view = render(<Harness instance={instance} draft={{ current: null }} />)
    const group = screen.getByRole('group', { name: 'Select the clue words' })
    const blank = group.children[segments.findIndex((segment) => segment.kind === 'blank')]
    expect(blank.tagName).not.toBe('BUTTON')
    expect(blank).not.toHaveAttribute('aria-hidden', 'true')
    expect(blank.textContent).toContain('____')
    const visual = Array.from(blank.children).find((child) => child.textContent === '____')
    expect(visual).toHaveAttribute('aria-hidden', 'true')
    const spoken = blank.querySelector('.sr-only')
    expect(spoken).not.toBeNull()
    expect(spoken.textContent).toBe('blank')
    expect(spoken.firstChild.nodeType).toBe(Node.TEXT_NODE)
    view.unmount()
  })

  it('renders only issued tokens as accessible buttons and starts with no selection', () => {
    const instance = toInstance(renderProblem(getProblem(id), 2505))
    const draft = { current: null }
    const view = render(<Harness instance={instance} draft={draft} />)
    const buttons = screen.getAllByRole('button')
    expect(buttons).toHaveLength(instance.visual.tokens.length)
    for (const [index, token] of instance.visual.tokens.entries()) {
      expect(buttons[index]).toHaveTextContent(token.label)
      expect(buttons[index].className).toMatch(/min-h-\[56px\]/)
      expect(buttons[index].className).toMatch(/min-w-\[56px\]/)
      expect(buttons[index].getAttribute('aria-label')).toMatch(/not selected/i)
    }
    expect(view.container.querySelector('input')).toBeNull()
    expect(toResponse(instance, draft.current)).toEqual({ ids: [] })
  })

  it('tapping any tokens toggles them, and selected state is in each accessible name', () => {
    const full = renderProblem(getProblem(id), 42)
    const instance = toInstance(full)
    const draft = { current: null }
    const view = render(<Harness instance={instance} draft={draft} />)
    const buttons = screen.getAllByRole('button')
    const selected = full.answer.ids.map((tokenId) => instance.visual.tokens.findIndex((token) => token.id === tokenId))
    for (const index of selected) fireEvent.click(buttons[index])
    expect(new Set(toResponse(instance, draft.current).ids)).toEqual(new Set(full.answer.ids))
    expect(check('tap-select', full.answer, toResponse(instance, draft.current))).toEqual({ correct: true, reason: null })
    for (const index of selected) expect(buttons[index].getAttribute('aria-label')).toMatch(/selected/i)
    fireEvent.click(buttons[selected[0]])
    expect(buttons[selected[0]].getAttribute('aria-label')).toMatch(/not selected/i)
    expect(check('tap-select', full.answer, toResponse(instance, draft.current))).toEqual({ correct: false, reason: 'wrong' })
    expect(view.container.textContent).not.toContain(full.explanation)
  })

  it('a focused button remains a native keyboard-activatable button', () => {
    const instance = toInstance(renderProblem(getProblem(id), 7))
    const draft = { current: null }
    render(<Harness instance={instance} draft={draft} />)
    const button = screen.getAllByRole('button')[0]
    button.focus()
    expect(button).toHaveFocus()
    fireEvent.click(button)
    expect(toResponse(instance, draft.current).ids).toEqual([instance.visual.tokens[0].id])
  })
})
