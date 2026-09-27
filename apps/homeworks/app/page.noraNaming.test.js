/**
 * Grove's assistant is called Nora. User-facing copy must say "Nora", never
 * "AI" (the homeworks header said "AI-powered learning for Grade 5").
 */
import { describe, it, expect, jest } from '@jest/globals'
import '@testing-library/jest-dom'
import { render, screen } from '@testing-library/react'

jest.mock('next/navigation', () => ({
  useSearchParams: () => new globalThis.URLSearchParams(''),
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

describe('HomeworksPage header copy', () => {
  it('credits Nora in the subtitle and never says "AI"', async () => {
    render(<HomeworksPage />)
    await screen.findByTestId('english-exercise')

    expect(screen.getByText('Nora-powered learning for Grade 5')).toBeInTheDocument()
    expect(document.body.textContent).toMatch(/Daily Homeworks/)
    expect(document.body.textContent).not.toMatch(/\bAI\b/)
  })
})
