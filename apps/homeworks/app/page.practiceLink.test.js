/**
 * Bug: "Practice This Section" on /homeworks/library links to
 * `/?section=math&practice=1&skillCategory=<key>` (components/SkillsLibrary.js), but the
 * homeworks home page never reads the query string. The child lands on the English tab
 * and MathExercise never receives `skillCategory` / `autoStart`, both of which it
 * already supports, so section practice is unreachable.
 */
import { describe, it, expect, beforeEach, afterEach, jest } from '@jest/globals'
import '@testing-library/jest-dom'
import { render, screen, fireEvent } from '@testing-library/react'

function mockLocation() {
  return globalThis.window.location
}

jest.mock('next/navigation', () => ({
  useSearchParams: () => new globalThis.URLSearchParams(mockLocation().search),
  usePathname: () => mockLocation().pathname,
  useRouter: () => ({ push: () => {}, replace: () => {}, prefetch: () => {} }),
}))

jest.mock('../components/EnglishExercise.js', () => ({
  EnglishExercise: () => <div data-testid="english-exercise">EnglishExercise</div>,
}))

jest.mock('../components/MathExercise.js', () => ({
  MathExercise: ({ skillCategory, autoStart }) => (
    <div
      data-testid="math-exercise"
      data-skill-category={skillCategory ?? ''}
      data-auto-start={String(Boolean(autoStart))}
    >
      MathExercise
    </div>
  ),
}))

import HomeworksPage from './page'

function visit(search) {
  window.history.replaceState({}, '', `/${search}`)
}

describe('HomeworksPage deep links from the Skills Library', () => {
  beforeEach(() => {
    visit('')
  })

  afterEach(() => {
    visit('')
  })

  it('opens Math in section practice mode for the linked skill category', async () => {
    visit('?section=math&practice=1&skillCategory=multiplication')

    render(<HomeworksPage />)

    const math = await screen.findByTestId('math-exercise')
    expect(math).toHaveAttribute('data-skill-category', 'multiplication')
    expect(math).toHaveAttribute('data-auto-start', 'true')
    expect(screen.getByText('🔢 Math - Step-by-Step Problems')).toBeInTheDocument()
    expect(screen.queryByTestId('english-exercise')).not.toBeInTheDocument()
  })

  it('opens the Math tab without auto-starting when only section=math is given', async () => {
    visit('?section=math')

    render(<HomeworksPage />)

    const math = await screen.findByTestId('math-exercise')
    expect(math).toHaveAttribute('data-skill-category', '')
    expect(math).toHaveAttribute('data-auto-start', 'false')
  })

  it('still opens English by default with no query string', async () => {
    render(<HomeworksPage />)

    expect(await screen.findByTestId('english-exercise')).toBeInTheDocument()
    expect(screen.queryByTestId('math-exercise')).not.toBeInTheDocument()
  })

  it('lets the child switch tabs after arriving from a practice link', async () => {
    visit('?section=math&practice=1&skillCategory=multiplication')

    render(<HomeworksPage />)
    await screen.findByTestId('math-exercise')

    fireEvent.click(screen.getByText('📚 English'))

    expect(await screen.findByTestId('english-exercise')).toBeInTheDocument()
    expect(screen.queryByTestId('math-exercise')).not.toBeInTheDocument()
  })
})
