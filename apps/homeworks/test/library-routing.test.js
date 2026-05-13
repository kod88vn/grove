import { describe, it, expect, afterEach, jest } from '@jest/globals'
import '@testing-library/jest-dom'
import { render, screen } from '@testing-library/react'

jest.mock('../components/EnglishExercise', () => ({
  EnglishExercise: () => <div>EnglishExercise</div>,
}))

jest.mock('../components/MathExercise', () => ({
  MathExercise: () => <div>MathExercise</div>,
}))

jest.mock('../components/ProgressReview', () => ({
  ProgressReview: () => <div>ProgressReview</div>,
}))

import HomeworksPage from '../app/page'

describe('skills library routing', () => {
  const originalFlag = process.env.NEXT_PUBLIC_ENABLE_SKILLS_LIBRARY_NAV

  afterEach(() => {
    if (originalFlag === undefined) {
      delete process.env.NEXT_PUBLIC_ENABLE_SKILLS_LIBRARY_NAV
    } else {
      process.env.NEXT_PUBLIC_ENABLE_SKILLS_LIBRARY_NAV = originalFlag
    }
  })

  it('does not render navigation link by default', () => {
    delete process.env.NEXT_PUBLIC_ENABLE_SKILLS_LIBRARY_NAV

    render(<HomeworksPage />)

    const libraryLink = screen.queryByRole('link', { name: /skills library/i })
    expect(libraryLink).not.toBeInTheDocument()
  })

  it('renders navigation link when feature flag is enabled', () => {
    process.env.NEXT_PUBLIC_ENABLE_SKILLS_LIBRARY_NAV = 'true'

    render(<HomeworksPage />)

    const libraryLink = screen.getByRole('link', { name: /skills library/i })
    expect(libraryLink).toBeInTheDocument()
    expect(libraryLink).toHaveAttribute('href', '/library')
  })
})
