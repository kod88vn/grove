import { act, render, waitFor } from '@testing-library/react'
import { GreetingTrigger } from '../components/GreetingTrigger.js'

let mockMePromise = Promise.resolve(null)

jest.mock('@/lib/api/me', () => ({
  get mePromise() {
    return mockMePromise
  },
}))

describe('GreetingTrigger', () => {
  beforeEach(() => {
    mockMePromise = Promise.resolve(null)
    process.env.NODE_ENV = 'test'
  })

  afterEach(() => {
    process.env.NODE_ENV = 'test'
  })

  it('calls onGreet with first name', async () => {
    process.env.NODE_ENV = 'production'
    mockMePromise = Promise.resolve({ name: 'John Doe', login: 'john@example.com' })
    const mockOnGreet = jest.fn()
    await act(async () => {
      render(<GreetingTrigger onGreet={mockOnGreet} />)
      await mockMePromise
    })
    await waitFor(() => {
      expect(mockOnGreet).toHaveBeenCalledWith('John')
    })
  })

  it('calls onGreet with login prefix in dev mode', async () => {
    process.env.NODE_ENV = 'development'
    mockMePromise = Promise.resolve({ login: 'john@example.com' })
    const mockOnGreet = jest.fn()
    await act(async () => {
      render(<GreetingTrigger onGreet={mockOnGreet} />)
      await mockMePromise
    })
    await waitFor(() => {
      expect(mockOnGreet).toHaveBeenCalledWith('Master')
    })
  })
})