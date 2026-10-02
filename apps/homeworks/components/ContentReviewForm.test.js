import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, expect, jest, test } from '@jest/globals'
import '@testing-library/jest-dom'

import { ContentReviewForm } from './ContentReviewForm'

const originalFetch = global.fetch

afterEach(() => {
  if (originalFetch === undefined) delete global.fetch
  else global.fetch = originalFetch
  jest.restoreAllMocks()
})

test('review decisions require a named reviewer and surface server failures', async () => {
  global.fetch = jest.fn().mockResolvedValue({
    ok: false,
    json: async () => ({ error: 'Draft is malformed' }),
  })
  const fetchMock = global.fetch
  render(<ContentReviewForm drafts={[{ id: 'river-crossing', skillId: 'e5.l.context-clues', grade: 5, sentence: 'The bridge was sturdy.', answer: 'sturdy', reviewedBy: 'agent-draft:pending-parent-review' }]} />)
  const approve = screen.getByRole('button', { name: /approve/i })
  expect(approve).toBeDisabled()
  fireEvent.change(screen.getByRole('textbox', { name: /reviewer/i }), { target: { value: 'Parent One' } })
  fireEvent.click(approve)
  await waitFor(() => expect(screen.getByRole('status')).toHaveTextContent(/draft is malformed/i))
  expect(fetchMock).toHaveBeenCalledWith('/homeworks/api/content-review', expect.objectContaining({ method: 'POST' }))
})