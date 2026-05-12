import { describe, it, expect, beforeEach, afterEach, jest } from '@jest/globals'
import '@testing-library/jest-dom'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'

import { EnglishExercise } from '../components/EnglishExercise'
import { MathExercise } from '../components/MathExercise'

describe('exercise resubmission flow', () => {
  beforeEach(() => {
    global.fetch = jest.fn()
  })

  afterEach(() => {
    jest.resetAllMocks()
  })

  it('allows revising and resubmitting english answers', async () => {
    global.fetch
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          exercise: {
            passage: 'A short passage.',
            questions: [
              { id: 1, type: 'short-answer', question: 'What happened?' },
            ],
          },
        }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          gradeResult: { answers: [{ id: 1, score: 1, feedback: 'Good' }] },
          score: 1,
          maxScore: 1,
          percentage: 100,
          feedback: 'Nice work!',
        }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          gradeResult: { answers: [{ id: 1, score: 1, feedback: 'Good again' }] },
          score: 1,
          maxScore: 1,
          percentage: 100,
          feedback: 'Great revision!',
        }),
      })

    render(<EnglishExercise />)

    fireEvent.click(screen.getByRole('button', { name: 'Start Reading Exercise' }))

    await screen.findByText('Comprehension Questions')

    const answerInput = screen.getByPlaceholderText('Type your answer here...')
    fireEvent.change(answerInput, { target: { value: 'My first answer' } })

    fireEvent.click(screen.getByRole('button', { name: 'Submit Answers' }))

    await screen.findByText('Exercise Graded!')

    fireEvent.click(screen.getByRole('button', { name: 'Revise and Resubmit' }))

    await screen.findByRole('button', { name: 'Submit Answers' })
    expect(screen.getByDisplayValue('My first answer')).toBeInTheDocument()

    fireEvent.change(screen.getByDisplayValue('My first answer'), {
      target: { value: 'Improved answer' },
    })

    fireEvent.click(screen.getByRole('button', { name: 'Submit Answers' }))

    await screen.findByText('Exercise Graded!')

    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledTimes(3)
    })
  })

  it('allows revising and resubmitting math work', async () => {
    global.fetch
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          exercise: {
            problems: [
              { id: 1, problem: '6 + 4', operations: ['add 6 and 4'] },
            ],
          },
        }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          gradeResult: {
            totalCorrect: 0,
            totalProblems: 1,
            comment: 'Check your arithmetic',
            problems: [
              { id: 1, correct: false, workShown: true, feedback: 'Try again' },
            ],
          },
          score: 0,
          maxScore: 1,
          percentage: 0,
          feedback: 'Please revise',
        }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          gradeResult: {
            totalCorrect: 1,
            totalProblems: 1,
            comment: 'Great correction',
            problems: [
              { id: 1, correct: true, workShown: true, feedback: 'Well done' },
            ],
          },
          score: 1,
          maxScore: 1,
          percentage: 100,
          feedback: 'Great correction',
        }),
      })

    render(<MathExercise />)

    fireEvent.click(screen.getByRole('button', { name: 'Start Math Problems' }))

    await screen.findByText('Problem 1')

    fireEvent.change(screen.getByPlaceholderText('Write down your steps here...'), {
      target: { value: '6 + 4 = 10' },
    })

    fireEvent.change(screen.getByPlaceholderText('Enter your final answer'), {
      target: { value: '9' },
    })

    fireEvent.click(screen.getByRole('button', { name: 'Submit Problems' }))

    await screen.findByText('Problems Graded!')

    fireEvent.click(screen.getByRole('button', { name: 'Revise and Resubmit' }))

    await screen.findByRole('button', { name: 'Submit Problems' })
    expect(screen.getByDisplayValue('9')).toBeInTheDocument()

    fireEvent.change(screen.getByDisplayValue('9'), { target: { value: '10' } })

    fireEvent.click(screen.getByRole('button', { name: 'Submit Problems' }))

    await screen.findByText('Problems Graded!')

    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledTimes(3)
    })
  })

  it('renders column method grid and submits per-digit answer', async () => {
    global.fetch
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          exercise: {
            problems: [
              {
                id: 1,
                problem: '24 + 38 = ?',
                problemType: 'column-method',
                operands: ['24', '38'],
                operator: '+',
                operations: ['addition'],
                expectedAnswer: '62',
                difficulty: 'easy',
              },
            ],
          },
        }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          gradeResult: {
            totalCorrect: 1,
            totalProblems: 1,
            comment: 'Good job',
            problems: [{ id: 1, correct: true, workShown: true, feedback: 'Nice steps' }],
          },
          score: 1,
          maxScore: 1,
          percentage: 100,
          feedback: 'Good job',
        }),
      })

    render(<MathExercise />)

    fireEvent.click(screen.getByRole('button', { name: 'Start Math Problems' }))

    await screen.findByText('Column Method: fill each digit box')

    const carryTens = screen.getByLabelText('Carry T')
    const carryOnes = screen.getByLabelText('Carry O')
    const answerTens = screen.getByLabelText('Answer digit T')
    const answerOnes = screen.getByLabelText('Answer digit O')

    expect(answerTens).toBeRequired()
    expect(answerOnes).toBeRequired()

    fireEvent.change(carryTens, { target: { value: '1' } })
    fireEvent.change(carryOnes, { target: { value: '' } })
    fireEvent.change(answerTens, { target: { value: '6' } })
    fireEvent.change(answerOnes, { target: { value: '2' } })

    fireEvent.click(screen.getByRole('button', { name: 'Submit Problems' }))

    await screen.findByText('Problems Graded!')

    const secondCallBody = JSON.parse(global.fetch.mock.calls[1][1].body)
    expect(secondCallBody.answers.problems[0].answer).toBe('62')
    expect(secondCallBody.answers.problems[0].work).toBe(
      JSON.stringify({
        digits: { 0: '6', 1: '2' },
        carries: { 0: '1' },
      })
    )
  })
})
