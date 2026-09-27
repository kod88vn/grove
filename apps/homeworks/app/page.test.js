import { describe, it, expect, afterEach, jest } from '@jest/globals'
import '@testing-library/jest-dom'
import { render, screen } from '@testing-library/react'

jest.mock('../components/EnglishExercise.js', () => ({
  EnglishExercise: () => <div>EnglishExercise</div>,
}))

jest.mock('../components/MathExercise.js', () => ({
  MathExercise: () => <div>MathExercise</div>,
}))

import HomeworksPage from './page'

describe('HomeworksPage', () => {
  afterEach(() => {
    jest.clearAllMocks()
  })

  it('renders the page title', () => {
    render(<HomeworksPage />)

    expect(screen.getByText('Daily Homeworks')).toBeInTheDocument()
  })

  it('renders English and Math tabs', () => {
    render(<HomeworksPage />)

    expect(screen.getByText('📚 English')).toBeInTheDocument()
    expect(screen.getByText('🔢 Math')).toBeInTheDocument()
  })

  it('renders the Review Submissions link', () => {
    render(<HomeworksPage />)

    const reviewLink = screen.getByRole('link', { name: /review submissions/i })
    expect(reviewLink).toBeInTheDocument()
  })

  it('renders English content by default', () => {
    render(<HomeworksPage />)

    expect(screen.getByText('📚 English - Reading & Comprehension')).toBeInTheDocument()
    expect(screen.getByText(/Read a short passage/i)).toBeInTheDocument()
  })

  it('renders Math tips section', () => {
    render(<HomeworksPage />)

    expect(screen.getByText('💡 Math Tips')).toBeInTheDocument()
  })
})