import { describe, expect, it, jest } from '@jest/globals'

import HomePage from './page'

const mockRedirect = jest.requireMock('next/navigation').redirect

describe('HomePage', () => {
  it('renders chat route content directly without redirect loop', () => {
    HomePage()

    expect(mockRedirect).not.toHaveBeenCalled()
  })
})
