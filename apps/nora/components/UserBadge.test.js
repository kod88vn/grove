import { act, render, screen, waitFor } from '@testing-library/react'
import { UserBadge } from '../components/UserBadge.js'

let mockMePromise = Promise.resolve(null)

jest.mock('@/lib/api/me', () => ({
  get mePromise() {
    return mockMePromise
  },
}))

async function renderUserBadge(user) {
  mockMePromise = Promise.resolve(user)
  let result
  await act(async () => {
    result = render(<UserBadge />)
    await mockMePromise
  })
  return result
}

describe('UserBadge', () => {
  beforeEach(() => {
    mockMePromise = Promise.resolve(null)
  })

  it('renders user name', async () => {
    await renderUserBadge({ name: 'John Doe', login: 'john@example.com' })
    await waitFor(() => {
      expect(screen.getByText('John Doe')).toBeInTheDocument()
    })
  })

  it('renders login if no name', async () => {
    await renderUserBadge({ login: 'john@example.com' })
    await waitFor(() => {
      expect(screen.getByText('john@example.com')).toBeInTheDocument()
    })
  })

  it('renders nothing if no user data', async () => {
    const { container } = await renderUserBadge({})
    await waitFor(() => {
      expect(container.firstChild).toBeNull()
    })
  })
})