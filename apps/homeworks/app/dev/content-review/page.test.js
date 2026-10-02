import { describe, expect, jest, test } from '@jest/globals'
import '@testing-library/jest-dom'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'

class NotFoundSentinel extends Error {}
const mockNotFound = jest.fn(() => { throw new NotFoundSentinel('NEXT_NOT_FOUND') })
jest.mock('next/navigation', () => ({ notFound: (...args) => mockNotFound(...args) }))

async function withEnvironment(value, fn) {
  const before = process.env.NODE_ENV
  process.env.NODE_ENV = value
  try { return await fn() } finally { process.env.NODE_ENV = before }
}

describe('English content review is never a child-facing surface', () => {
  test('production rejects the review page before rendering any draft or answer', async () => {
    const { default: Page } = await import('./page')
    await expect(withEnvironment('production', () => Page())).rejects.toThrow(NotFoundSentinel)
    expect(mockNotFound).toHaveBeenCalled()
    expect(screen.queryByText(/approve draft/i)).not.toBeInTheDocument()
  })

  test('development shows a draft and requires an explicit reviewer decision', async () => {
    const { default: Page } = await import('./page')
    await withEnvironment('development', async () => render(await Page({
      drafts: [{ id: 'river-crossing', sentence: 'The bridge was sturdy.', answer: 'sturdy', reviewedBy: 'agent-draft:pending-parent-review' }],
    })))
    expect(screen.getByText(/bridge was sturdy/i)).toBeInTheDocument()
    expect(screen.getByText(/sturdy/i)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /approve/i })).toBeInTheDocument()
    expect(screen.getByRole('textbox', { name: /reviewer/i })).toBeInTheDocument()
    expect(screen.getByText(/pending|unreviewed/i)).toBeInTheDocument()
  })

  test('a renamed candidate is reviewed by its actual filename', async () => {
    const originalFetch = global.fetch
    const requests = []
    global.fetch = async (url, options) => {
      requests.push({ url, body: JSON.parse(options.body) })
      return { ok: true, json: async () => ({ reviewer: 'Parent' }) }
    }
    try {
      const { default: Page } = await import('./page')
      await withEnvironment('development', async () => render(await Page({ drafts: [{
        filename: 'renamed-for-review.json',
        draft: { id: 'river-crossing', skillId: 'e5.l.context-clues', grade: 5,
          sentence: 'The bridge was ____.', answer: 'sturdy', choices: ['sturdy', 'fragile'],
          clue: 'Strong enough', hints: ['A synonym for strong'], explanation: 'It can carry children.',
          reviewedBy: 'agent-draft:pending-parent-review' },
      }] })))
      fireEvent.change(screen.getByRole('textbox', { name: /reviewer/i }), { target: { value: 'Parent' } })
      fireEvent.click(screen.getByRole('button', { name: /approve/i }))
      await waitFor(() => expect(requests).toHaveLength(1))
      expect(requests[0].body.filename).toBe('renamed-for-review.json')
      expect(requests[0].body.approved).toBe(true)
    } finally {
      global.fetch = originalFetch
    }
  })

  test('a reviewer sees every skill-specific candidate field before approving', async () => {
    const { default: Page } = await import('./page')
    await withEnvironment('development', async () => render(await Page({ drafts: [{
      filename: 'river.json',
      draft: { id: 'river-crossing', skillId: 'e5.l.context-clues', grade: 5,
        sentence: 'The bridge was ____.', answer: 'sturdy', choices: ['sturdy', 'fragile'],
        clue: 'Strong enough', hints: ['A synonym for strong'], explanation: 'It can carry children.',
        reviewedBy: 'agent-draft:pending-parent-review' },
    }] })))
    for (const value of ['fragile', 'Strong enough', 'A synonym for strong', 'It can carry children.']) {
      expect(screen.getByText(value)).toBeInTheDocument()
    }
  })

  test('the candidate skill identity is visible before a human approves it', async () => {
    const { default: Page } = await import('./page')
    await withEnvironment('development', async () => render(await Page({ drafts: [{
      filename: 'river.json',
      draft: { id: 'river-crossing', skillId: 'e5.l.context-clues', grade: 5,
        sentence: 'The bridge was ____.', answer: 'sturdy', source: 'original',
        reviewedBy: 'agent-draft:pending-parent-review' },
    }] })))
    expect(screen.getByText('e5.l.context-clues')).toBeInTheDocument()
  })
})