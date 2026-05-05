import { describe, it, expect, jest, beforeEach } from '@jest/globals'
import { render, screen, waitFor } from '@testing-library/react'
import { NoraNav } from './NoraNav'

// usePathname is globally mocked in jest.setup.js
const mockUsePathname = jest.requireMock('next/navigation').usePathname

describe('NoraNav', () => {
  beforeEach(() => {
    mockUsePathname.mockReturnValue('/')
    global.fetch = jest.fn().mockResolvedValue({
      json: () => Promise.resolve({ name: null, pic: null, login: null }),
    })
  })

  it('renders Grove branding', () => {
    render(<NoraNav />)
    expect(screen.getByText('Grove')).toBeInTheDocument()
  })

  it('renders all three nav links', () => {
    render(<NoraNav />)
    expect(screen.getByRole('link', { name: 'Home' })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Chat' })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Modules' })).toBeInTheDocument()
  })

  it('gives Home the active style on / route', () => {
    render(<NoraNav />)
    expect(screen.getByRole('link', { name: 'Home' }).className).toContain('bg-slate-100')
    expect(screen.getByRole('link', { name: 'Chat' }).className).not.toContain('bg-slate-100')
  })

  it('does not mark Home active on /chat', () => {
    mockUsePathname.mockReturnValue('/chat')
    render(<NoraNav />)
    expect(screen.getByRole('link', { name: 'Home' }).className).not.toContain('bg-slate-100')
  })

  it('gives Chat the active style on /chat route', () => {
    mockUsePathname.mockReturnValue('/chat')
    render(<NoraNav />)
    expect(screen.getByRole('link', { name: 'Chat' }).className).toContain('bg-slate-100')
    expect(screen.getByRole('link', { name: 'Home' }).className).not.toContain('bg-slate-100')
  })

  it('gives Modules the active style on /modules route', () => {
    mockUsePathname.mockReturnValue('/modules')
    render(<NoraNav />)
    expect(screen.getByRole('link', { name: 'Modules' }).className).toContain('bg-slate-100')
  })

  it('gives Modules the active style on /modules/[slug] sub-routes', () => {
    mockUsePathname.mockReturnValue('/modules/shopping-list')
    render(<NoraNav />)
    expect(screen.getByRole('link', { name: 'Modules' }).className).toContain('bg-slate-100')
  })

  it('shows user name when API returns a name', async () => {
    global.fetch.mockResolvedValue({
      json: () => Promise.resolve({ name: 'Alice Grove', pic: null, login: 'alice' }),
    })
    render(<NoraNav />)
    await waitFor(() => {
      expect(screen.getByText('Alice Grove')).toBeInTheDocument()
    })
  })

  it('shows initials avatar when user has no pic', async () => {
    global.fetch.mockResolvedValue({
      json: () => Promise.resolve({ name: 'Alice Grove', pic: null, login: 'alice' }),
    })
    render(<NoraNav />)
    await waitFor(() => {
      expect(screen.getByText('AG')).toBeInTheDocument()
    })
  })

  it('shows a single initial when user has a single-word name', async () => {
    global.fetch.mockResolvedValue({
      json: () => Promise.resolve({ name: 'Nora', pic: null, login: 'nora' }),
    })
    render(<NoraNav />)
    await waitFor(() => {
      expect(screen.getByText('N')).toBeInTheDocument()
    })
  })

  it('shows avatar img when user has a pic URL', async () => {
    global.fetch.mockResolvedValue({
      json: () =>
        Promise.resolve({ name: 'Alice Grove', pic: 'https://cdn.example.com/alice.jpg', login: 'alice' }),
    })
    render(<NoraNav />)
    await waitFor(() => {
      const img = screen.getByRole('img', { name: 'Alice Grove' })
      expect(img).toHaveAttribute('src', 'https://cdn.example.com/alice.jpg')
    })
  })

  it('renders without crashing when fetch fails', () => {
    global.fetch.mockRejectedValue(new Error('Network error'))
    expect(() => render(<NoraNav />)).not.toThrow()
    expect(screen.getByText('Grove')).toBeInTheDocument()
  })

  it('hides user section when API returns null name', async () => {
    render(<NoraNav />) // default mock returns null name
    await waitFor(() => {
      expect(screen.queryByRole('img')).toBeNull()
    })
  })
})
