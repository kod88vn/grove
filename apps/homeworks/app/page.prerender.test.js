/**
 * Regression (PR #50 review): reading the query string needs `useSearchParams` inside a
 * <Suspense> boundary. During static prerender Next.js bails that hook out to client
 * rendering, so the prerendered HTML contains only the Suspense fallback. With
 * `fallback={null}` the whole page (heading, tabs, Review link) was missing from the
 * prerendered HTML and appeared only after hydration.
 *
 * The fallback must render the default view: the page shell with the English section.
 * `useSearchParams` is mocked to suspend forever, which is what the prerender sees.
 */
import { describe, it, expect, jest } from '@jest/globals'
import '@testing-library/jest-dom'
import { render, screen } from '@testing-library/react'

function mockNeverResolves() {
  return new Promise(() => {})
}

jest.mock('next/navigation', () => ({
  useSearchParams: () => {
    throw mockNeverResolves()
  },
  usePathname: () => '/',
  useRouter: () => ({ push: () => {}, replace: () => {}, prefetch: () => {} }),
}))

jest.mock('../components/EnglishExercise.js', () => ({
  EnglishExercise: () => <div data-testid="english-exercise">EnglishExercise</div>,
}))

jest.mock('../components/MathExercise.js', () => ({
  MathExercise: () => <div data-testid="math-exercise">MathExercise</div>,
}))

import HomeworksPage from './page'

describe('HomeworksPage before search params resolve (static prerender)', () => {
  it('renders the page heading and section tabs instead of a blank page', () => {
    render(<HomeworksPage />)

    expect(screen.getByRole('heading', { level: 1, name: 'Daily Homeworks' })).toBeInTheDocument()
    expect(screen.getByText('📚 English')).toBeInTheDocument()
    expect(screen.getByText('🔢 Math')).toBeInTheDocument()
  })

  it('shows the default English section, matching the no-query-string view', async () => {
    render(<HomeworksPage />)

    expect(screen.getByText('📚 English - Reading & Comprehension')).toBeInTheDocument()
    expect(await screen.findByTestId('english-exercise')).toBeInTheDocument()
    expect(screen.queryByTestId('math-exercise')).not.toBeInTheDocument()
  })
})
