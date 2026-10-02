import { describe, expect, jest, test } from '@jest/globals'
import '@testing-library/jest-dom'
import { render, screen } from '@testing-library/react'

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
})