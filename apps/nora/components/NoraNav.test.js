import { describe, it, expect, jest, beforeEach } from '@jest/globals'
import { render, screen, waitFor, act } from '@testing-library/react'
import { NoraNav } from './NoraNav'

// usePathname is globally mocked in jest.setup.js
const mockUsePathname = jest.requireMock('next/navigation').usePathname

describe('NoraNav', () => {
  beforeEach(() => {
    mockUsePathname.mockReturnValue('/')
    global.fetch = jest.fn().mockImplementation(() =>
      Promise.resolve({
        json: () => Promise.resolve({ name: null, pic: null, login: null }),
      })
    )
  })

  it('renders Grove branding', async () => {
    await act(async () => {
      render(<NoraNav />)
    })
    expect(screen.getByRole('link', { name: 'Grove' })).toHaveAttribute('href', '/')
  })

  it('renders all nav links', async () => {
    await act(async () => {
      render(<NoraNav />)
    })
    expect(screen.getByRole('link', { name: 'Grove' })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Nora' })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Games' })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Homeworks' })).toBeInTheDocument()
  })

  it('wires nav links to the expected zone paths', async () => {
    await act(async () => {
      render(<NoraNav />)
    })
    expect(screen.getByRole('link', { name: 'Grove' })).toHaveAttribute('href', '/')
    expect(screen.getByRole('link', { name: 'Nora' })).toHaveAttribute('href', '/chat')
    expect(screen.getByRole('link', { name: 'Games' })).toHaveAttribute('href', '/games')
    expect(screen.getByRole('link', { name: 'Homeworks' })).toHaveAttribute('href', '/homeworks')
  })

  it('gives Nora the active style on /chat route', async () => {
    mockUsePathname.mockReturnValue('/chat')
    await act(async () => {
      render(<NoraNav />)
    })
    expect(screen.getByRole('link', { name: 'Nora' }).className).toContain('bg-indigo-50')
  })

  it('shows user name when API returns a name', async () => {
    global.fetch.mockImplementation(() =>
      Promise.resolve({
        json: () => Promise.resolve({ name: 'Alice Grove', pic: null, login: 'alice' }),
      })
    )
    await act(async () => {
      render(<NoraNav />)
    })
    await waitFor(() => {
      expect(screen.getByText('Alice Grove')).toBeInTheDocument()
    })
  })

  it('shows initials avatar when user has no pic', async () => {
    global.fetch.mockImplementation(() =>
      Promise.resolve({
        json: () => Promise.resolve({ name: 'Alice Grove', pic: null, login: 'alice' }),
      })
    )
    await act(async () => {
      render(<NoraNav />)
    })
    await waitFor(() => {
      expect(screen.getByText('AG')).toBeInTheDocument()
    })
  })

  it('shows a single initial when user has a single-word name', async () => {
    global.fetch.mockImplementation(() =>
      Promise.resolve({
        json: () => Promise.resolve({ name: 'Nora', pic: null, login: 'nora' }),
      })
    )
    await act(async () => {
      render(<NoraNav />)
    })
    await waitFor(() => {
      expect(screen.getByText('N')).toBeInTheDocument()
    })
  })

  it('shows avatar img when user has a pic URL', async () => {
    global.fetch.mockImplementation(() =>
      Promise.resolve({
        json: () =>
          Promise.resolve({ name: 'Alice Grove', pic: 'https://cdn.example.com/alice.jpg', login: 'alice' }),
      })
    )
    await act(async () => {
      render(<NoraNav />)
    })
    await waitFor(() => {
      const img = screen.getByRole('img', { name: 'Alice Grove' })
      expect(img).toHaveAttribute('src', 'https://cdn.example.com/alice.jpg')
    })
  })

  it('renders without crashing when fetch fails', async () => {
    global.fetch.mockImplementation(() => Promise.reject(new Error('Network error')))
    await act(async () => {
      render(<NoraNav />)
    })
    expect(screen.getByText('Grove')).toBeInTheDocument()
  })

  it('hides user section when API returns null name', async () => {
    await act(async () => {
      render(<NoraNav />)
    })
    await waitFor(() => {
      expect(screen.queryByRole('img')).toBeNull()
    })
  })
})
